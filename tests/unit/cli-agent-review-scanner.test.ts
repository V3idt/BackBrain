import { beforeEach, describe, expect, it } from 'bun:test';
import { promisify } from 'util';

import { CliAgentReviewScanner } from '../../packages/core/src/adapters/cli-agent-review-scanner';
import type { SecurityIssue } from '../../packages/core/src/ports';

function createExecMock() {
    const calls: string[] = [];
    let codexExecCount = 0;

    const execMock = (cmd: string, options: any, callback: any) => {
        if (typeof options === 'function') {
            callback = options;
        }

        calls.push(cmd);

        if (cmd === 'codex --version') {
            callback(null, '1.0.0', '');
            return { on: () => { } };
        }

        if (cmd.includes('codex exec')) {
            codexExecCount += 1;

            if (codexExecCount === 1) {
                callback(null, JSON.stringify({ ready: true }), '');
                return { on: () => { } };
            }

            if (codexExecCount === 2) {
                callback(null, JSON.stringify({
                    repoSummary: 'Flask app with auth and persistence concerns',
                    specialists: [
                        {
                            name: 'auth-flow-reviewer',
                            rationale: 'Authentication logic is present',
                            focus: 'Review auth and authorization boundaries',
                            paths: ['/repo/app.py'],
                            checks: ['check auth flows', 'check privilege escalation'],
                            relevantFindingIds: ['semgrep.auth'],
                        },
                    ],
                }), '');
                return { on: () => { } };
            }

            if (codexExecCount === 3) {
                callback(null, JSON.stringify({
                    findings: [
                        {
                            title: 'Missing authorization check',
                            description: 'User can access admin endpoint without role verification.',
                            severity: 'high',
                            confidence: 'medium',
                            filePath: '/repo/app.py',
                            line: 24,
                            evidence: 'Route handler does not enforce admin role.',
                            remediation: 'Add explicit role enforcement before serving admin data.',
                        },
                    ],
                }), '');
                return { on: () => { } };
            }

            callback(null, JSON.stringify({
                findings: [
                    {
                        title: 'Missing authorization check',
                        description: 'User can access admin endpoint without role verification.',
                        severity: 'high',
                        confidence: 'medium',
                        filePath: '/repo/app.py',
                        line: 24,
                        evidence: 'Route handler does not enforce admin role.',
                        remediation: 'Add explicit role enforcement before serving admin data.',
                        sourceRoles: ['auth-flow-reviewer'],
                    },
                ],
            }), '');
            return { on: () => { } };
        }

        callback(new Error(`Unexpected command: ${cmd}`), '', '');
        return { on: () => { } };
    };

    (execMock as any)[promisify.custom] = (cmd: string, options?: any) => new Promise((resolve, reject) => {
        execMock(cmd, options, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });

    return { execMock, calls };
}

describe('CliAgentReviewScanner', () => {
    it('should run planner, specialist, and aggregator using an available backend', async () => {
        const { execMock, calls } = createExecMock();
        const scanner = new CliAgentReviewScanner({
            execFn: execMock as any,
            maxSpecialists: 4,
            backends: {
                codex: { enabled: true, binaryPath: 'codex' },
                gemini: { enabled: false },
                opencode: { enabled: false },
            },
        });

        const deterministicIssues: SecurityIssue[] = [
            {
                ruleId: 'semgrep.auth',
                title: 'Auth issue',
                description: 'Potential auth issue',
                severity: 'high',
                filePath: '/repo/app.py',
                line: 10,
            },
        ];

        const result = await scanner.scanWithContext(['/repo/app.py'], {
            repositoryRoot: '/repo',
            deterministicIssues,
            changedFiles: ['app.py'],
        });

        expect(result.issues.length).toBe(1);
        expect(result.issues[0]?.title).toBe('Missing authorization check');
        expect(result.issues[0]?.source).toContain('auth-flow-reviewer');
        expect(result.issues[0]?.confidence).toBe('medium');
        expect(calls.filter(cmd => cmd.includes('codex exec')).length).toBe(4);
    });

    it('should return no findings when no backends are available', async () => {
        const execMock = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') {
                callback = options;
            }
            callback(new Error('not available'), '', '');
            return { on: () => { } };
        };
        (execMock as any)[promisify.custom] = () => Promise.reject(new Error('not available'));

        const scanner = new CliAgentReviewScanner({
            execFn: execMock as any,
            backends: {
                codex: { enabled: true, binaryPath: 'codex' },
                gemini: { enabled: false },
                opencode: { enabled: false },
            },
        });

        const result = await scanner.scanWithContext(['/repo/app.py'], {
            repositoryRoot: '/repo',
            deterministicIssues: [],
            changedFiles: [],
        });

        expect(result.issues).toEqual([]);
        expect(result.scannerInfo).toContain('no backends available');
    });

    it('should reject a backend that fails readiness probing', async () => {
        const execMock = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') {
                callback = options;
            }

            if (cmd === 'codex --version') {
                callback(null, '1.0.0', '');
                return { on: () => { } };
            }

            if (cmd.includes('codex exec')) {
                callback(new Error('Opening authentication page in your browser'), '', 'Opening authentication page in your browser');
                return { on: () => { } };
            }

            callback(new Error(`Unexpected command: ${cmd}`), '', '');
            return { on: () => { } };
        };
        (execMock as any)[promisify.custom] = (cmd: string, options?: any) => new Promise((resolve, reject) => {
            execMock(cmd, options, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });

        const scanner = new CliAgentReviewScanner({
            execFn: execMock as any,
            backends: {
                codex: { enabled: true, binaryPath: 'codex' },
                gemini: { enabled: false },
                opencode: { enabled: false },
            },
        });

        const available = await scanner.isAvailable();
        expect(available).toBe(false);
    });
});

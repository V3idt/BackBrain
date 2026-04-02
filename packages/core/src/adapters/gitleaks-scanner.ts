import type { ScanResult, SecurityIssue } from '../ports';
import { createLogger } from '../utils/logger';
import { toError } from '../utils/result';
import { CliScannerBase } from './cli-scanner-base';

const logger = createLogger('GitleaksScanner');

interface GitleaksFinding {
    RuleID?: string;
    Description?: string;
    File?: string;
    StartLine?: number;
    EndLine?: number;
    Secret?: string;
    Match?: string;
    Fingerprint?: string;
}

interface ExecLikeError {
    code?: number;
    stdout?: string;
}

export class GitleaksScanner extends CliScannerBase {
    readonly name = 'gitleaks';

    constructor(execFn?: typeof import('child_process').exec, binaryPath = 'gitleaks') {
        super(binaryPath, execFn);
    }

    async isAvailable(): Promise<boolean> {
        return this.checkAvailable('version');
    }

    getSupportedExtensions(): string[] {
        return ['.env', '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rb', '.php'];
    }

    async scanFile(filePath: string): Promise<SecurityIssue[]> {
        const result = await this.scan([filePath]);
        return result.issues.filter(issue => issue.filePath === filePath);
    }

    async scan(paths: string[]): Promise<ScanResult> {
        const startTime = Date.now();

        try {
            const findings: GitleaksFinding[] = [];

            for (const path of paths) {
                const { stdout } = await this.execAsync(
                    `${this.binaryPath} detect --no-git --source ${this.quote(path)} --report-format json --report-path -`,
                    { maxBuffer: 10 * 1024 * 1024 }
                );

                const trimmed = stdout.trim();
                if (!trimmed) continue;

                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    findings.push(...parsed);
                }
            }

            return {
                issues: findings.map((finding) => {
                    const issue: SecurityIssue = {
                        ruleId: finding.RuleID || 'gitleaks.secret',
                        title: finding.RuleID || 'Potential secret detected',
                        description: finding.Description || 'Potential secret or credential detected by Gitleaks.',
                        severity: 'critical',
                        filePath: finding.File || '',
                        line: finding.StartLine || 1,
                    };
                    if (finding.EndLine !== undefined) issue.endLine = finding.EndLine;
                    const snippet = finding.Match || finding.Secret;
                    if (snippet !== undefined) issue.snippet = snippet;
                    return issue;
                }),
                scannedFiles: paths,
                scanDurationMs: Date.now() - startTime,
                scannerInfo: 'Gitleaks',
            };
        } catch (error) {
            const execError = error as ExecLikeError;
            if (execError.code === 1 && execError.stdout) {
                const parsed = JSON.parse(execError.stdout) as GitleaksFinding[];
                return {
                    issues: parsed.map((finding) => {
                        const issue: SecurityIssue = {
                            ruleId: finding.RuleID || 'gitleaks.secret',
                            title: finding.RuleID || 'Potential secret detected',
                            description: finding.Description || 'Potential secret or credential detected by Gitleaks.',
                            severity: 'critical',
                            filePath: finding.File || '',
                            line: finding.StartLine || 1,
                        };
                        if (finding.EndLine !== undefined) issue.endLine = finding.EndLine;
                        const snippet = finding.Match || finding.Secret;
                        if (snippet !== undefined) issue.snippet = snippet;
                        return issue;
                    }),
                    scannedFiles: paths,
                    scanDurationMs: Date.now() - startTime,
                    scannerInfo: 'Gitleaks',
                };
            }
            logger.error('Gitleaks scan failed', { error: toError(error) });
            throw error;
        }
    }
}

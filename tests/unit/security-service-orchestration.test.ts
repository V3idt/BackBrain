import { describe, expect, it } from 'bun:test';

import { SecurityService } from '../../packages/core/src/services/security-service';
import type { ScanResult, SecurityIssue, SecurityScanner, SecurityScanContext } from '../../packages/core/src/ports';

class DeterministicTestScanner implements SecurityScanner {
    readonly name = 'det-test-scanner';
    readonly scanKind = 'deterministic' as const;

    async scanFile(filePath: string): Promise<SecurityIssue[]> {
        return [{
            ruleId: 'det.issue',
            title: 'Deterministic issue',
            description: 'Found by deterministic scanner',
            severity: 'high',
            filePath,
            line: 3,
            source: 'det-test-scanner',
        }];
    }

    async scan(paths: string[]): Promise<ScanResult> {
        return {
            issues: [{
                ruleId: 'det.issue',
                title: 'Deterministic issue',
                description: 'Found by deterministic scanner',
                severity: 'high',
                filePath: paths[0] || '/repo/app.ts',
                line: 3,
                source: 'det-test-scanner',
            }],
            scannedFiles: paths,
            scanDurationMs: 5,
            scannerInfo: this.name,
        };
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    getSupportedExtensions(): string[] {
        return ['.ts'];
    }
}

class AgentTestScanner implements SecurityScanner {
    readonly name = 'agent-test-scanner';
    readonly scanKind = 'agent' as const;
    public lastContext: SecurityScanContext | null = null;

    async scanFile(): Promise<SecurityIssue[]> {
        return [];
    }

    async scan(): Promise<ScanResult> {
        throw new Error('scan() should not be used when scanWithContext is available');
    }

    async scanWithContext(paths: string[], context: SecurityScanContext): Promise<ScanResult> {
        this.lastContext = context;
        return {
            issues: [{
                ruleId: 'agent.issue',
                title: 'Agent issue',
                description: 'Found by agent scanner',
                severity: 'medium',
                filePath: paths[0] || '/repo/app.ts',
                line: 8,
                source: 'agent-test-scanner',
                confidence: 'medium',
            }],
            scannedFiles: paths,
            scanDurationMs: 5,
            scannerInfo: this.name,
        };
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    getSupportedExtensions(): string[] {
        return ['.ts'];
    }
}

describe('SecurityService orchestration', () => {
    it('should pass deterministic findings into the agent scan phase', async () => {
        const deterministic = new DeterministicTestScanner();
        const agent = new AgentTestScanner();
        const service = new SecurityService([deterministic, agent]);

        const result = await service.scan(['/repo/app.ts'], {
            scanners: [deterministic.name, agent.name],
        });

        expect(result.issues.length).toBe(2);
        expect(agent.lastContext?.deterministicIssues?.length).toBe(1);
        expect(agent.lastContext?.deterministicIssues?.[0]?.ruleId).toBe('det.issue');
        expect(result.issues.some(issue => issue.source === 'agent-test-scanner')).toBe(true);
    });
});

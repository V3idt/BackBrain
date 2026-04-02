import type { ScanResult, SecurityIssue, Severity } from '../ports';
import { createLogger } from '../utils/logger';
import { toError } from '../utils/result';
import { CliScannerBase } from './cli-scanner-base';

const logger = createLogger('OSVScanner');

interface OsvVulnerability {
    id?: string;
    summary?: string;
    details?: string;
    database_specific?: {
        severity?: string;
    };
}

interface OsvResult {
    source?: {
        path?: string;
    };
    packages?: Array<{
        package?: { name?: string };
        vulnerabilities?: OsvVulnerability[];
    }>;
    vulnerabilities?: OsvVulnerability[];
}

interface OsvOutput {
    results?: OsvResult[];
}

export class OSVScanner extends CliScannerBase {
    readonly name = 'osv-scanner';

    constructor(execFn?: typeof import('child_process').exec, binaryPath = 'osv-scanner') {
        super(binaryPath, execFn);
    }

    async isAvailable(): Promise<boolean> {
        return this.checkAvailable('--version');
    }

    getSupportedExtensions(): string[] {
        return ['.json', '.lock', '.toml', '.yaml', '.yml', '.txt'];
    }

    async scanFile(filePath: string): Promise<SecurityIssue[]> {
        const result = await this.scan([filePath]);
        return result.issues.filter(issue => issue.filePath === filePath);
    }

    async scan(paths: string[]): Promise<ScanResult> {
        const startTime = Date.now();

        try {
            const issues: SecurityIssue[] = [];

            for (const path of paths) {
                const { stdout } = await this.execAsync(
                    `${this.binaryPath} --json ${this.quote(path)}`,
                    { maxBuffer: 10 * 1024 * 1024 }
                );

                const data = JSON.parse(stdout) as OsvOutput;
                for (const result of data.results || []) {
                    const directVulns = result.vulnerabilities || [];
                    for (const vuln of directVulns) {
                        issues.push(this.toIssue(path, vuln));
                    }

                    for (const pkg of result.packages || []) {
                        for (const vuln of pkg.vulnerabilities || []) {
                            issues.push(this.toIssue(result.source?.path || path, vuln, pkg.package?.name));
                        }
                    }
                }
            }

            return {
                issues,
                scannedFiles: paths,
                scanDurationMs: Date.now() - startTime,
                scannerInfo: 'OSV-Scanner',
            };
        } catch (error) {
            logger.error('OSV scan failed', { error: toError(error) });
            throw error;
        }
    }

    private toIssue(filePath: string, vulnerability: OsvVulnerability, packageName?: string): SecurityIssue {
        return {
            ruleId: vulnerability.id || 'osv.vulnerability',
            title: vulnerability.summary || vulnerability.id || 'Dependency vulnerability',
            description: vulnerability.details || (packageName ? `Known vulnerability in ${packageName}.` : 'Known dependency vulnerability detected by OSV-Scanner.'),
            severity: this.mapSeverity(vulnerability.database_specific?.severity),
            filePath,
            line: 1,
        };
    }

    private mapSeverity(value?: string): Severity {
        switch ((value || '').toLowerCase()) {
            case 'critical':
                return 'critical';
            case 'high':
                return 'high';
            case 'medium':
                return 'medium';
            case 'low':
                return 'low';
            default:
                return 'info';
        }
    }
}

import type { ScanResult, SecurityIssue, Severity } from '../ports';
import { createLogger } from '../utils/logger';
import { toError } from '../utils/result';
import { CliScannerBase } from './cli-scanner-base';

const logger = createLogger('TrivyScanner');

interface TrivyVulnerability {
    VulnerabilityID?: string;
    Title?: string;
    Description?: string;
    Severity?: string;
    PrimaryURL?: string;
    PkgName?: string;
    InstalledVersion?: string;
}

interface TrivyMisconfiguration {
    ID?: string;
    Title?: string;
    Description?: string;
    Severity?: string;
    Message?: string;
    PrimaryURL?: string;
}

interface TrivyResultItem {
    Target?: string;
    Vulnerabilities?: TrivyVulnerability[];
    Misconfigurations?: TrivyMisconfiguration[];
}

interface TrivyOutput {
    Results?: TrivyResultItem[];
}

export class TrivyScanner extends CliScannerBase {
    readonly name = 'trivy';

    constructor(execFn?: typeof import('child_process').exec, binaryPath = 'trivy') {
        super(binaryPath, execFn);
    }

    async isAvailable(): Promise<boolean> {
        return this.checkAvailable('--version');
    }

    getSupportedExtensions(): string[] {
        return ['.json', '.yaml', '.yml', '.toml', '.lock', '.tf', '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rb', '.php'];
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
                    `${this.binaryPath} fs --quiet --format json ${this.quote(path)}`,
                    { maxBuffer: 20 * 1024 * 1024 }
                );

                const data = JSON.parse(stdout) as TrivyOutput;
                for (const result of data.Results || []) {
                    for (const vuln of result.Vulnerabilities || []) {
                        const issue: SecurityIssue = {
                            ruleId: vuln.VulnerabilityID || 'trivy.vulnerability',
                            title: vuln.Title || vuln.VulnerabilityID || 'Dependency vulnerability',
                            description: vuln.Description || `Vulnerability in ${vuln.PkgName || 'dependency'} ${vuln.InstalledVersion || ''}`.trim(),
                            severity: this.mapSeverity(vuln.Severity),
                            filePath: result.Target || path,
                            line: 1,
                        };
                        if (vuln.PrimaryURL) issue.references = [vuln.PrimaryURL];
                        issues.push(issue);
                    }

                    for (const misconfig of result.Misconfigurations || []) {
                        const issue: SecurityIssue = {
                            ruleId: misconfig.ID || 'trivy.misconfiguration',
                            title: misconfig.Title || misconfig.ID || 'Misconfiguration detected',
                            description: misconfig.Message || misconfig.Description || 'Potential security misconfiguration detected by Trivy.',
                            severity: this.mapSeverity(misconfig.Severity),
                            filePath: result.Target || path,
                            line: 1,
                        };
                        if (misconfig.PrimaryURL) issue.references = [misconfig.PrimaryURL];
                        issues.push(issue);
                    }
                }
            }

            return {
                issues,
                scannedFiles: paths,
                scanDurationMs: Date.now() - startTime,
                scannerInfo: 'Trivy',
            };
        } catch (error) {
            if (this.isDatabaseUnavailableError(error)) {
                logger.warn('Trivy vulnerability DB unavailable, skipping scan', { error: toError(error) });
                return {
                    issues: [],
                    scannedFiles: paths,
                    scanDurationMs: Date.now() - startTime,
                    scannerInfo: 'Trivy (vulnerability DB unavailable)',
                };
            }
            logger.error('Trivy scan failed', { error: toError(error) });
            throw error;
        }
    }

    private isDatabaseUnavailableError(error: unknown): boolean {
        const text = error instanceof Error
            ? [error.message, (error as any).stderr, (error as any).stdout].filter(Boolean).join('\n').toLowerCase()
            : String(error).toLowerCase();

        return (
            text.includes('failed to download vulnerability db') ||
            text.includes('oci artifact error') ||
            text.includes('context deadline exceeded') ||
            text.includes('db error') ||
            text.includes('mirror.gcr.io/aquasec/trivy-db')
        );
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

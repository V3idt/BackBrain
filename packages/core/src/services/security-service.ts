import { SEVERITY_ORDER } from '../ports';
import type { SecurityScanner, SecurityIssue, Severity } from '../ports';
import type { CodeIssue, CodeFix, CodeLocation, IssueCategory, IssueSeverity } from '../types';
import { getLogger } from '../utils/logger';
import { toError } from '../utils/result';
import { providerRegistry } from './provider-registry';

export interface SecurityScanOptions {
    /** Minimum severity to include */
    minSeverity?: Severity;
    /** Specific files to scan (if empty, uses all) */
    files?: string[];
    /** Scanner names to use (if empty, uses all registered) */
    scanners?: string[];
}

export interface SecurityScanResult {
    issues: CodeIssue[];
    scannedFiles: string[];
    scanDurationMs: number;
    scannersUsed: string[];
}

/**
 * Convert security issue to code issue
 */
function toCodeIssue(issue: SecurityIssue): CodeIssue {
    const location: CodeLocation = {
        filePath: issue.filePath,
        line: issue.line,
    };
    if (issue.column !== undefined) location.column = issue.column;
    if (issue.endLine !== undefined) location.endLine = issue.endLine;

    const fix: CodeFix | undefined = issue.suggestedFix ? {
        description: issue.suggestedFix.description,
        original: issue.suggestedFix.original ?? '',
        replacement: issue.suggestedFix.replacement,
        autoFixable: issue.suggestedFix.autoFixable,
    } : undefined;

    // Generate a stable ID based on content and location
    // We use a simple string concatenation for now, but including the description
    // makes it much more stable than just line number.
    const contentHash = issue.description.substring(0, 10).replace(/\s+/g, '_');
    const id = `sec-${issue.ruleId}-${issue.filePath}-${issue.line}-${contentHash}`;

    const result: CodeIssue = {
        id,
        type: 'security_vulnerability',
        title: issue.title,
        description: issue.description,
        location,
        severity: issue.severity as IssueSeverity,
        category: 'security' as IssueCategory,
    };

    if (fix !== undefined) {
        result.suggestedFix = fix;
    }

    return result;
}

/**
 * Filter issues by minimum severity
 */
function filterBySeverity(issues: SecurityIssue[], minSeverity: Severity): SecurityIssue[] {
    const minIndex = SEVERITY_ORDER.indexOf(minSeverity);

    return issues.filter(issue => {
        const issueIndex = SEVERITY_ORDER.indexOf(issue.severity);
        return issueIndex <= minIndex;
    });
}

/**
 * Run security scan using registered scanners
 */
export async function runSecurityScan(
    paths: string[],
    options: SecurityScanOptions = {}
): Promise<SecurityScanResult> {
    const logger = getLogger();
    const startTime = Date.now();

    // Get scanners to use
    const scannerNames = options.scanners ?? providerRegistry.listScanners();
    const scanners: SecurityScanner[] = [];

    for (const name of scannerNames) {
        const scanner = providerRegistry.getScanner(name);
        if (scanner) {
            const available = await scanner.isAvailable();
            if (available) {
                scanners.push(scanner);
            } else {
                logger.warn(`Scanner ${name} is not available`);
            }
        }
    }

    if (scanners.length === 0) {
        logger.warn('No security scanners available');
        return {
            issues: [],
            scannedFiles: [],
            scanDurationMs: Date.now() - startTime,
            scannersUsed: [],
        };
    }

    logger.info(`Starting security scan with ${scanners.length} scanner(s)`, { paths });

    // Run all scanners
    const allIssues: SecurityIssue[] = [];
    const allFiles = new Set<string>();
    const usedScanners: string[] = [];

    for (const scanner of scanners) {
        try {
            logger.debug(`Running scanner: ${scanner.name}`);
            const result = await scanner.scan(paths);

            allIssues.push(...result.issues);
            result.scannedFiles.forEach(f => allFiles.add(f));
            usedScanners.push(scanner.name);

            logger.debug(`Scanner ${scanner.name} found ${result.issues.length} issues`);
        } catch (error) {
            logger.error(`Scanner ${scanner.name} failed`, { error: toError(error) });
        }
    }

    // Filter by severity if specified
    const filteredIssues = options.minSeverity
        ? filterBySeverity(allIssues, options.minSeverity)
        : allIssues;

    // Convert to CodeIssue type
    const codeIssues = filteredIssues.map(toCodeIssue);

    const duration = Date.now() - startTime;
    logger.info(`Security scan complete`, {
        issuesFound: codeIssues.length,
        filesScanned: allFiles.size,
        durationMs: duration,
    });

    return {
        issues: codeIssues,
        scannedFiles: Array.from(allFiles),
        scanDurationMs: duration,
        scannersUsed: usedScanners,
    };
}

/**
 * Scan a single file
 */
export async function scanFile(
    filePath: string,
    content: string,
    scannerName?: string
): Promise<CodeIssue[]> {
    const scanner = providerRegistry.getScanner(scannerName);

    if (!scanner) {
        return [];
    }

    const issues = await scanner.scanFile(filePath, content);
    return issues.map(toCodeIssue);
}

/**
 * SecurityService class for dependency injection
 */
export class SecurityService {
    constructor(private scanners: SecurityScanner[]) {
        // Register all scanners
        scanners.forEach(scanner => {
            providerRegistry.registerScanner(scanner.name, scanner);
        });
    }

    async scanFile(filePath: string, content: string): Promise<SecurityScanResult> {
        const issues: CodeIssue[] = [];

        for (const scanner of this.scanners) {
            const scannerIssues = await scanner.scanFile(filePath, content);
            issues.push(...scannerIssues.map(toCodeIssue));
        }

        return {
            issues,
            scannedFiles: [filePath],
            scanDurationMs: 0,
            scannersUsed: this.scanners.map(s => s.name),
        };
    }

    async scan(paths: string[], options?: SecurityScanOptions): Promise<SecurityScanResult> {
        return runSecurityScan(paths, options);
    }
}

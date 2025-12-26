import type { SecurityScanner, SecurityIssue, ScanResult, Severity } from '../ports';
import { toError } from '../utils/result';
import { createLogger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';




const logger = createLogger('SemgrepScanner');

interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    message: string;
    severity: string;
    metadata?: {
      cwe?: string[];
      owasp?: string[];
      references?: string[];
    };
    lines?: string;
  };
}

export class SemgrepScanner implements SecurityScanner {
  private execFn: typeof exec;
  private binaryPath: string = 'semgrep'; // Default to system path
  readonly name = 'semgrep';

  constructor(execFn?: typeof exec, binaryPath?: string) {
    this.execFn = execFn || exec;
    if (binaryPath) {
      this.binaryPath = binaryPath;
    }
  }

  private get execAsync() {
    return promisify(this.execFn);
  }

  setBinaryPath(path: string) {
    this.binaryPath = path;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.execAsync(`${this.binaryPath} --version`);
      return true;
    } catch {
      return false;
    }
  }

  getSupportedExtensions(): string[] {
    return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.c', '.cpp', '.cs'];
  }

  async scanFile(filePath: string, _content: string): Promise<SecurityIssue[]> {
    const result = await this.scan([filePath]);
    return result.issues;
  }

  async scan(paths: string[]): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Quote paths to handle spaces
      const quotedPaths = paths.map(p => `"${p}"`).join(' ');
      const { stdout } = await this.execAsync(
        `${this.binaryPath} --config=auto --json ${quotedPaths}`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      // Find the start of the JSON object to handle potential warnings before it
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) {
        throw new Error('Semgrep output did not contain valid JSON');
      }
      const jsonContent = stdout.substring(jsonStart);

      const data = JSON.parse(jsonContent);
      const issues = this.parseFindings(data.results || []);

      return {
        issues,
        scannedFiles: paths,
        scanDurationMs: Date.now() - startTime,
        scannerInfo: 'Semgrep',
      };
    } catch (error) {
      logger.error('Semgrep scan failed', { error: toError(error) });
      throw error;
    }
  }

  private parseFindings(findings: SemgrepFinding[]): SecurityIssue[] {
    return findings.map((f) => {
      const issue: SecurityIssue = {
        ruleId: f.check_id,
        title: f.check_id.split('.').pop() || f.check_id,
        description: f.extra.message,
        severity: this.mapSeverity(f.extra.severity),
        filePath: f.path,
        line: f.start.line,
        column: f.start.col,
        endLine: f.end.line,
      };
      if (f.extra.lines) issue.snippet = f.extra.lines;
      if (f.extra.metadata?.cwe?.[0]) issue.cweId = f.extra.metadata.cwe[0];
      if (f.extra.metadata?.owasp?.[0]) issue.owaspCategory = f.extra.metadata.owasp[0];
      if (f.extra.metadata?.references) issue.references = f.extra.metadata.references;
      return issue;
    });
  }

  private mapSeverity(semgrepSeverity: string): Severity {
    const normalized = semgrepSeverity.toLowerCase();
    if (normalized === 'error') return 'high';
    if (normalized === 'warning') return 'medium';
    return 'low';
  }
}

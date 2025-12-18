import type { SecurityScanner, SecurityIssue, ScanResult, Severity } from '../ports';
import { toError } from '../utils/result';
import { createLogger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);
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
  private isInstalling = false;
  private execFn: typeof exec;
  private venvPath: string;
  readonly name = 'semgrep';

  constructor(execFn?: typeof exec) {
    this.execFn = execFn || exec;
    this.venvPath = path.join(os.homedir(), '.backbrain', 'semgrep-venv');
  }

  private async getSemgrepPath(): Promise<string> {
    // 1. Try system semgrep
    try {
      await promisify(this.execFn)('semgrep --version');
      return 'semgrep';
    } catch {
      // 2. Try venv semgrep
      const venvBinary = path.join(this.venvPath, 'bin', 'semgrep');
      try {
        await fs.access(venvBinary);
        return venvBinary;
      } catch {
        return '';
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    const semgrepPath = await this.getSemgrepPath();
    if (semgrepPath) return true;

    if (!this.isInstalling) {
      this.installSemgrep().catch(error => {
        logger.error('Background installation failed', { error: toError(error) });
      });
    }
    return false;
  }

  private async installSemgrep(): Promise<void> {
    this.isInstalling = true;
    logger.info('Semgrep not found. Attempting background installation in private venv...', { venvPath: this.venvPath });

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(this.venvPath), { recursive: true });

      // Create venv
      await promisify(this.execFn)(`python3 -m venv ${this.venvPath}`);

      // Install semgrep in venv
      const pipPath = path.join(this.venvPath, 'bin', 'pip');
      await promisify(this.execFn)(`${pipPath} install semgrep`);

      logger.info('Semgrep installed successfully in private venv');
    } catch (error) {
      logger.error('Failed to install Semgrep automatically.', { error: toError(error) });
    } finally {
      this.isInstalling = false;
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

    const semgrepPath = await this.getSemgrepPath();
    if (!semgrepPath) {
      throw new Error('Semgrep is not installed and background installation is in progress or failed.');
    }

    try {
      const { stdout } = await promisify(this.execFn)(
        `${semgrepPath} --config=auto --json ${paths.join(' ')}`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const data = JSON.parse(stdout);
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

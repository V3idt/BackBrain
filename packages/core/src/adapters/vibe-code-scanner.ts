import type { SecurityScanner, SecurityIssue, ScanResult } from '../ports';
import { DEFAULT_VIBE_RULES, type VibeRule } from '../config/vibe-rules';

export class VibeCodeScanner implements SecurityScanner {
  readonly name = 'vibe-code';
  private rules: VibeRule[] = DEFAULT_VIBE_RULES;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getSupportedExtensions(): string[] {
    return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb', '.php'];
  }

  async scanFile(filePath: string, content: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    for (const rule of this.rules) {
      if (rule.type === 'regex') {
        issues.push(...this.runRegexRule(filePath, lines, rule));
      } else {
        // Custom logic for specific rules
        switch (rule.id) {
          case 'vibe-code.missing-import':
            issues.push(...this.detectMissingImports(filePath, lines));
            break;
          case 'vibe-code.name-mismatch':
            issues.push(...this.detectInconsistentNaming(filePath, lines));
            break;
          case 'vibe-code.unhandled-promise':
            issues.push(...this.detectUnhandledPromises(filePath, lines));
            break;
        }
      }
    }

    // Phase 9: AI-Augmented Scanning
    // issues.push(...await this.runAIScan(filePath, content));

    return issues;
  }

  async scan(paths: string[]): Promise<ScanResult> {
    const startTime = Date.now();
    const allIssues: SecurityIssue[] = [];

    // TODO: Implement full workspace scan

    return {
      issues: allIssues,
      scannedFiles: paths,
      scanDurationMs: Date.now() - startTime,
      scannerInfo: 'VibeCode Scanner',
    };
  }

  private runRegexRule(filePath: string, lines: string[], rule: VibeRule): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'g') : rule.pattern;

    lines.forEach((line, idx) => {
      if (line.match(pattern)) {
        issues.push({
          ruleId: rule.id,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          filePath,
          line: idx + 1,
          snippet: line.trim(),
        });
      }
    });
    return issues;
  }

  private detectMissingImports(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const importedModules = new Set<string>();

    lines.forEach((line) => {
      const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch?.[1]) importedModules.add(importMatch[1]);
    });

    const commonModules = ['fs', 'path', 'http', 'https', 'crypto', 'util'];
    lines.forEach((line, idx) => {
      commonModules.forEach((mod) => {
        if (line.includes(`${mod}.`) && !importedModules.has(mod)) {
          issues.push({
            ruleId: 'vibe-code.missing-import',
            title: 'Missing Import',
            description: `Module '${mod}' is used but not imported`,
            severity: 'high',
            filePath,
            line: idx + 1,
            snippet: line.trim(),
          });
        }
      });
    });

    return issues;
  }

  private detectInconsistentNaming(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const declarations = new Map<string, string>();

    lines.forEach((line, idx) => {
      const declMatch = line.match(/(?:const|let|var|function)\s+(\w+)/);
      if (declMatch?.[1]) {
        const name = declMatch[1];
        declarations.set(name.toLowerCase(), name);
      }

      const usageMatches = line.matchAll(/\b(\w+)\(/g);
      for (const match of usageMatches) {
        const used = match[1];
        if (!used) continue;
        const canonical = declarations.get(used.toLowerCase());
        if (canonical && canonical !== used) {
          issues.push({
            ruleId: 'vibe-code.name-mismatch',
            title: 'Inconsistent Naming',
            description: `'${used}' should be '${canonical}'`,
            severity: 'medium',
            filePath,
            line: idx + 1,
            snippet: line.trim(),
          });
        }
      }
    });

    return issues;
  }

  private detectUnhandledPromises(filePath: string, lines: string[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    lines.forEach((line, idx) => {
      if (line.includes('fetch(') || line.includes('axios.')) {
        if (!line.includes('await') && !line.includes('.catch') && !line.includes('.then')) {
          issues.push({
            ruleId: 'vibe-code.unhandled-promise',
            title: 'Unhandled Promise',
            description: 'Async operation without error handling',
            severity: 'high',
            filePath,
            line: idx + 1,
            snippet: line.trim(),
          });
        }
      }
    });

    return issues;
  }

  // private async runAIScan(filePath: string, content: string): Promise<SecurityIssue[]> {
  //   // TODO: Integrate with AI agent for Phase 9
  //   return [];
  // }
}

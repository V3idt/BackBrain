import { describe, test, expect, beforeEach } from 'bun:test';
import { SecurityService, SemgrepScanner, VibeCodeScanner, applyFixes, type CodeIssue } from '@backbrain/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Scan Workflow Integration', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backbrain-test-'));
        testFile = path.join(tempDir, 'test.js');
    });

    test('scan file → display issues → apply fix → verify', async () => {
        // Create vulnerable file
        fs.writeFileSync(testFile, `
const password = "hardcoded123";
eval(userInput);
        `.trim());

        // Scan
        const scanners = [new SemgrepScanner(), new VibeCodeScanner()];
        const service = new SecurityService(scanners);
        const result = await service.scanFile(testFile);

        expect(result.isOk()).toBe(true);
        const issues = result.unwrap();
        expect(issues.length).toBeGreaterThan(0);

        // Apply fix (if available)
        const fixableIssues = issues.filter(i => i.suggestedFix?.autoFixable);
        if (fixableIssues.length > 0) {
            const { summary } = await applyFixes(fixableIssues, { safeOnly: true });
            expect(summary.fixed).toBeGreaterThan(0);
        }
    });

    test('filter by severity', async () => {
        fs.writeFileSync(testFile, 'const x = eval("test");');

        const service = new SecurityService([new SemgrepScanner()]);
        const result = await service.scanFile(testFile, { minSeverity: 'high' });

        expect(result.isOk()).toBe(true);
        const issues = result.unwrap();
        issues.forEach(issue => {
            expect(['critical', 'high']).toContain(issue.severity);
        });
    });
});

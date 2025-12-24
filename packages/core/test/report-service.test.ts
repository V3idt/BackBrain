import { describe, it, expect, beforeEach } from 'bun:test';
import { ReportService } from '../src/services/report-service';
import { CodeIssue } from '../src/ports/scanner';

describe('ReportService', () => {
    let service: ReportService;

    beforeEach(() => {
        service = new ReportService();
    });

    it('should calculate risk score correctly', () => {
        // 1 Critical (10) + 1 High (5) = 15
        // 15 / 50 * 100 = 30
        const issues: CodeIssue[] = [
            {
                id: '1',
                ruleId: 'test-rule',
                title: 'Critical Issue',
                description: 'desc',
                severity: 'critical',
                location: { filePath: 'test.ts', line: 1, column: 1 }
            },
            {
                id: '2',
                ruleId: 'test-rule-2',
                title: 'High Issue',
                description: 'desc',
                severity: 'high',
                location: { filePath: 'test.ts', line: 2, column: 1 }
            }
        ];

        const data = service.generateReportData(issues);
        expect(data.riskScore).toBe(30);
    });

    it('should cap risk score at 100', () => {
        // 6 Critical (60) > 50 -> 100
        const issues: CodeIssue[] = Array(6).fill({
            id: '1',
            ruleId: 'test-rule',
            title: 'Critical Issue',
            description: 'desc',
            severity: 'critical',
            location: { filePath: 'test.ts', line: 1, column: 1 }
        });

        const data = service.generateReportData(issues);
        expect(data.riskScore).toBe(100);
    });

    it('should map compliance info', () => {
        const issues: CodeIssue[] = [
            {
                id: '1',
                ruleId: 'vibe-code.missing-import', // Mapped to CWE-440
                title: 'Missing Import',
                description: 'desc',
                severity: 'high',
                location: { filePath: 'test.ts', line: 1, column: 1 }
            }
        ];

        const data = service.generateReportData(issues);
        expect(data.compliance.cwe['CWE-440: Expected Behavior Violation']).toBe(1);
        expect(data.issues[0].compliance?.cwe).toContain('CWE-440: Expected Behavior Violation');
    });

    it('should generate valid JSON', () => {
        const issues: CodeIssue[] = [];
        const json = service.generateJSON(issues);
        const parsed = JSON.parse(json);
        expect(parsed.riskScore).toBe(0);
        expect(parsed.totalIssues).toBe(0);
    });

    it('should use custom compliance map', () => {
        const issues: CodeIssue[] = [
            {
                id: '1',
                ruleId: 'custom-rule',
                title: 'Custom Issue',
                description: 'desc',
                severity: 'high',
                location: { filePath: 'test.ts', line: 1, column: 1 }
            }
        ];

        const customMap = {
            'custom-rule': {
                cwe: ['CWE-999']
            }
        };

        const data = service.generateReportData(issues, customMap);
        expect(data.compliance.cwe['CWE-999']).toBe(1);
        expect(data.issues[0].compliance?.cwe).toContain('CWE-999');
    });
});

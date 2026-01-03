import { CodeIssue } from '../types';
import { getComplianceInfo, ComplianceInfo } from '../config/compliance-map';

export interface ReportData {
    timestamp: string;
    totalIssues: number;
    riskScore: number; // 0-100 (100 is worst)
    severityCounts: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
    compliance: {
        owasp: Record<string, number>;
        cwe: Record<string, number>;
    };
    issues: (CodeIssue & { compliance?: ComplianceInfo })[];
}

export class ReportService {
    /**
     * Generate a full report object from a list of issues
     */
    generateReportData(issues: CodeIssue[], customComplianceMap?: Record<string, ComplianceInfo>): ReportData {
        const severityCounts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
        };

        const compliance = {
            owasp: {} as Record<string, number>,
            cwe: {} as Record<string, number>
        };

        // Enrich issues with compliance info and count stats
        const enrichedIssues = issues.map(issue => {
            const severity = issue.severity.toLowerCase() as keyof typeof severityCounts;
            if (severityCounts[severity] !== undefined) {
                severityCounts[severity]++;
            }

            const info = getComplianceInfo(issue.ruleId || issue.id, customComplianceMap);

            // Aggregate compliance stats
            info.owasp?.forEach(id => {
                compliance.owasp[id] = (compliance.owasp[id] || 0) + 1;
            });
            info.cwe?.forEach(id => {
                compliance.cwe[id] = (compliance.cwe[id] || 0) + 1;
            });

            return { ...issue, compliance: info };
        });

        return {
            timestamp: new Date().toISOString(),
            totalIssues: issues.length,
            riskScore: this.calculateRiskScore(severityCounts),
            severityCounts,
            compliance,
            issues: enrichedIssues
        };
    }

    /**
     * Calculate deterministic risk score (0-100)
     * 0 = Secure, 100 = Critical Risk
     */
    calculateRiskScore(counts: { critical: number; high: number; medium: number; low: number }): number {
        // Weights
        const W_CRITICAL = 10;
        const W_HIGH = 5;
        const W_MEDIUM = 2;
        const W_LOW = 1;

        const totalWeight =
            (counts.critical * W_CRITICAL) +
            (counts.high * W_HIGH) +
            (counts.medium * W_MEDIUM) +
            (counts.low * W_LOW);

        // Normalize: A score of 50+ is considered 100% risk (fail)
        // This means 5 critical issues = 100% risk
        const MAX_TOLERANCE = 50;

        return Math.min(100, Math.round((totalWeight / MAX_TOLERANCE) * 100));
    }

    /**
     * Generate JSON report
     */
    generateJSON(issues: CodeIssue[], customComplianceMap?: Record<string, ComplianceInfo>): string {
        const data = this.generateReportData(issues, customComplianceMap);
        return JSON.stringify(data, null, 2);
    }
}

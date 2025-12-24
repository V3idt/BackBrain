/**
 * Compliance mapping for security rules
 * Maps internal rule IDs to OWASP Top 10 and CWE identifiers
 */

export interface ComplianceInfo {
    owasp?: string[]; // e.g., ["A01:2021-Broken Access Control"]
    cwe?: string[];   // e.g., ["CWE-79"]
}

export const COMPLIANCE_MAP: Record<string, ComplianceInfo> = {
    // Vibe Code Rules
    'vibe-code.missing-import': {
        cwe: ['CWE-440: Expected Behavior Violation']
    },
    'vibe-code.unhandled-promise': {
        cwe: ['CWE-703: Improper Check or Handling of Exceptional Conditions']
    },
    'vibe-code.dead-code': {
        cwe: ['CWE-561: Dead Code']
    },
    'vibe-code.type-mismatch': {
        cwe: ['CWE-704: Incorrect Type Conversion or Cast']
    },
    'vibe-code.hallucinated-dep': {
        cwe: ['CWE-829: Inclusion of Functionality from Untrusted Control Sphere']
    },

    // Common Semgrep Rules (Examples - this would be expanded)
    'javascript.express.security.injection.tainted-sql-string': {
        owasp: ['A03:2021-Injection'],
        cwe: ['CWE-89']
    },
    'javascript.react.security.dangerously-set-inner-html': {
        owasp: ['A03:2021-Injection'],
        cwe: ['CWE-79']
    },
    'python.lang.security.audit.eval-detected': {
        owasp: ['A03:2021-Injection'],
        cwe: ['CWE-95']
    }
};

/**
 * Get compliance info for a rule ID, optionally merging with a custom map
 */
export function getComplianceInfo(ruleId: string, customMap?: Record<string, ComplianceInfo>): ComplianceInfo {
    const defaultInfo = COMPLIANCE_MAP[ruleId] || {};
    const customInfo = customMap?.[ruleId] || {};

    return {
        owasp: [...(defaultInfo.owasp || []), ...(customInfo.owasp || [])],
        cwe: [...(defaultInfo.cwe || []), ...(customInfo.cwe || [])]
    };
}

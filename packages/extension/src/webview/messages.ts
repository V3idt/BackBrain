import type { CodeIssue, IssueSeverity } from '@backbrain/core';

/**
 * Acquire the VS Code API for webview → extension communication.
 * We use a singleton pattern to ensure it's only acquired once, 
 * which prevents errors during hot-reloads or multiple imports.
 */
let vscodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;

declare function acquireVsCodeApi(): {
    postMessage(message: WebviewMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
};

export function getVsCodeApi() {
    if (!vscodeApi) {
        if (typeof acquireVsCodeApi === 'function') {
            vscodeApi = acquireVsCodeApi();
        } else {
            // Fallback for development/testing outside of VS Code
            console.warn('acquireVsCodeApi is not available. Using mock API.');
            vscodeApi = {
                postMessage: (msg) => console.log('Mock PostMessage:', msg),
                getState: () => ({}),
                setState: (state) => console.log('Mock SetState:', state),
            };
        }
    }
    return vscodeApi;
}

export const vscode = getVsCodeApi();

// ============================================================================
// Webview → Extension Messages
// ============================================================================

export type WebviewMessage =
    | { type: 'requestScan' }
    | { type: 'navigateToIssue'; filePath: string; line: number; column?: number }
    | { type: 'ready' };

// ============================================================================
// Extension → Webview Messages
// ============================================================================

export type ExtensionMessage =
    | { type: 'scanStarted' }
    | { type: 'scanComplete'; issues: IssueData[] }
    | { type: 'scanError'; error: string };

// ============================================================================
// Issue Data (simplified for UI)
// ============================================================================

export interface IssueData {
    id: string;
    title: string;
    description: string;
    severity: IssueSeverity;
    filePath: string;
    line: number;
    column: number; // Normalized to always be a number
    snippet?: string;
    category: string;
}

/**
 * Convert CodeIssue from core to IssueData for the webview.
 * This function normalizes the data to ensure the UI always has 
 * the expected fields, even if the core library changes.
 */
export function toIssueData(issue: CodeIssue): IssueData {
    const { location } = issue;

    return {
        id: issue.id || 'unknown',
        title: issue.title || 'Untitled Issue',
        description: issue.description || '',
        severity: issue.severity || 'info',
        filePath: location?.filePath || 'unknown',
        // Normalize line and column to be 1-indexed numbers
        line: Math.max(1, location?.line || 1),
        column: Math.max(1, location?.column || 1),
        category: issue.category || 'logic',
        // Note: snippet is not currently provided by the core CodeIssue type
        // but is reserved here for future implementation.
    };
}

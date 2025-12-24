import React, { useState, useEffect } from 'react';
import {
    provideVSCodeDesignSystem,
    vsCodeButton,
    vsCodeProgressRing
} from '@vscode/webview-ui-toolkit';
import { vscode } from './messages';
import type { IssueData, ExtensionMessage, FixSessionData, FixData } from './messages';
import { IssueList } from './components/IssueList';
import { FixHistory } from './components/FixHistory';
import './styles/theme.css';

// Register VS Code Web Components
provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeProgressRing());

const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

const App: React.FC = () => {
    // Initialize state from VS Code persistence if available
    const initialState = vscode.getState() as { issues?: IssueData[] } | undefined;
    const [issues, setIssues] = useState<IssueData[]>(initialState?.issues || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fixHistory, setFixHistory] = useState<FixSessionData[]>([]);
    const [activeFix, setActiveFix] = useState<{ issueId: string; fix: FixData } | null>(null);

    // Persist issues whenever they change
    useEffect(() => {
        vscode.setState({ issues });
    }, [issues]);

    // Listen for messages from the extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
            const message = event.data;

            switch (message.type) {
                case 'scanStarted':
                    setLoading(true);
                    setError(null);
                    break;
                case 'scanComplete':
                    setIssues(message.issues);
                    setLoading(false);
                    break;
                case 'scanError':
                    setError(message.error);
                    setLoading(false);
                    break;
                case 'fixSuggested':
                    setActiveFix({ issueId: message.issueId, fix: message.fix });
                    break;
                case 'fixHistory':
                    setFixHistory(message.sessions);
                    break;
                case 'fixApplied':
                    // Clear active fix and refresh history
                    setActiveFix(null);
                    vscode.postMessage({ type: 'requestFixHistory' });
                    // Also refresh scan to remove fixed issue
                    vscode.postMessage({ type: 'requestScan' });
                    break;
                case 'fixReverted':
                    vscode.postMessage({ type: 'requestFixHistory' });
                    vscode.postMessage({ type: 'requestScan' });
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        // Signal that the webview is ready
        vscode.postMessage({ type: 'ready' });
        // Request initial history
        vscode.postMessage({ type: 'requestFixHistory' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleScan = () => {
        vscode.postMessage({ type: 'requestScan' });
    };

    // Calculate issue counts by severity
    const counts = issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div style={{ padding: 'var(--bb-spacing-xl)' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--bb-spacing-xl)',
                paddingBottom: 'var(--bb-spacing-lg)',
                borderBottom: '1px solid var(--bb-color-border)',
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: 'var(--bb-font-size-md)',
                    fontWeight: 'var(--bb-font-weight-semibold)',
                    color: 'var(--bb-color-foreground)',
                }}>
                    Security Issues
                </h2>
                <vscode-button
                    appearance="secondary"
                    onClick={handleScan}
                    disabled={loading}
                >
                    {loading ? 'Scanning...' : 'Scan Workspace'}
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    onClick={() => vscode.postMessage({ type: 'exportReport' })}
                    title="Export Report"
                    style={{ marginLeft: 'var(--bb-spacing-sm)' }}
                >
                    <span className="codicon codicon-export"></span>
                </vscode-button>
            </div>

            {/* Summary Badges */}
            {issues.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: 'var(--bb-spacing-md)',
                    marginBottom: 'var(--bb-spacing-xl)',
                    flexWrap: 'wrap',
                }}>
                    {severityOrder.map(severity => {
                        const count = counts[severity] || 0;
                        if (count === 0) return null;

                        return (
                            <span
                                key={severity}
                                style={{
                                    fontSize: 'var(--bb-font-size-sm)',
                                    padding: 'var(--bb-spacing-xs) var(--bb-spacing-md)',
                                    borderRadius: 'var(--bb-border-radius-pill)',
                                    backgroundColor: 'var(--bb-color-badge-bg)',
                                    color: 'var(--bb-color-badge-fg)',
                                }}
                            >
                                {count} {severity}
                            </span>
                        );
                    })}
                    <span style={{
                        fontSize: 'var(--bb-font-size-sm)',
                        padding: 'var(--bb-spacing-xs) var(--bb-spacing-md)',
                        borderRadius: 'var(--bb-border-radius-pill)',
                        backgroundColor: 'var(--bb-color-background-secondary)',
                        color: 'var(--bb-color-foreground)',
                        marginLeft: 'auto',
                    }}>
                        Total: {issues.length}
                    </span>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div style={{
                    padding: 'var(--bb-spacing-lg)',
                    marginBottom: 'var(--bb-spacing-xl)',
                    borderRadius: 'var(--bb-border-radius-md)',
                    backgroundColor: 'var(--bb-color-error-bg)',
                    color: 'var(--bb-color-error)',
                    border: '1px solid var(--bb-color-error)',
                }}>
                    <strong>Scan Error:</strong> {error}
                </div>
            )}

            {/* Issue List */}
            <IssueList
                issues={issues}
                loading={loading}
                activeFix={activeFix}
                onClearActiveFix={() => setActiveFix(null)}
            />

            {/* Fix History */}
            <div style={{ marginTop: 'var(--bb-spacing-xl)' }}>
                <FixHistory
                    sessions={fixHistory}
                    onRevert={(sessionId) => vscode.postMessage({ type: 'revertFix', sessionId })}
                />
            </div>
        </div>
    );
};

export default App;

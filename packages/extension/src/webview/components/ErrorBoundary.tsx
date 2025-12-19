import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '20px',
                    color: 'var(--vscode-errorForeground)',
                    background: 'var(--vscode-input-background)',
                    border: '1px solid var(--vscode-errorForeground)',
                    borderRadius: '4px',
                    margin: '10px'
                }}>
                    <h2>Something went wrong.</h2>
                    <p>The BackBrain UI encountered an unexpected error.</p>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px', fontSize: '12px' }}>
                        {this.state.error && this.state.error.toString()}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '15px',
                            padding: '8px 12px',
                            background: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer'
                        }}
                    >
                        Reload UI
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

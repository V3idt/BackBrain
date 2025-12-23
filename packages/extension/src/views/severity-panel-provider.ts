import * as vscode from 'vscode';
import { createLogger, type SecurityService } from '@backbrain/core';
import { type WebviewMessage, type IssueData, toIssueData } from '../webview/messages';

const logger = createLogger('SeverityPanel');

export class SeverityPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'backbrain.severityPanel';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _securityService: SecurityService,
    ) { }

    /**
     * Public method to show issues from an external scan
     */
    public showIssues(issues: any[]): void {
        const issueData: IssueData[] = issues.map(issue => toIssueData(issue));
        this._postMessage({ type: 'scanComplete', issues: issueData });

        // Focus the view if it exists
        if (this._view) {
            this._view.show(true);
        }
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            // Restrict the webview to only load resources from the `dist` directory
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist')
            ]
        };

        try {
            webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);
        } catch (error) {
            logger.error('Failed to load webview HTML', { error });
            webviewView.webview.html = `<!DOCTYPE html><html><body>
                <h3>Error loading BackBrain UI</h3>
                <p>Please ensure the extension is built correctly.</p>
                <pre>${error}</pre>
            </body></html>`;
        }

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            switch (message.type) {
                case 'ready':
                    logger.debug('Webview is ready');
                    break;

                case 'requestScan':
                    await this._handleScanRequest();
                    break;

                case 'navigateToIssue':
                    await this._handleNavigateToIssue(message.filePath, message.line, message.column);
                    break;
            }
        });
    }

    /**
     * Handle scan request from webview
     */
    private async _handleScanRequest(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._postMessage({ type: 'scanError', error: 'No workspace folder open' });
            return;
        }

        // Notify webview that scan is starting
        this._postMessage({ type: 'scanStarted' });
        logger.info('Starting workspace scan...');

        try {
            // Dynamically get supported extensions from all available scanners
            const extensions = await this._securityService.getSupportedExtensions();
            const extensionPattern = extensions.map(ext => ext.replace('.', '')).join(',');
            const globPattern = `**/*.{${extensionPattern}}`;

            logger.debug(`Dynamic glob pattern for scan: ${globPattern}`);

            // Find files to scan
            const files = await vscode.workspace.findFiles(
                globPattern,
                '**/node_modules/**',
                1000 // Increased limit to 1000 files
            );

            const filePaths = files.map(f => f.fsPath);
            logger.debug(`Found ${filePaths.length} files to scan`);

            // Run the scan
            const result = await this._securityService.scan(filePaths);

            // Convert to IssueData for the webview
            const issueData: IssueData[] = result.issues.map(issue => toIssueData(issue));

            logger.info(`Scan complete: ${issueData.length} issues found`);
            this._postMessage({ type: 'scanComplete', issues: issueData });

        } catch (error) {
            logger.error('Scan failed', { error });
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._postMessage({ type: 'scanError', error: errorMessage });
        }
    }

    /**
     * Navigate to issue location in editor
     */
    private async _handleNavigateToIssue(filePath: string, line: number, column?: number): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document, { preserveFocus: true });

            // Create position (VS Code is 0-indexed, our data is 1-indexed)
            const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, (column || 1) - 1));

            // Move cursor and reveal
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            logger.debug('Navigated to issue', { filePath, line, column });
        } catch (error) {
            logger.error('Failed to navigate to issue', { error, filePath, line });
            vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
        }
    }

    /**
     * Post message to webview
     */
    private _postMessage(message: { type: string;[key: string]: unknown }): void {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const htmlUri = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.html');
        const htmlContent = await vscode.workspace.fs.readFile(htmlUri);
        let html = new TextDecoder().decode(htmlContent);

        const nonce = getNonce();

        // 1. Replace asset paths with webview URIs
        // Vite builds assets into /assets/ and references them with absolute paths in the built index.html
        html = html.replace(
            /(href|src)=(['"])\/assets\/([^'"]+)\2/gi,
            (_match, attr, _quote, fileName) => {
                const uri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets', fileName));
                return `${attr}="${uri}"`;
            }
        );

        // 2. Inject Content Security Policy (CSP) and Nonce
        // We use a more robust approach: find the <head> tag and inject CSP, then add nonce to all scripts.
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">`;

        // Inject CSP into <head>
        if (/<head[^>]*>/i.test(html)) {
            html = html.replace(/(<head[^>]*>)/i, `$1\n\t\t${csp}`);
        } else {
            // Fallback: inject at the very beginning if <head> is missing
            html = `<head>${csp}</head>\n${html}`;
        }

        // Add nonce to all script tags
        html = html.replace(/<script\b([^>]*)>/gi, (_match, attrs) => {
            // Avoid adding duplicate nonces if already present
            if (attrs.includes('nonce=')) return _match;
            return `<script nonce="${nonce}" ${attrs}>`;
        });

        return html;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

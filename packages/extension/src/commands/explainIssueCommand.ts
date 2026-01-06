/**
 * Explain Issue Command
 * 
 * Uses AI to explain a security issue to the user.
 * Refactored to use shared adapter factory with caching, fallback, and rate limiting.
 */

import * as vscode from 'vscode';
import { createLogger, type SecurityIssue } from '@backbrain/core';
import {
    explainIssueWithCache,
    streamExplainIssue,
    isRateLimited,
    getRateLimitCooldown,
    showAIUnavailableMessage,
    getOrCreateAIAdapter,
    getActiveProvider,
} from '../services/ai-adapter-factory';

const logger = createLogger('ExplainIssueCommand');

/**
 * State for the currently selected issue (set by Severity Panel)
 */
let currentIssue: SecurityIssue | null = null;

/**
 * Set the current issue for AI commands
 */
export function setCurrentIssue(issue: SecurityIssue | null): void {
    currentIssue = issue;
}

/**
 * Get the current issue
 */
export function getCurrentIssue(): SecurityIssue | null {
    return currentIssue;
}

/**
 * Register the explainIssue command
 */
export function registerExplainIssueCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('backbrain.explainIssue', async (issueArg?: SecurityIssue) => {
        const issue = issueArg || currentIssue;

        if (!issue) {
            vscode.window.showWarningMessage(
                'No issue selected. Select an issue from the Security Panel first.'
            );
            return;
        }

        // Check rate limiting
        if (isRateLimited()) {
            const cooldown = Math.ceil(getRateLimitCooldown() / 1000);
            vscode.window.showWarningMessage(
                `Please wait ${cooldown} seconds before making another AI request.`
            );
            return;
        }

        logger.info('Explaining issue', { ruleId: issue.ruleId });

        // Check AI availability first
        const adapter = await getOrCreateAIAdapter();
        if (!adapter) {
            showAIUnavailableMessage();
            return;
        }

        // Get code context from file if available
        let codeContext: string | undefined;
        if (issue.filePath) {
            try {
                const fileUri = vscode.Uri.file(issue.filePath);
                const document = await vscode.workspace.openTextDocument(fileUri);

                // Get surrounding lines for context (configurable via context)
                const contextLines = context.globalState.get<number>('backbrain.ai.contextLines', 10);
                const startLine = Math.max(0, issue.line - contextLines);
                const endLine = Math.min(document.lineCount - 1, issue.line + contextLines);
                const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
                codeContext = document.getText(range);
            } catch (e) {
                logger.debug('Could not read file for context', { error: e });
            }
        }

        // Check user preference for streaming
        const useStreaming = context.globalState.get<boolean>('backbrain.ai.useStreaming', true);

        if (useStreaming) {
            await explainWithStreaming(issue, codeContext);
        } else {
            await explainWithoutStreaming(issue, codeContext);
        }
    });
}

/**
 * Explain issue with streaming response
 */
async function explainWithStreaming(issue: SecurityIssue, codeContext?: string): Promise<void> {
    // Create output channel for streaming
    const outputChannel = vscode.window.createOutputChannel('BackBrain AI Explanation', 'markdown');
    outputChannel.show(true);
    outputChannel.appendLine(`# AI Explanation: ${issue.title}\n`);
    outputChannel.appendLine('*Generating explanation...*\n');
    outputChannel.appendLine('---\n');

    try {
        let fullResponse = '';
        for await (const chunk of streamExplainIssue(issue, codeContext)) {
            outputChannel.append(chunk);
            fullResponse += chunk;
        }

        if (fullResponse.trim().length === 0) {
            const errorMsg = 'AI returned an empty explanation. This can happen if the provider (e.g., Google, OpenAI) is overloaded or if the API key is restricted. Please check your settings or try again.';
            outputChannel.appendLine(`\n\n---\n**Notice:** ${errorMsg}`);
            vscode.window.showWarningMessage(`BackBrain: ${errorMsg}`);
            logger.warn('Issue explained but response was empty', { ruleId: issue.ruleId });
        } else {
            logger.info('Issue explained successfully (streaming)', {
                ruleId: issue.ruleId,
                responseLength: fullResponse.length,
            });
        }
    } catch (error) {
        const provider = getActiveProvider() || 'unknown';
        const errorDetail = extractErrorMessage(error);
        logger.error('Failed to explain issue (streaming)', { error, provider });

        outputChannel.appendLine(`\n\n---\n**Error using ${provider}:** ${errorDetail}`);

        let toastMsg = `AI explanation failed (${provider}): ${errorDetail}`;

        if (errorDetail.includes('429') || errorDetail.toLowerCase().includes('quota')) {
            toastMsg = `AI Provider (${provider}) Quota Exceeded. Please check your plan or try again later.`;
        } else if (errorDetail.includes('404')) {
            toastMsg = `AI Provider (${provider}) Model Not Found. Your model name might be incorrect.`;
        }

        vscode.window.showErrorMessage(toastMsg);
    }
}

/**
 * Explain issue without streaming (shows in new document)
 */
async function explainWithoutStreaming(issue: SecurityIssue, codeContext?: string): Promise<void> {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'BackBrain AI',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Generating explanation...' });

            try {
                const explanation = await explainIssueWithCache(issue, codeContext);

                // Show explanation in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: `# AI Explanation: ${issue.title}\n\n${explanation}`,
                    language: 'markdown',
                });
                await vscode.window.showTextDocument(doc, {
                    preview: true,
                    viewColumn: vscode.ViewColumn.Beside,
                });

                logger.info('Issue explained successfully', { ruleId: issue.ruleId });
            } catch (error) {
                const provider = getActiveProvider() || 'unknown';
                const errorDetail = extractErrorMessage(error);
                logger.error('Failed to explain issue', { error, provider });

                let toastMsg = `AI explanation failed (${provider}): ${errorDetail}`;

                if (errorDetail.includes('429') || errorDetail.toLowerCase().includes('quota')) {
                    toastMsg = `AI Provider (${provider}) Quota Exceeded. Please check your plan or try again later.`;
                } else if (errorDetail.includes('404')) {
                    toastMsg = `AI Provider (${provider}) Model Not Found. Your model name might be incorrect.`;
                }

                vscode.window.showErrorMessage(toastMsg);
            }
        }
    );
}
/**
 * Extract a user-friendly error message from potentially complex/nested AI error objects
 */
function extractErrorMessage(error: any): string {
    if (!error) return 'Unknown error';

    // 1. Handle string errors
    if (typeof error === 'string') return error;

    // 2. Handle AI_RetryError (contains a list of errors)
    if (error.name === 'AI_RetryError' && Array.isArray(error.errors) && error.errors.length > 0) {
        return extractErrorMessage(error.errors[error.errors.length - 1]);
    }

    // 3. Check for status codes directly (often on AI_APICallError)
    const statusCode = error.statusCode || error.status || error.data?.error?.code;
    if (statusCode === 429) return 'Quota exceeded (Rate limit reached). Please check your plan or try again later.';
    if (statusCode === 404) return 'Model not found. Please verify the model name in settings.';

    // 4. Handle AI_APICallError or similar SDK errors with data
    if (error.data?.error?.message) {
        return error.data.error.message;
    }

    // 5. Handle response bodies that might contain error JSON
    if (error.responseBody) {
        try {
            const parsed = JSON.parse(error.responseBody);
            if (parsed.error?.message) return parsed.error.message;
        } catch {
            // Not JSON or no message, continue
        }
    }

    // 6. Handle standard Error objects or objects with message property
    if (error.message) return error.message;

    // 7. Fallback to stringified object
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

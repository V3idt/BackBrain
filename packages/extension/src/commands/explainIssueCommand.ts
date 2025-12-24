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

        logger.info('Issue explained successfully (streaming)', {
            ruleId: issue.ruleId,
            responseLength: fullResponse.length,
        });
    } catch (error) {
        logger.error('Failed to explain issue (streaming)', { error });
        outputChannel.appendLine(`\n\n---\n**Error:** ${error instanceof Error ? error.message : 'Unknown error'}`);
        vscode.window.showErrorMessage(
            `Failed to explain issue: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
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
                logger.error('Failed to explain issue', { error });
                vscode.window.showErrorMessage(
                    `Failed to explain issue: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }
    );
}

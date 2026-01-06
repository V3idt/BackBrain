/**
 * Suggest Fix Command
 * 
 * Uses AI to suggest a fix for a security issue.
 * Refactored to use shared adapter factory with caching, fallback, and rate limiting.
 */

import * as vscode from 'vscode';
import { createLogger, type SecurityIssue, type SecurityFix } from '@backbrain/core';
import { getCurrentIssue } from './explainIssueCommand';
import {
    suggestFixWithCache,
    isRateLimited,
    getRateLimitCooldown,
    showAIUnavailableMessage,
    getOrCreateAIAdapter,
    getActiveProvider,
} from '../services/ai-adapter-factory';

const logger = createLogger('SuggestFixCommand');

/**
 * Show a diff preview of the suggested fix
 */
async function showFixDiff(issue: SecurityIssue, fix: SecurityFix): Promise<boolean> {
    if (!fix.replacement || !issue.filePath) {
        // Show fix as markdown if no replacement code
        const doc = await vscode.workspace.openTextDocument({
            content: `# AI Suggested Fix: ${issue.title}\n\n## Description\n${fix.description}\n\n## Suggestion\n\`\`\`\n${fix.replacement || 'No code replacement available'}\n\`\`\``,
            language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside,
        });
        return false;
    }

    // Create a virtual document showing the diff
    const doc = await vscode.workspace.openTextDocument({
        content: `# AI Suggested Fix: ${issue.title}

## ${fix.description}

### Original Code (Line ${issue.line})
\`\`\`
${fix.original || issue.snippet || 'N/A'}
\`\`\`

### Suggested Fix
\`\`\`
${fix.replacement}
\`\`\`

---
${fix.autoFixable ? '✅ This fix is safe to auto-apply.' : '⚠️ Please review this fix carefully before applying.'}

To apply this fix:
1. Open the file: ${issue.filePath}
2. Go to line ${issue.line}
3. Replace the problematic code with the suggested fix above
`,
        language: 'markdown',
    });

    await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside,
    });

    return fix.autoFixable;
}

/**
 * Register the suggestFix command
 */
export function registerSuggestFixCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('backbrain.suggestFix', async (issueArg?: SecurityIssue, options?: { silent?: boolean }) => {
        const issue = issueArg || getCurrentIssue();

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

        logger.info('Suggesting fix', { ruleId: issue.ruleId });

        // Check AI availability first
        const adapter = await getOrCreateAIAdapter();
        if (!adapter) {
            showAIUnavailableMessage();
            return;
        }

        // Show progress
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'BackBrain AI',
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: 'Analyzing issue...' });

                try {
                    // Get additional code context if file is available
                    let codeContext: string | undefined;
                    if (issue.filePath) {
                        try {
                            const fileUri = vscode.Uri.file(issue.filePath);
                            const document = await vscode.workspace.openTextDocument(fileUri);

                            // Get surrounding lines for context (configurable)
                            const contextLines = context.globalState.get<number>('backbrain.ai.contextLines', 15);
                            const startLine = Math.max(0, issue.line - contextLines);
                            const endLine = Math.min(document.lineCount - 1, issue.line + contextLines);
                            const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
                            codeContext = document.getText(range);
                        } catch (e) {
                            logger.debug('Could not read file for context', { error: e });
                        }
                    }

                    progress.report({ message: 'Generating fix suggestion...' });

                    // Get the fix suggestion (uses cache and fallback)
                    const fix = await suggestFixWithCache(issue, codeContext);

                    // Show the diff preview only if not silent
                    if (!options?.silent) {
                        await showFixDiff(issue, fix);
                    }

                    logger.info('Fix suggested successfully', {
                        ruleId: issue.ruleId,
                        autoFixable: fix.autoFixable,
                    });

                    return fix;

                } catch (error) {
                    const provider = getActiveProvider() || 'unknown';
                    const errorDetail = extractErrorMessage(error);
                    logger.error('Failed to suggest fix', { error, provider });

                    let toastMsg = `AI fix suggestion failed (${provider}): ${errorDetail}`;

                    if (errorDetail.includes('429') || errorDetail.toLowerCase().includes('quota')) {
                        toastMsg = `AI Provider (${provider}) Quota Exceeded. Please check your plan or try again later.`;
                    } else if (errorDetail.includes('404')) {
                        toastMsg = `AI Provider (${provider}) Model Not Found. Your model name might be incorrect.`;
                    }

                    vscode.window.showErrorMessage(toastMsg);
                    return undefined;
                }
            }
        );
    });
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

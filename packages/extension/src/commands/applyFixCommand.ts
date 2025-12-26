/**
 * Apply Fix Command
 * 
 * Applies AI-suggested or rule-based fixes to code.
 * Integrates with AutoFixService and tracks sessions for revert.
 */

import * as vscode from 'vscode';
import {
    createLogger,
    applyFixes,
    formatSummary,
    type CodeIssue,
    type CodeFix,
} from '@backbrain/core';
import { getFixHistoryService } from '../services/fix-history-service';

const logger = createLogger('ApplyFixCommand');

/**
 * Convert SecurityIssue + SecurityFix to CodeIssue format expected by AutoFixService
 */
function toCodeIssue(
    issue: { ruleId: string; title: string; description: string; severity: string; filePath: string; line: number; column?: number; snippet?: string },
    fix: { description: string; replacement: string; original?: string; autoFixable: boolean }
): CodeIssue {
    const codeFix: CodeFix = {
        description: fix.description,
        replacement: fix.replacement,
        original: fix.original,
        autoFixable: fix.autoFixable,
    };

    return {
        id: `${issue.ruleId}-${issue.filePath}-${issue.line}`,
        title: issue.title,
        description: issue.description,
        severity: issue.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        location: {
            filePath: issue.filePath,
            line: issue.line,
            column: issue.column || 1,
        },
        suggestedFix: codeFix,
        type: 'security_vulnerability',
        category: 'logic',
    };
}

/**
 * Register the applyFix command
 */
export function registerApplyFixCommand(_context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand(
        'backbrain.applyFix',
        async (issueData?: unknown, fixData?: unknown) => {
            // Validate inputs
            if (!issueData || typeof issueData !== 'object' || !fixData || typeof fixData !== 'object') {
                vscode.window.showWarningMessage('Invalid fix data provided.');
                return;
            }

            const issue = issueData as { ruleId: string; title: string; description: string; severity: string; filePath: string; line: number; column?: number; snippet?: string };
            const fix = fixData as { description: string; replacement: string; original?: string; autoFixable: boolean };

            // Ensure required fields exist
            if (!issue.ruleId || !issue.filePath || !issue.line || !fix.replacement) {
                vscode.window.showWarningMessage('Incomplete fix data.');
                return;
            }

            logger.info('Applying fix', { ruleId: issue.ruleId, file: issue.filePath });

            // Convert to CodeIssue
            const codeIssue = toCodeIssue(issue, fix);

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'BackBrain',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: 'Applying fix...' });

                    try {
                        // Apply the fix
                        const { summary, sessionId } = await applyFixes([codeIssue], {
                            safeOnly: false,
                            dryRun: false,
                        });

                        if (summary.fixed > 0) {
                            // Record in history for revert
                            const historyService = getFixHistoryService();
                            await historyService.recordSession(sessionId, summary, [issue.filePath]);

                            // Show success with revert option
                            const result = await vscode.window.showInformationMessage(
                                `✓ ${formatSummary(summary)}`,
                                'Revert',
                                'View File'
                            );

                            if (result === 'Revert') {
                                await vscode.commands.executeCommand('backbrain.revertFix', sessionId);
                            } else if (result === 'View File') {
                                const doc = await vscode.workspace.openTextDocument(issue.filePath);
                                await vscode.window.showTextDocument(doc);
                            }
                        } else if (summary.failed > 0) {
                            const error = summary.fixes[0]?.error || 'Unknown error';
                            vscode.window.showErrorMessage(`Fix failed: ${error}`);
                        }

                        logger.info('Fix applied', { sessionId, summary: formatSummary(summary) });
                    } catch (error) {
                        logger.error('Failed to apply fix', { error });
                        vscode.window.showErrorMessage(
                            `Failed to apply fix: ${error instanceof Error ? error.message : 'Unknown error'}`
                        );
                    }
                }
            );
        }
    );
}

/**
 * Apply fix with preview confirmation
 */
export async function applyFixWithPreview(
    issue: { ruleId: string; title: string; description: string; severity: string; filePath: string; line: number; snippet?: string },
    fix: { description: string; replacement: string; original?: string; autoFixable: boolean }
): Promise<boolean> {
    // Show confirmation dialog
    const choice = await vscode.window.showInformationMessage(
        `Apply fix: ${fix.description}?`,
        { modal: true },
        'Apply',
        'Cancel'
    );

    if (choice !== 'Apply') {
        return false;
    }

    await vscode.commands.executeCommand('backbrain.applyFix', issue, fix);
    return true;
}

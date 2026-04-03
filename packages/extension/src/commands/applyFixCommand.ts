/**
 * Apply Fix Command
 * 
 * Applies AI-suggested or rule-based fixes to code.
 * Integrates with AutoFixService and tracks sessions for revert.
 */

import * as vscode from 'vscode';
import {
    createLogger,
    formatSummary,
    type CodeIssue,
    type CodeFix,
    type FixSummary,
} from '@backbrain/core';
import { getFixHistoryService } from '../services/fix-history-service';
import { clearFixPreview, getFixPreview } from './suggestFixCommand';

const logger = createLogger('ApplyFixCommand');

function buildSingleFixSummary(
    issue: { ruleId: string; title: string; description: string; severity: string; filePath: string; line: number; column?: number; snippet?: string },
    fix: { description: string; replacement: string; original?: string; autoFixable: boolean }
): FixSummary {
    const codeFix: CodeFix = {
        description: fix.description,
        replacement: fix.replacement,
        original: fix.original,
        autoFixable: fix.autoFixable,
    };

    const codeIssue: CodeIssue = {
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

    return {
        totalIssues: 1,
        fixed: 1,
        skipped: 0,
        failed: 0,
        fixes: [{
            issue: codeIssue,
            applied: true,
        }],
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

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'BackBrain',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: 'Applying fix...' });

                    try {
                        const preview = getFixPreview(issue.filePath);
                        if (!preview) {
                            throw new Error('No fix preview available. Generate the fix preview before applying.');
                        }

                        const previewDocument = await vscode.workspace.openTextDocument(preview.previewUri);
                        const targetUri = vscode.Uri.file(issue.filePath);
                        const targetDocumentBeforeEdit = await vscode.workspace.openTextDocument(targetUri);
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            0,
                            0,
                            Math.max(0, targetDocumentBeforeEdit.lineCount - 1),
                            targetDocumentBeforeEdit.lineCount > 0 ? targetDocumentBeforeEdit.lineAt(targetDocumentBeforeEdit.lineCount - 1).text.length : 0,
                        );

                        edit.replace(targetUri, fullRange, previewDocument.getText());
                        const applied = await vscode.workspace.applyEdit(edit);
                        if (!applied) {
                            throw new Error('VS Code failed to apply the fix to the file.');
                        }

                        const document = await vscode.workspace.openTextDocument(targetUri);
                        await document.save();

                        const summary = buildSingleFixSummary(issue, fix);
                        const sessionId = `session-${Date.now()}`;

                        if (summary.fixed > 0) {
                            await clearFixPreview(issue.filePath);
                            await vscode.window.showTextDocument(document, {
                                preview: false,
                                preserveFocus: false,
                            });

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

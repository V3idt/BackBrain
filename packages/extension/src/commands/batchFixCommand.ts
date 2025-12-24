/**
 * Batch Fix Command
 * 
 * Applies all auto-fixable issues in one session.
 */

import * as vscode from 'vscode';
import {
    createLogger,
    applyFixes,
    formatSummary,
    type CodeIssue,
} from '@backbrain/core';
import { getFixHistoryService } from '../services/fix-history-service';

const logger = createLogger('BatchFixCommand');

/**
 * Register the batchFix command
 */
export function registerBatchFixCommand(_context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('backbrain.batchFix', async (issuesArg?: CodeIssue[]) => {
        // If issues are passed directly, use them. Otherwise, we can't proceed safely without state.
        // The panel should pass the issues in the command arguments.

        if (!issuesArg || !Array.isArray(issuesArg) || issuesArg.length === 0) {
            vscode.window.showInformationMessage('No issues provided for batch fix.');
            return;
        }

        const issues = issuesArg;

        // Filter to only auto-fixable
        const fixableIssues = issues.filter(i => i.suggestedFix?.autoFixable);

        if (fixableIssues.length === 0) {
            vscode.window.showInformationMessage('No auto-fixable issues found.');
            return;
        }

        logger.info('Starting batch fix', { count: fixableIssues.length });

        // User requested: "it should just apply the fixes but then show the changes it made in the sidepanel"
        // We skip the modal confirmation and go straight to applying.
        // The summary notification at the end serves as the "show changes" part.

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'BackBrain',
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: `Applying ${fixableIssues.length} fixes...` });

                try {
                    const { summary, sessionId } = await applyFixes(fixableIssues, {
                        safeOnly: true, // Only apply safe fixes
                        dryRun: false,
                    });

                    if (summary.fixed > 0) {
                        // Get unique files that were modified
                        const files = [...new Set(fixableIssues.map(i => i.location.filePath))];

                        // Record in history
                        const historyService = getFixHistoryService();
                        await historyService.recordSession(sessionId, summary, files);

                        // Show result with revert option
                        const result = await vscode.window.showInformationMessage(
                            `✓ ${formatSummary(summary)}`,
                            'Revert All',
                            'OK'
                        );

                        if (result === 'Revert All') {
                            await vscode.commands.executeCommand('backbrain.revertFix', sessionId);
                        }
                    } else {
                        vscode.window.showWarningMessage('No fixes were applied.');
                    }

                    logger.info('Batch fix complete', { sessionId, summary: formatSummary(summary) });
                } catch (error) {
                    logger.error('Batch fix failed', { error });
                    vscode.window.showErrorMessage(
                        `Batch fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                }
            }
        );
    });
}

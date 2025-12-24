/**
 * Revert Fix Command
 * 
 * Reverts a previously applied fix session.
 */

import * as vscode from 'vscode';
import { createLogger, revertFixes } from '@backbrain/core';
import { getFixHistoryService } from '../services/fix-history-service';

const logger = createLogger('RevertFixCommand');

/**
 * Register the revertFix command
 */
export function registerRevertFixCommand(_context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand(
        'backbrain.revertFix',
        async (sessionId?: string) => {
            const historyService = getFixHistoryService();

            // If no session ID provided, use the last revertable session
            if (!sessionId) {
                const lastSession = historyService.getLastRevertableSession();
                if (!lastSession) {
                    vscode.window.showInformationMessage('No fixes to revert.');
                    return;
                }
                sessionId = lastSession.sessionId;
            }

            const session = historyService.getSession(sessionId);
            if (!session) {
                vscode.window.showErrorMessage(`Session not found: ${sessionId}`);
                return;
            }

            if (session.reverted) {
                vscode.window.showInformationMessage('This fix has already been reverted.');
                return;
            }

            logger.info('Reverting fix session', { sessionId });

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'BackBrain',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: 'Reverting changes...' });

                    try {
                        const result = await revertFixes(sessionId!);

                        if (result.ok) {
                            // Mark as reverted in history
                            await historyService.markReverted(sessionId!);

                            vscode.window.showInformationMessage(
                                `✓ Reverted ${result.value} file(s)`
                            );

                            // Refresh any open documents
                            for (const file of session.files) {
                                const uri = vscode.Uri.file(file);
                                const doc = vscode.workspace.textDocuments.find(
                                    d => d.uri.fsPath === uri.fsPath
                                );
                                if (doc) {
                                    // Force reload by closing and reopening
                                    await vscode.commands.executeCommand(
                                        'workbench.action.files.revert',
                                        uri
                                    );
                                }
                            }

                            logger.info('Revert successful', { sessionId, files: result.value });
                        } else {
                            vscode.window.showErrorMessage(`Revert failed: ${result.error}`);
                            logger.error('Revert failed', { sessionId, error: result.error });
                        }
                    } catch (error) {
                        logger.error('Failed to revert', { error });
                        vscode.window.showErrorMessage(
                            `Failed to revert: ${error instanceof Error ? error.message : 'Unknown error'}`
                        );
                    }
                }
            );
        }
    );
}

/**
 * Show revert confirmation dialog
 */
export async function confirmRevert(sessionId: string): Promise<boolean> {
    const historyService = getFixHistoryService();
    const session = historyService.getSession(sessionId);

    if (!session) {
        return false;
    }

    const filesCount = session.files.length;
    const choice = await vscode.window.showWarningMessage(
        `Revert ${session.summary.fixed} fix(es) in ${filesCount} file(s)?`,
        { modal: true },
        'Revert',
        'Cancel'
    );

    return choice === 'Revert';
}

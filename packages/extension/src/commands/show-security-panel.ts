import * as vscode from 'vscode';
import { createLogger } from '@backbrain/core';

const logger = createLogger('ShowSecurityPanel');

export async function showSecurityPanelCommand() {
  logger.info('Showing security panel');

  try {
    // TODO: Implement webview panel in Phase 8
    vscode.window.showInformationMessage('Security Panel (coming soon)');
  } catch (error) {
    logger.error('Failed to show security panel', { error });
    vscode.window.showErrorMessage(`Failed to open Security Panel: ${error}`);
  }
}

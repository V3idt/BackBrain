import * as vscode from 'vscode';
import { createLogger } from '@backbrain/core';
import { SeverityPanelProvider } from '../views/severity-panel-provider';

const logger = createLogger('ScanWorkspace');

interface CommandContext {
  severityPanelProvider: SeverityPanelProvider;
}

export async function scanWorkspaceCommand(ctx: CommandContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  logger.info('Scanning workspace', { folders: workspaceFolders.length });

  try {
    await ctx.severityPanelProvider.startWorkspaceScan();
  } catch (error) {
    logger.error('Workspace scan failed', { error });
    vscode.window.showErrorMessage(`Workspace scan failed: ${error}`);
  }
}

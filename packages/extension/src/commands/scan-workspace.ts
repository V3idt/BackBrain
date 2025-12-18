import * as vscode from 'vscode';
import type { FileSystem, SecurityService } from '@backbrain/core';
import { createLogger } from '@backbrain/core';

const logger = createLogger('ScanWorkspace');

interface CommandContext {
  fileSystem: FileSystem;
  securityService: SecurityService;
}

export async function scanWorkspaceCommand(_ctx: CommandContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  logger.info('Scanning workspace', { folders: workspaceFolders.length });

  try {
    // TODO: Integrate with SecurityService for workspace scanning
    vscode.window.showInformationMessage(`Scanning ${workspaceFolders.length} workspace folder(s)...`);
  } catch (error) {
    logger.error('Workspace scan failed', { error });
    vscode.window.showErrorMessage(`Workspace scan failed: ${error}`);
  }
}

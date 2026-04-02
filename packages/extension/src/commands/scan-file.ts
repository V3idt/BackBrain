import * as vscode from 'vscode';
import type { FileSystem, SecurityService, CodeIssue } from '@backbrain/core';
import { createLogger } from '@backbrain/core';

const logger = createLogger('ScanFile');

import { SeverityPanelProvider } from '../views/severity-panel-provider';

interface CommandContext {
  fileSystem: FileSystem;
  securityService: SecurityService;
  severityPanelProvider: SeverityPanelProvider;
}

export async function scanFileCommand(ctx: CommandContext, uri?: vscode.Uri) {
  // Use provided URI (explorer context) or fallback to active editor
  const targetUri = uri || vscode.window.activeTextEditor?.document.uri;

  if (!targetUri) {
    vscode.window.showWarningMessage('No file selected to scan');
    return;
  }

  if (targetUri.scheme !== 'file') {
    logger.debug('Skipping scan for non-file URI', { scheme: targetUri.scheme, uri: targetUri.toString() });
    return;
  }

  const filePath = targetUri.fsPath;
  logger.info('Scanning file', { filePath });

  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "BackBrain: Scanning file...",
      cancellable: false
    }, async (_progress) => {
      const content = await ctx.fileSystem.readFile(filePath);
      const result = await ctx.securityService.scanFile(filePath, content);

      // Update the Severity Panel with the new results
      ctx.severityPanelProvider.showIssues(result.issues);

      const critical = result.issues.filter((i: CodeIssue) => i.severity === 'critical').length;
      const high = result.issues.filter((i: CodeIssue) => i.severity === 'high').length;
      const total = result.issues.length;

      if (total === 0) {
        vscode.window.showInformationMessage('BackBrain: No issues found');
      } else {
        // Less intrusive information message, focus the panel
        vscode.window.showInformationMessage(
          `BackBrain: Found ${total} issue(s) (${critical} critical, ${high} high). Details in Severity Panel.`
        );
      }

      logger.info('Scan complete', { total, critical, high });
    });
  } catch (error) {
    logger.error('Scan failed', { error });
    vscode.window.showErrorMessage(`BackBrain: Scan failed: ${error}`);
  }
}

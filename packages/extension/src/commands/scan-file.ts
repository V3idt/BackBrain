import * as vscode from 'vscode';
import type { FileSystem, SecurityService, CodeIssue } from '@backbrain/core';
import { createLogger } from '@backbrain/core';

const logger = createLogger('ScanFile');

interface CommandContext {
  fileSystem: FileSystem;
  securityService: SecurityService;
}

export async function scanFileCommand(ctx: CommandContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active file to scan');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  logger.info('Scanning file', { filePath });

  try {
    const content = await ctx.fileSystem.readFile(filePath);
    const result = await ctx.securityService.scanFile(filePath, content);

    const critical = result.issues.filter((i: CodeIssue) => i.severity === 'critical').length;
    const high = result.issues.filter((i: CodeIssue) => i.severity === 'high').length;
    const total = result.issues.length;

    if (total === 0) {
      vscode.window.showInformationMessage('✓ No issues found');
    } else {
      vscode.window.showWarningMessage(
        `Found ${total} issue(s): ${critical} critical, ${high} high`
      );
    }

    logger.info('Scan complete', { total, critical, high });
  } catch (error) {
    logger.error('Scan failed', { error });
    vscode.window.showErrorMessage(`Scan failed: ${error}`);
  }
}

import * as vscode from 'vscode';
import type { FileSystem, SecurityService } from '@backbrain/core';
import { scanFileCommand } from './scan-file';
import { scanWorkspaceCommand } from './scan-workspace';
import { showSecurityPanelCommand } from './show-security-panel';

import { SeverityPanelProvider } from '../views/severity-panel-provider';

interface CommandContext {
  fileSystem: FileSystem;
  securityService: SecurityService;
  severityPanelProvider: SeverityPanelProvider;
}

export function registerCommands(context: vscode.ExtensionContext, ctx: CommandContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('backbrain.scanFile', (uri?: vscode.Uri) => scanFileCommand(ctx, uri)),
    vscode.commands.registerCommand('backbrain.scanWorkspace', () => scanWorkspaceCommand(ctx)),
    vscode.commands.registerCommand('backbrain.showSecurityPanel', () => showSecurityPanelCommand())
  );
}

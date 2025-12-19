import * as vscode from 'vscode';
import { createLogger, ProviderRegistry, SecurityService, DEFAULT_SCANNERS } from '@backbrain/core';
import { registerCommands } from './commands';
import { VSCodeFileSystem } from './adapters/vscode-filesystem';
import { initVSCodeLogging } from './logger-vscode';
import { SeverityPanelProvider } from './views/severity-panel-provider';

const logger = createLogger('Extension');

export async function activate(context: vscode.ExtensionContext) {
  // 1. Initialize VS Code specific logging immediately
  initVSCodeLogging(context);

  logger.info('BackBrain extension activating');

  try {
    // 2. Initialize independent components in parallel
    const fileSystem = new VSCodeFileSystem();
    const registry = new ProviderRegistry();

    // Register scanners automatically from core
    const scanners = DEFAULT_SCANNERS.map(s => s.scanner);

    // We can run these setup steps together
    await Promise.all([
      (async () => {
        DEFAULT_SCANNERS.forEach(({ name, scanner }) => {
          registry.register('scanner', name, scanner);
          logger.debug(`Registered scanner: ${name}`);
        });
      })(),
      (async () => {
        const securityService = new SecurityService(scanners);
        // Register commands
        registerCommands(context, { fileSystem, securityService });
      })(),
      (async () => {
        // Register Severity Panel
        const severityPanelProvider = new SeverityPanelProvider(context.extensionUri);
        context.subscriptions.push(
          vscode.window.registerWebviewViewProvider(SeverityPanelProvider.viewType, severityPanelProvider)
        );
      })()
    ]);

    logger.info('BackBrain extension activated successfully');
  } catch (error) {
    logger.error('Failed to activate BackBrain extension', { error });

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Semgrep')) {
      vscode.window.showErrorMessage('BackBrain: Semgrep not found. Please ensure Semgrep is installed and in your PATH.', 'View Instructions').then(selection => {
        if (selection === 'View Instructions') {
          vscode.env.openExternal(vscode.Uri.parse('https://semgrep.dev/docs/getting-started/'));
        }
      });
    } else {
      vscode.window.showErrorMessage(`BackBrain failed to initialize: ${message}. Check the Output panel for details.`);
    }
  }
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
  logger.info('BackBrain extension deactivating');
}

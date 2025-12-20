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
    // 2. Initialize independent components
    const fileSystem = new VSCodeFileSystem();
    const registry = new ProviderRegistry();

    // Register scanners automatically from core
    let registeredScannerCount = 0;
    try {
      DEFAULT_SCANNERS.forEach(({ name, scanner }) => {
        try {
          registry.register('scanner', name, scanner);
          registeredScannerCount++;
          logger.debug(`Registered scanner: ${name}`);
        } catch (err) {
          logger.error(`Failed to register scanner: ${name}`, { error: err });
        }
      });

      if (registeredScannerCount === 0) {
        vscode.window.showWarningMessage('BackBrain: No security scanners were registered. Scanning features will be unavailable.');
      }
    } catch (err) {
      logger.error('Unexpected error during scanner registration', { error: err });
    }

    // Create security service
    const scanners = DEFAULT_SCANNERS.map(s => s.scanner);
    const securityService = new SecurityService(scanners);

    // Track UI initialization success
    let commandsInitialized = false;
    let panelInitialized = false;

    // Run setup steps in parallel
    await Promise.all([
      (async () => {
        try {
          // Register commands
          registerCommands(context, { fileSystem, securityService });
          commandsInitialized = true;
        } catch (err) {
          logger.error('Failed to register commands', { error: err });
        }
      })(),
      (async () => {
        try {
          // Register Severity Panel with SecurityService
          const severityPanelProvider = new SeverityPanelProvider(context.extensionUri, securityService);
          context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(SeverityPanelProvider.viewType, severityPanelProvider)
          );
          panelInitialized = true;
        } catch (err) {
          logger.error('Failed to register Severity Panel', { error: err });
        }
      })()
    ]);

    // Check if we have at least one functional UI path
    if (!commandsInitialized && !panelInitialized) {
      throw new Error('Failed to initialize both commands and the Severity Panel. The extension is non-functional.');
    } else if (!commandsInitialized) {
      vscode.window.showWarningMessage('BackBrain: Command registration failed. Some features may be limited.');
    } else if (!panelInitialized) {
      vscode.window.showWarningMessage('BackBrain: Severity Panel failed to initialize.');
    }

    logger.info('BackBrain extension activated successfully');
  } catch (error) {
    logger.error('Critical failure during BackBrain activation', { error });

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
  // Add cleanup logic here as needed (e.g., disposing of file watchers)
}

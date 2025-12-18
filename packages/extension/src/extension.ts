import * as vscode from 'vscode';
import { createLogger, ProviderRegistry, SecurityService, DEFAULT_SCANNERS } from '@backbrain/core';
import { registerCommands } from './commands';
import { VSCodeFileSystem } from './adapters/vscode-filesystem';
import { initVSCodeLogging } from './logger-vscode';

const logger = createLogger('Extension');

export async function activate(context: vscode.ExtensionContext) {
  // 1. Initialize VS Code specific logging immediately
  initVSCodeLogging(context);

  logger.info('BackBrain extension activating');

  try {
    const fileSystem = new VSCodeFileSystem();
    const registry = new ProviderRegistry();

    // 2. Register scanners automatically from core
    const scanners = DEFAULT_SCANNERS.map(s => s.scanner);
    DEFAULT_SCANNERS.forEach(({ name, scanner }) => {
      registry.register('scanner', name, scanner);
      logger.debug(`Registered scanner: ${name}`);
    });

    const securityService = new SecurityService(scanners);

    // 3. Register commands
    registerCommands(context, { fileSystem, securityService });

    logger.info('BackBrain extension activated successfully');
  } catch (error) {
    logger.error('Failed to activate BackBrain extension', { error });
    vscode.window.showErrorMessage('BackBrain failed to initialize. Check the Output panel for details.');
  }
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
  logger.info('BackBrain extension deactivating');
}

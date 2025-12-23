import * as vscode from 'vscode';
import { createLogger, ProviderRegistry, SecurityService, DEFAULT_SCANNERS, SemgrepScanner, VibeCodeScanner } from '@backbrain/core';
import { registerCommands } from './commands';
import { VSCodeFileSystem } from './adapters/vscode-filesystem';
import { initVSCodeLogging } from './logger-vscode';
import { SeverityPanelProvider } from './views/severity-panel-provider';
import { SemgrepInstaller } from './utils/semgrep-installer';
import { VibeRuleLoader } from './utils/vibe-rule-loader';

const logger = createLogger('Extension');

export async function activate(context: vscode.ExtensionContext) {
  // 1. Initialize VS Code specific logging immediately
  initVSCodeLogging(context);

  logger.info('BackBrain extension activating');

  try {
    // 2. Initialize independent components
    const fileSystem = new VSCodeFileSystem();
    const registry = new ProviderRegistry();
    const installer = new SemgrepInstaller(context);

    // Check Semgrep availability
    let semgrepPath = '';
    const isSemgrepAvailable = await installer.isAvailable();

    if (isSemgrepAvailable) {
      semgrepPath = installer.getSemgrepPath();
      logger.info('Semgrep found', { path: semgrepPath });
    } else {
      // Prompt to install
      const selection = await vscode.window.showWarningMessage(
        'BackBrain: Semgrep is missing. Security scanning will be limited.',
        'Install Semgrep',
        'Learn More'
      );

      if (selection === 'Install Semgrep') {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Installing Semgrep...',
          cancellable: false
        }, async () => {
          try {
            await installer.install();
            semgrepPath = installer.getSemgrepPath();
            vscode.window.showInformationMessage('Semgrep installed successfully!');
          } catch (err) {
            logger.error('Failed to install Semgrep', { error: err });
            vscode.window.showErrorMessage('Failed to install Semgrep. Please install it manually.');
          }
        });
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://semgrep.dev/docs/getting-started/'));
      }
    }

    // Register scanners automatically from core
    let registeredScannerCount = 0;
    let vibeScanner: VibeCodeScanner | undefined;

    try {
      DEFAULT_SCANNERS.forEach(({ name, scanner }) => {
        try {
          // Configure Semgrep scanner if path is available
          if (name === 'semgrep' && semgrepPath && scanner instanceof SemgrepScanner) {
            scanner.setBinaryPath(semgrepPath);
          }

          // Capture Vibe scanner for rule updates
          if (name === 'vibe-code' && scanner instanceof VibeCodeScanner) {
            vibeScanner = scanner;
          }

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

    // Load Vibe rules and setup watcher
    if (vibeScanner && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const root = vscode.workspace.workspaceFolders[0]!.uri;
      const scanner = vibeScanner; // Capture for closure

      // Initialize config file if it doesn't exist
      await VibeRuleLoader.initializeConfig(root);

      // Initial load (awaited to prevent race condition)
      try {
        const rules = await VibeRuleLoader.loadRules(root);
        scanner.setRules(rules);
        logger.info(`Loaded ${rules.length} Vibe rules`);
      } catch (err) {
        logger.error('Failed to load initial Vibe rules', { error: err });
        vscode.window.showErrorMessage('BackBrain: Failed to load Vibe rules. Some scanning features may be limited.');
      }

      // Watch for changes
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(root, '.backbrain/vibe-rules.json')
      );

      const reloadRules = async () => {
        logger.info('Reloading Vibe rules...');
        const rules = await VibeRuleLoader.loadRules(root);
        scanner.setRules(rules);
        logger.info(`Reloaded ${rules.length} Vibe rules`);
      };

      watcher.onDidChange(reloadRules);
      watcher.onDidCreate(reloadRules);
      watcher.onDidDelete(reloadRules);
      context.subscriptions.push(watcher);
    }

    // Create security service
    const scanners = DEFAULT_SCANNERS.map(s => s.scanner);
    const securityService = new SecurityService(scanners);

    // Track UI initialization success
    let commandsInitialized = false;
    let panelInitialized = false;

    // Initialize Severity Panel Provider
    const severityPanelProvider = new SeverityPanelProvider(context.extensionUri, securityService);

    // Register UI components
    try {
      // 1. Register commands (now depends on severityPanelProvider)
      registerCommands(context, { fileSystem, securityService, severityPanelProvider });
      commandsInitialized = true;
    } catch (err) {
      logger.error('Failed to register commands', { error: err });
    }

    try {
      // 2. Register Webview Provider
      context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SeverityPanelProvider.viewType, severityPanelProvider)
      );
      panelInitialized = true;
    } catch (err) {
      logger.error('Failed to register Severity Panel', { error: err });
    }

    // Check if we have at least one functional UI path
    if (!commandsInitialized && !panelInitialized) {
      throw new Error('Failed to initialize both commands and the Severity Panel. The extension is non-functional.');
    } else if (!commandsInitialized) {
      const msg = 'BackBrain: Command registration failed. Some features will be unavailable.';
      logger.error(msg);
      vscode.window.showErrorMessage(msg);
    } else if (!panelInitialized) {
      const msg = 'BackBrain: Severity Panel failed to initialize. Security issues will not be visible in the sidebar.';
      logger.error(msg);
      vscode.window.showErrorMessage(msg);
    }

    logger.info('BackBrain extension activated successfully');
  } catch (error) {
    logger.error('Critical failure during BackBrain activation', { error });

    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`BackBrain failed to initialize: ${message}. Check the Output panel for details.`);
  }
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
  logger.info('BackBrain extension deactivating');
  // Add cleanup logic here as needed (e.g., disposing of file watchers)
}

import * as vscode from 'vscode';
import { getLogger, type LogEntry } from '@backbrain/core';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Initialize the VS Code output channel and link it to the core logger.
 */
export function initVSCodeLogging(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('BackBrain');
    context.subscriptions.push(outputChannel);

    const logger = getLogger();

    // Add an output that writes to the VS Code Output Channel
    if ('addOutput' in logger && typeof logger.addOutput === 'function') {
        logger.addOutput((entry: LogEntry) => {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE'];
            const timestamp = entry.timestamp.toISOString();
            const level = levelNames[entry.level] || 'INFO';

            // Only include context for errors or if it's a debug/verbose log
            // This prevents leaking sensitive data in standard INFO logs
            const shouldShowContext = entry.level <= 0 || entry.level >= 3;
            const contextStr = (entry.context && shouldShowContext) ? ` ${JSON.stringify(entry.context)}` : '';

            outputChannel?.appendLine(`[${timestamp}] [${level}] ${entry.message}${contextStr}`);
        });
    }
}

export function getOutputChannel(): vscode.OutputChannel | undefined {
    return outputChannel;
}

import * as vscode from 'vscode';
import { VibeRule, DEFAULT_VIBE_RULES, RuleParser } from '@backbrain/core';
import { createLogger } from '@backbrain/core';

const logger = createLogger('VibeRuleLoader');

export class VibeRuleLoader {
    static async loadRules(workspaceRoot: vscode.Uri): Promise<VibeRule[]> {
        const configUri = vscode.Uri.joinPath(workspaceRoot, '.backbrain', 'vibe-rules.json');

        try {
            const fileData = await vscode.workspace.fs.readFile(configUri);
            const content = Buffer.from(fileData).toString('utf8');

            // Use core parser
            const rules = RuleParser.parseRules(content);

            // Check if parsing returned default rules (which means there was an error)
            // RuleParser logs warnings for invalid rules, but we should notify the user
            if (rules.length === DEFAULT_VIBE_RULES.length && content.trim() !== '') {
                // The file has content but parsing may have failed
                try {
                    JSON.parse(content);
                } catch (jsonError) {
                    vscode.window.showErrorMessage(
                        'Invalid JSON in .backbrain/vibe-rules.json. Using default rules. Please check the file syntax.',
                        'Open File'
                    ).then(selection => {
                        if (selection === 'Open File') {
                            vscode.workspace.openTextDocument(configUri).then(doc => {
                                vscode.window.showTextDocument(doc);
                            });
                        }
                    });
                }
            }

            return rules;

        } catch (error) {
            // It's fine if the file doesn't exist
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                logger.debug('No custom vibe-rules.json found, using defaults');
            } else {
                logger.error('Error loading vibe-rules.json', { error });
                vscode.window.showErrorMessage(
                    `Failed to load .backbrain/vibe-rules.json: ${error instanceof Error ? error.message : 'Unknown error'}. Using default rules.`
                );
            }
            return [...DEFAULT_VIBE_RULES];
        }
    }

    /**
     * Initialize the .backbrain directory with a default vibe-rules.json file
     */
    static async initializeConfig(workspaceRoot: vscode.Uri): Promise<void> {
        const backbrainDir = vscode.Uri.joinPath(workspaceRoot, '.backbrain');
        const configUri = vscode.Uri.joinPath(backbrainDir, 'vibe-rules.json');

        try {
            // Check if file already exists
            await vscode.workspace.fs.stat(configUri);
            logger.debug('.backbrain/vibe-rules.json already exists');
        } catch {
            // File doesn't exist, create it
            logger.info('Creating default .backbrain/vibe-rules.json');

            // Create directory
            try {
                await vscode.workspace.fs.createDirectory(backbrainDir);
            } catch {
                // Directory might already exist, that's fine
            }

            // Create default config file
            const defaultConfig = {
                rules: [
                    {
                        id: "example-custom-rule",
                        title: "Example Custom Rule",
                        description: "This is an example. You can add your own rules here.",
                        severity: "low",
                        type: "regex",
                        pattern: "TODO:"
                    }
                ]
            };

            const content = JSON.stringify(defaultConfig, null, 2);
            await vscode.workspace.fs.writeFile(configUri, Buffer.from(content, 'utf8'));

            logger.info('.backbrain/vibe-rules.json created successfully');
        }
    }
}

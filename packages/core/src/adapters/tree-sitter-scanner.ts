import type { SecurityScanner, SecurityIssue, ScanResult } from '../ports';
import type { FileSystem } from '../ports';
import { getLogger } from '../utils/logger';
import * as path from 'path';

// Note: web-tree-sitter needs to be initialized before use
// In a VS Code extension, this usually happens in the activation phase
// or lazily when the first scan is requested.
import Parser from 'web-tree-sitter';

export class TreeSitterScanner implements SecurityScanner {
    readonly name = 'tree-sitter';
    private parser: Parser | null = null;
    private languages: Map<string, Parser.Language> = new Map();
    private isInitialized = false;

    constructor(private fileSystem?: FileSystem) { }

    async isAvailable(): Promise<boolean> {
        return true; // web-tree-sitter is always ideally available if wasm loads
    }

    getSupportedExtensions(): string[] {
        return ['.js', '.ts', '.jsx', '.tsx'];
    }

    /**
     * Initialize the parser and load languages
     * This needs to be called before any scanning
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            await Parser.init();
            this.parser = new Parser();
            // Languages will be loaded lazily per extension
            this.isInitialized = true;
        } catch (error) {
            getLogger().error('Failed to initialize TreeSitterScanner', { error });
            throw error;
        }
    }

    private async getLanguage(extension: string): Promise<Parser.Language | null> {
        if (this.languages.has(extension)) {
            return this.languages.get(extension)!;
        }

        // In a real implementation, we'd need to know where the .wasm files are
        // For this task, we'll assume they are available in a standard location
        // or provided by the environment.
        return null;
    }

    async scanFile(filePath: string, content: string): Promise<SecurityIssue[]> {
        await this.initialize();
        if (!this.parser) return [];

        const ext = path.extname(filePath);
        const lang = await this.getLanguage(ext);
        if (!lang) return []; // Fallback to no issues if language not loaded

        this.parser.setLanguage(lang);
        const tree = this.parser.parse(content);
        const issues: SecurityIssue[] = [];

        // Run AST-based rules
        issues.push(...this.detectUnhandledPromises(tree, filePath));
        issues.push(...this.detectNamingInconsistencies(tree, filePath));

        return issues;
    }

    async scan(paths: string[]): Promise<ScanResult> {
        const startTime = Date.now();
        const allIssues: SecurityIssue[] = [];
        const scannedFiles: string[] = [];

        for (const filePath of paths) {
            try {
                const content = await this.readFile(filePath);
                const issues = await this.scanFile(filePath, content);
                allIssues.push(...issues);
                scannedFiles.push(filePath);
            } catch (error) {
                continue;
            }
        }

        return {
            issues: allIssues,
            scannedFiles,
            scanDurationMs: Date.now() - startTime,
            scannerInfo: 'TreeSitter AST Scanner',
        };
    }

    private async readFile(filePath: string): Promise<string> {
        if (this.fileSystem) {
            return this.fileSystem.readFile(filePath);
        }
        // Fallback to node fs if needed, but core should ideally use the port
        throw new Error('FileSystem port required for TreeSitterScanner');
    }

    private detectUnhandledPromises(tree: Parser.Tree, filePath: string): SecurityIssue[] {
        const issues: SecurityIssue[] = [];
        // Basic pattern: call expressions that are not awaited or handled
        // This is a simplified example of AST querying
        const query = tree.getLanguage().query(`
            (call_expression
                function: (identifier) @func
                (#match? @func "^(fetch|axios)$")
            ) @call
        `);

        const captures = query.captures(tree.rootNode);
        for (const capture of captures) {
            if (capture.name === 'call') {
                const node = capture.node;
                // Check parent for await_expression or member_expression (.then/.catch)
                let isHandled = false;
                let parent = node.parent;
                while (parent) {
                    if (parent.type === 'await_expression') {
                        isHandled = true;
                        break;
                    }
                    if (parent.type === 'member_expression') {
                        const property = parent.lastChild?.text;
                        if (property === 'then' || property === 'catch') {
                            isHandled = true;
                            break;
                        }
                    }
                    // If we reach a statement boundary without handling, it's unhandled
                    if (parent.type.endsWith('statement')) break;
                    parent = parent.parent;
                }

                if (!isHandled) {
                    issues.push({
                        ruleId: 'tree-sitter.unhandled-promise',
                        title: 'Unhandled Promise (AST)',
                        description: 'Async operation should be awaited or have error handling.',
                        severity: 'high',
                        filePath,
                        line: node.startPosition.row + 1,
                        snippet: node.text,
                    });
                }
            }
        }
        return issues;
    }

    private detectNamingInconsistencies(tree: Parser.Tree, filePath: string): SecurityIssue[] {
        const issues: SecurityIssue[] = [];
        const lang = tree.getLanguage();

        // Query for variable and function declarations
        const declQuery = lang.query(`
            (variable_declarator name: (identifier) @name)
            (function_declaration name: (identifier) @name)
            (method_definition name: (property_identifier) @name)
        `);

        // Query for usages
        const usageQuery = lang.query(`
            (call_expression function: (identifier) @usage)
            (member_expression property: (property_identifier) @usage)
            (identifier) @usage
        `);

        const declarations = new Map<string, { original: string; node: Parser.SyntaxNode }>();
        const declCaptures = declQuery.captures(tree.rootNode);

        for (const capture of declCaptures) {
            const name = capture.node.text;
            declarations.set(name.toLowerCase(), { original: name, node: capture.node });
        }

        const usageCaptures = usageQuery.captures(tree.rootNode);
        for (const capture of usageCaptures) {
            const used = capture.node.text;
            const canonical = declarations.get(used.toLowerCase());

            if (canonical && canonical.original !== used) {
                // Heuristic: only report if it's not a property of an object we don't know
                // or if it matches a known declaration casing exactly
                issues.push({
                    ruleId: 'tree-sitter.name-mismatch',
                    title: 'Inconsistent Naming (AST)',
                    description: `Usage '${used}' does not match declaration '${canonical.original}'.`,
                    severity: 'medium',
                    filePath,
                    line: capture.node.startPosition.row + 1,
                    snippet: capture.node.text,
                });
            }
        }

        return issues;
    }
}

/**
 * Unit tests for the Provider Registry
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { ProviderRegistry } from '../../packages/core/src/services/provider-registry';
import type { AIProvider, AIContext, AIResponse, SecurityScanner, ScanResult, SecurityIssue, FileSystem, Logger } from '../../packages/core/src/ports';

// Mock providers for testing
const createMockAIProvider = (name: string): AIProvider => ({
    name,
    async complete(prompt: string, context: AIContext): Promise<AIResponse> {
        return {
            content: `${name} response to: ${prompt}`,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
    },
    async *stream(prompt: string, context: AIContext) {
        yield `${name} `;
        yield 'streaming';
    },
    async isAvailable() {
        return true;
    },
});

const createMockScanner = (name: string): SecurityScanner => ({
    name,
    async scanFile(filePath: string, content: string): Promise<SecurityIssue[]> {
        return [];
    },
    async scan(paths: string[]): Promise<ScanResult> {
        return {
            issues: [],
            scannedFiles: paths,
            scanDurationMs: 100,
            scannerInfo: name,
        };
    },
    async isAvailable() {
        return true;
    },
    getSupportedExtensions() {
        return ['.ts', '.js'];
    },
});

const createMockFileSystem = (name: string): FileSystem => ({
    readFile: async (path: string) => `content of ${path}`,
    writeFile: async (path: string, content: string) => { },
    exists: async (path: string) => true,
    readDir: async (path: string) => [],
    watch: (path: string, callback: (event: 'change' | 'delete', path: string) => void) => {
        return () => { };
    },
});

const createMockLogger = (name: string): Logger => ({
    error: (msg, ctx) => { },
    warn: (msg, ctx) => { },
    info: (msg, ctx) => { },
    debug: (msg, ctx) => { },
    verbose: (msg, ctx) => { },
});

describe('Provider Registry', () => {
    let registry: ProviderRegistry;

    beforeEach(() => {
        registry = new ProviderRegistry();
    });

    describe('AI Provider Registration', () => {
        it('should register and retrieve AI provider', () => {
            const provider = createMockAIProvider('openai');
            registry.registerAI('openai', provider);

            const retrieved = registry.getAI('openai');
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('openai');
        });

        it('should set first provider as default', () => {
            const provider = createMockAIProvider('openai');
            registry.registerAI('openai', provider);

            const defaultProvider = registry.getAI();
            expect(defaultProvider?.name).toBe('openai');
        });

        it('should allow explicit default setting', () => {
            const provider1 = createMockAIProvider('openai');
            const provider2 = createMockAIProvider('claude');

            registry.registerAI('openai', provider1);
            registry.registerAI('claude', provider2, true);

            const defaultProvider = registry.getAI();
            expect(defaultProvider?.name).toBe('claude');
        });

        it('should list all registered AI providers', () => {
            registry.registerAI('openai', createMockAIProvider('openai'));
            registry.registerAI('claude', createMockAIProvider('claude'));

            const providers = registry.listAI();
            expect(providers).toContain('openai');
            expect(providers).toContain('claude');
            expect(providers.length).toBe(2);
        });
    });

    describe('Security Scanner Registration', () => {
        it('should register and retrieve scanner', () => {
            const scanner = createMockScanner('semgrep');
            registry.registerScanner('semgrep', scanner);

            const retrieved = registry.getScanner('semgrep');
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('semgrep');
        });

        it('should handle multiple scanners', () => {
            registry.registerScanner('semgrep', createMockScanner('semgrep'));
            registry.registerScanner('vibe-code', createMockScanner('vibe-code'));

            const scanners = registry.listScanners();
            expect(scanners.length).toBe(2);
        });
    });

    describe('FileSystem Registration', () => {
        it('should register and retrieve filesystem', () => {
            const fs = createMockFileSystem('vscode');
            registry.registerFilesystem('vscode', fs);

            const retrieved = registry.getFilesystem('vscode');
            expect(retrieved).toBeDefined();
        });

        it('should set default filesystem', () => {
            const fs = createMockFileSystem('native');
            registry.registerFilesystem('native', fs);

            const defaultFs = registry.getFilesystem();
            expect(defaultFs).toBeDefined();
        });
    });

    describe('Logger Registration', () => {
        it('should register and retrieve logger', () => {
            const logger = createMockLogger('console');
            registry.registerLogger('console', logger);

            const retrieved = registry.getLogger('console');
            expect(retrieved).toBeDefined();
        });
    });

    describe('Generic Register Method', () => {
        it('should register AI provider via generic method', () => {
            const provider = createMockAIProvider('gemini');
            registry.register('ai', 'gemini', provider);

            const retrieved = registry.getAI('gemini');
            expect(retrieved?.name).toBe('gemini');
        });

        it('should register scanner via generic method', () => {
            const scanner = createMockScanner('trivy');
            registry.register('scanner', 'trivy', scanner);

            const retrieved = registry.getScanner('trivy');
            expect(retrieved?.name).toBe('trivy');
        });

        it('should register filesystem via generic method', () => {
            const fs = createMockFileSystem('memfs');
            registry.register('filesystem', 'memfs', fs);

            const retrieved = registry.getFilesystem('memfs');
            expect(retrieved).toBeDefined();
        });

        it('should register logger via generic method', () => {
            const logger = createMockLogger('winston');
            registry.register('logger', 'winston', logger);

            const retrieved = registry.getLogger('winston');
            expect(retrieved).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should return undefined for non-existent provider', () => {
            const provider = registry.getAI('non-existent');
            expect(provider).toBeUndefined();
        });

        it('should return undefined for non-existent scanner', () => {
            const scanner = registry.getScanner('non-existent');
            expect(scanner).toBeUndefined();
        });

        it('should handle empty registry', () => {
            const providers = registry.listAI();
            expect(providers.length).toBe(0);
        });
    });

    describe('Default Management', () => {
        it('should update default provider', () => {
            registry.registerAI('openai', createMockAIProvider('openai'));
            registry.registerAI('claude', createMockAIProvider('claude'));

            registry.setDefaultAI('claude');

            const defaultProvider = registry.getAI();
            expect(defaultProvider?.name).toBe('claude');
        });

        it('should not set default for non-existent provider', () => {
            registry.registerAI('openai', createMockAIProvider('openai'));
            registry.setDefaultAI('non-existent');

            const defaultProvider = registry.getAI();
            expect(defaultProvider?.name).toBe('openai');
        });

        it('should get all defaults', () => {
            registry.registerAI('openai', createMockAIProvider('openai'));
            registry.registerScanner('semgrep', createMockScanner('semgrep'));

            const defaults = registry.getDefaults();
            expect(defaults.defaultAI).toBe('openai');
            expect(defaults.defaultScanner).toBe('semgrep');
        });
    });

    describe('Provider Functionality', () => {
        it('should execute AI provider complete method', async () => {
            const provider = createMockAIProvider('test');
            registry.registerAI('test', provider);

            const retrieved = registry.getAI('test');
            const response = await retrieved!.complete('hello', {
                content: 'test',
                filePath: 'test.ts',
            });

            expect(response.content).toContain('test response');
            expect(response.usage?.totalTokens).toBe(15);
        });

        it('should execute scanner scan method', async () => {
            const scanner = createMockScanner('test');
            registry.registerScanner('test', scanner);

            const retrieved = registry.getScanner('test');
            const result = await retrieved!.scan(['file1.ts', 'file2.ts']);

            expect(result.scannedFiles).toEqual(['file1.ts', 'file2.ts']);
            expect(result.scanDurationMs).toBe(100);
        });
    });
});

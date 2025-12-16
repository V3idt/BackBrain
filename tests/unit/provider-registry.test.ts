/**
 * Unit tests for the Provider Registry
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import type { AIProvider, AIContext, AIResponse, SecurityScanner, ScanResult, SecurityIssue } from '../../packages/core/src/ports';

// We need to test the registry in isolation, so we'll create a fresh instance
// For now, test the type system works

describe('Provider Registry Types', () => {
    describe('AIProvider interface', () => {
        it('should type-check a valid AIProvider', () => {
            const mockProvider: AIProvider = {
                name: 'test-provider',
                async complete(prompt: string, context: AIContext): Promise<AIResponse> {
                    return {
                        content: 'test response',
                        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                    };
                },
                async *stream(prompt: string, context: AIContext) {
                    yield 'test';
                    yield 'response';
                },
                async isAvailable() {
                    return true;
                },
            };

            expect(mockProvider.name).toBe('test-provider');
        });
    });

    describe('SecurityScanner interface', () => {
        it('should type-check a valid SecurityScanner', () => {
            const mockScanner: SecurityScanner = {
                name: 'test-scanner',
                async scanFile(filePath: string, content: string): Promise<SecurityIssue[]> {
                    return [];
                },
                async scan(paths: string[]): Promise<ScanResult> {
                    return {
                        issues: [],
                        scannedFiles: paths,
                        scanDurationMs: 100,
                    };
                },
                async isAvailable() {
                    return true;
                },
                getSupportedExtensions() {
                    return ['.ts', '.js'];
                },
            };

            expect(mockScanner.name).toBe('test-scanner');
        });
    });
});

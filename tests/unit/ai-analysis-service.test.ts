/**
 * Tests for AI Analysis Service
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { AIAnalysisService, createAIAnalysisService } from '../../packages/core/src/services/ai-analysis-service';
import type { AIProvider, AIContext, AIResponse, SecurityIssue } from '../../packages/core/src/ports';

/**
 * Mock AI Provider for testing
 */
class MockAIProvider implements AIProvider {
    readonly name = 'mock-provider';
    private mockResponse: string;
    private available: boolean;
    public lastPrompt: string = '';
    public lastContext: AIContext | null = null;

    constructor(mockResponse: string = 'Mock AI response', available: boolean = true) {
        this.mockResponse = mockResponse;
        this.available = available;
    }

    async complete(prompt: string, context: AIContext): Promise<AIResponse> {
        this.lastPrompt = prompt;
        this.lastContext = context;
        return {
            content: this.mockResponse,
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
            },
            model: 'mock-model',
        };
    }

    async *stream(prompt: string, context: AIContext): AsyncIterable<string> {
        this.lastPrompt = prompt;
        this.lastContext = context;
        const words = this.mockResponse.split(' ');
        for (const word of words) {
            yield word + ' ';
        }
    }

    async isAvailable(): Promise<boolean> {
        return this.available;
    }

    setMockResponse(response: string): void {
        this.mockResponse = response;
    }
}

describe('AIAnalysisService', () => {
    let mockProvider: MockAIProvider;
    let service: AIAnalysisService;

    const sampleIssue: SecurityIssue = {
        ruleId: 'test-rule',
        title: 'SQL Injection Vulnerability',
        description: 'User input is directly concatenated into SQL query',
        severity: 'high',
        filePath: '/app/src/database.ts',
        line: 42,
        snippet: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
    };

    beforeEach(() => {
        mockProvider = new MockAIProvider();
        service = new AIAnalysisService(mockProvider);
    });

    describe('explainIssue', () => {
        it('should call the AI provider with issue details', async () => {
            const explanation = await service.explainIssue(sampleIssue);

            expect(explanation).toBe('Mock AI response');
            expect(mockProvider.lastPrompt).toContain('SQL Injection Vulnerability');
            expect(mockProvider.lastPrompt).toContain('high');
            expect(mockProvider.lastPrompt).toContain(sampleIssue.description);
        });

        it('should include code context when provided', async () => {
            const codeContext = 'function getUser(userId) { /* more code */ }';
            await service.explainIssue(sampleIssue, codeContext);

            expect(mockProvider.lastContext?.content).toBe(codeContext);
        });

        it('should use snippet as context if code context is not provided', async () => {
            await service.explainIssue(sampleIssue);

            expect(mockProvider.lastContext?.content).toBe(sampleIssue.snippet);
        });

        it('should track token usage', async () => {
            await service.explainIssue(sampleIssue);

            const usage = service.getTokenUsage();
            expect(usage.promptTokens).toBe(100);
            expect(usage.completionTokens).toBe(50);
            expect(usage.totalTokens).toBe(150);
        });
    });

    describe('explainIssueStream', () => {
        it('should stream the explanation', async () => {
            mockProvider.setMockResponse('This is a streamed response');
            const chunks: string[] = [];

            for await (const chunk of service.explainIssueStream(sampleIssue)) {
                chunks.push(chunk);
            }

            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks.join('')).toContain('This');
        });
    });

    describe('suggestFix', () => {
        it('should parse JSON fix from AI response', async () => {
            const jsonResponse = `
Here is a fix:

\`\`\`json
{
    "description": "Use parameterized query",
    "replacement": "const query = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);",
    "autoFixable": true
}
\`\`\`
`;
            mockProvider.setMockResponse(jsonResponse);

            const fix = await service.suggestFix(sampleIssue);

            expect(fix.description).toBe('Use parameterized query');
            expect(fix.replacement).toContain('db.prepare');
            expect(fix.autoFixable).toBe(true);
        });

        it('should fall back to raw response if JSON parsing fails', async () => {
            // Plain text without code blocks - should give empty replacement
            const rawResponse = 'You should use parameterized queries instead.';
            mockProvider.setMockResponse(rawResponse);

            const fix = await service.suggestFix(sampleIssue);

            // New behavior: clearer description, empty replacement for plain text
            expect(fix.description).toContain('could not generate a structured fix');
            expect(fix.replacement).toBe('');
            expect(fix.autoFixable).toBe(false);
        });

        it('should extract code blocks when JSON parsing fails', async () => {
            // Response with code block but not JSON - should extract the code
            const codeBlockResponse = `
Here's how to fix it:

\`\`\`typescript
const query = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
\`\`\`
`;
            mockProvider.setMockResponse(codeBlockResponse);

            const fix = await service.suggestFix(sampleIssue);

            expect(fix.description).toContain('requires manual review');
            expect(fix.replacement).toContain('db.prepare');
            expect(fix.autoFixable).toBe(false);
        });

        it('should include original snippet in fix', async () => {
            const jsonResponse = `
\`\`\`json
{
    "description": "Fix",
    "replacement": "fixed code",
    "autoFixable": false
}
\`\`\`
`;
            mockProvider.setMockResponse(jsonResponse);

            const fix = await service.suggestFix(sampleIssue);

            expect(fix.original).toBe(sampleIssue.snippet);
        });
    });

    describe('isAvailable', () => {
        it('should return true when provider is available', async () => {
            const available = await service.isAvailable();
            expect(available).toBe(true);
        });

        it('should return false when provider is not available', async () => {
            const unavailableProvider = new MockAIProvider('', false);
            const unavailableService = new AIAnalysisService(unavailableProvider);

            const available = await unavailableService.isAvailable();
            expect(available).toBe(false);
        });
    });

    describe('token usage tracking', () => {
        it('should accumulate token usage across multiple calls', async () => {
            await service.explainIssue(sampleIssue);
            await service.explainIssue(sampleIssue);

            const usage = service.getTokenUsage();
            expect(usage.promptTokens).toBe(200);
            expect(usage.completionTokens).toBe(100);
            expect(usage.totalTokens).toBe(300);
        });

        it('should reset token usage', async () => {
            await service.explainIssue(sampleIssue);
            service.resetTokenUsage();

            const usage = service.getTokenUsage();
            expect(usage.promptTokens).toBe(0);
            expect(usage.totalTokens).toBe(0);
        });
    });

    describe('setProvider', () => {
        it('should allow changing the AI provider', async () => {
            const newProvider = new MockAIProvider('New provider response');
            service.setProvider(newProvider);

            const explanation = await service.explainIssue(sampleIssue);
            expect(explanation).toBe('New provider response');
        });
    });
});

describe('createAIAnalysisService', () => {
    it('should create an instance of AIAnalysisService', () => {
        const mockProvider = new MockAIProvider();
        const service = createAIAnalysisService(mockProvider);

        expect(service).toBeInstanceOf(AIAnalysisService);
    });
});

/**
 * Mock AI Provider class for external use
 */
class MockAIProviderExternal implements AIProvider {
    readonly name = 'mock';
    async complete(): Promise<AIResponse> {
        return { content: '', model: 'mock' };
    }
    async *stream(): AsyncIterable<string> {
        yield '';
    }
    async isAvailable(): Promise<boolean> {
        return true;
    }
}

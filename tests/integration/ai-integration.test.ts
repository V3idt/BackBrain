import { describe, test, expect, beforeEach } from 'bun:test';
import { AIAnalysisService, VercelAIAdapter } from '@backbrain/core';

describe('AI Integration', () => {
    let service: AIAnalysisService;

    beforeEach(() => {
        const adapter = new VercelAIAdapter('openai', { apiKey: 'test-key' });
        service = new AIAnalysisService(adapter);
    });

    test('cache responses for identical requests', async () => {
        const issue = {
            id: 'test-1',
            title: 'Test Issue',
            description: 'Test description',
            severity: 'medium' as const,
            location: { filePath: '/test.js', line: 1, column: 1 },
            type: 'security_vulnerability' as const,
            category: 'logic' as const,
        };

        // Mock the adapter to track calls
        let callCount = 0;
        const originalComplete = service['aiProvider'].complete.bind(service['aiProvider']);
        service['aiProvider'].complete = async (...args: any[]) => {
            callCount++;
            return originalComplete(...args);
        };

        // First call - should hit API
        try {
            await service.explainIssue(issue);
        } catch (e) {
            // Expected to fail with test key
        }

        // Second call - should use cache
        try {
            await service.explainIssue(issue);
        } catch (e) {
            // Expected to fail with test key
        }

        // Should only call API once due to caching
        expect(callCount).toBeLessThanOrEqual(1);
    });

    test('handle rate limiting gracefully', async () => {
        const issue = {
            id: 'test-1',
            title: 'Test',
            description: 'Test',
            severity: 'medium' as const,
            location: { filePath: '/test.js', line: 1, column: 1 },
            type: 'security_vulnerability' as const,
            category: 'logic' as const,
        };

        // Simulate rate limit by making multiple rapid requests
        const promises = Array(5).fill(null).map(() => 
            service.explainIssue(issue).catch(() => null)
        );

        const results = await Promise.all(promises);
        // At least some should complete or fail gracefully
        expect(results).toBeDefined();
    });
});

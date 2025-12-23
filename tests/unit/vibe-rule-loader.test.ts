import { describe, expect, it, beforeEach, mock } from "bun:test";

// Mock vscode module
const mockReadFile = mock();
mock.module("vscode", () => ({
    Uri: {
        joinPath: (uri: any, ...parts: string[]) => ({ fsPath: uri.fsPath + '/' + parts.join('/') })
    },
    workspace: {
        fs: {
            readFile: mockReadFile,
        }
    },
    FileSystemError: class extends Error {
        code: string;
        constructor() {
            super('File not found');
            this.code = 'FileNotFound';
        }
    }
}));

import { VibeRuleLoader } from "../../packages/extension/src/utils/vibe-rule-loader";
import { DEFAULT_VIBE_RULES } from "../../packages/core/src/config/vibe-rules";

describe("VibeRuleLoader", () => {
    const mockRoot = { fsPath: "/workspace" };

    beforeEach(() => {
        mockReadFile.mockReset();
    });

    it("should return default rules if config file is missing", async () => {
        mockReadFile.mockImplementation(() => {
            const err: any = new Error('File not found');
            err.code = 'FileNotFound';
            throw err;
        });

        const rules = await VibeRuleLoader.loadRules(mockRoot as any);
        expect(rules).toEqual(DEFAULT_VIBE_RULES);
    });

    it("should load and merge custom rules", async () => {
        const customRule = {
            id: "custom-rule",
            title: "Custom Rule",
            description: "A custom rule",
            severity: "high",
            pattern: "custom-pattern",
            type: "regex"
        };

        const configContent = JSON.stringify({ rules: [customRule] });
        mockReadFile.mockResolvedValue(Buffer.from(configContent));

        const rules = await VibeRuleLoader.loadRules(mockRoot as any);

        expect(rules.length).toBe(DEFAULT_VIBE_RULES.length + 1);
        const loadedRule = rules.find(r => r.id === "custom-rule");
        expect(loadedRule).toBeDefined();
        expect(loadedRule?.severity).toBe("high");
        expect(loadedRule?.pattern).toBeInstanceOf(RegExp);
    });

    it("should override existing rules", async () => {
        const overrideRule = {
            id: DEFAULT_VIBE_RULES[0].id,
            title: "Overridden Rule",
            description: "This rule is overridden",
            severity: "critical",
            pattern: "new-pattern",
            type: "regex"
        };

        const configContent = JSON.stringify({ rules: [overrideRule] });
        mockReadFile.mockResolvedValue(Buffer.from(configContent));

        const rules = await VibeRuleLoader.loadRules(mockRoot as any);

        expect(rules.length).toBe(DEFAULT_VIBE_RULES.length);
        const loadedRule = rules.find(r => r.id === overrideRule.id);
        expect(loadedRule?.title).toBe("Overridden Rule");
        expect(loadedRule?.severity).toBe("critical");
    });
});

import { describe, expect, it } from "bun:test";
import { RuleParser } from "../../packages/core/src/config/rule-parser";
import { DEFAULT_VIBE_RULES } from "../../packages/core/src/config/vibe-rules";

describe("RuleParser", () => {
    it("should return base rules if content is invalid JSON", () => {
        const rules = RuleParser.parseRules("invalid-json");
        expect(rules).toEqual(DEFAULT_VIBE_RULES);
    });

    it("should parse and merge custom rules", () => {
        const customRule = {
            id: "custom-rule",
            title: "Custom Rule",
            description: "A custom rule",
            severity: "high",
            pattern: "custom-pattern",
            type: "regex"
        };

        const jsonContent = JSON.stringify({ rules: [customRule] });
        const rules = RuleParser.parseRules(jsonContent);

        expect(rules.length).toBe(DEFAULT_VIBE_RULES.length + 1);
        const loadedRule = rules.find(r => r.id === "custom-rule");
        expect(loadedRule).toBeDefined();
        expect(loadedRule?.severity).toBe("high");
        expect(loadedRule?.pattern).toBeInstanceOf(RegExp);
    });

    it("should override existing rules", () => {
        const overrideRule = {
            id: DEFAULT_VIBE_RULES[0].id,
            title: "Overridden Rule",
            description: "This rule is overridden",
            severity: "critical",
            pattern: "new-pattern",
            type: "regex"
        };

        const jsonContent = JSON.stringify({ rules: [overrideRule] });
        const rules = RuleParser.parseRules(jsonContent);

        expect(rules.length).toBe(DEFAULT_VIBE_RULES.length);
        const loadedRule = rules.find(r => r.id === overrideRule.id);
        expect(loadedRule?.title).toBe("Overridden Rule");
        expect(loadedRule?.severity).toBe("critical");
    });

    it("should handle logic rules", () => {
        const logicRule = {
            id: "logic-rule",
            title: "Logic Rule",
            description: "A logic rule",
            severity: "low",
            pattern: "some-pattern",
            type: "logic"
        };

        const jsonContent = JSON.stringify({ rules: [logicRule] });
        const rules = RuleParser.parseRules(jsonContent);

        const loadedRule = rules.find(r => r.id === "logic-rule");
        expect(loadedRule?.type).toBe("logic");
        expect(loadedRule?.pattern).toBe("some-pattern"); // Should remain string for logic rules if not regex
        // Note: RuleParser currently converts all 'regex' types to RegExp. 
        // Logic rules might use string patterns or be ignored by regex runner.
    });

    it("should handle ai rules with prompts and examples", () => {
        const aiRule = {
            id: "ai-rule",
            title: "AI Rule",
            description: "An AI rule",
            severity: "medium",
            type: "ai",
            aiPrompt: "Look for complex logic issues",
            examples: [
                { code: "const x = 1;", issue: "None" }
            ]
        };

        const jsonContent = JSON.stringify({ rules: [aiRule] });
        const rules = RuleParser.parseRules(jsonContent);

        const loadedRule = rules.find(r => r.id === "ai-rule");
        expect(loadedRule?.type).toBe("ai");
        expect(loadedRule?.aiPrompt).toBe("Look for complex logic issues");
        expect(loadedRule?.examples).toHaveLength(1);
        expect(loadedRule?.examples?.[0]?.code).toBe("const x = 1;");
    });

    it("should skip ai rules missing aiPrompt", () => {
        const invalidAiRule = {
            id: "invalid-ai-rule",
            title: "Invalid AI Rule",
            description: "Missing prompt",
            severity: "low",
            type: "ai"
            // Missing aiPrompt
        };

        const jsonContent = JSON.stringify({ rules: [invalidAiRule] });
        const rules = RuleParser.parseRules(jsonContent);

        const loadedRule = rules.find(r => r.id === "invalid-ai-rule");
        expect(loadedRule).toBeUndefined();
    });

    it("should skip regex rules with potential ReDoS patterns", () => {
        const redosRule = {
            id: "redos-rule",
            title: "ReDoS Rule",
            description: "Evil regex",
            severity: "high",
            type: "regex",
            pattern: "(a+)+"
        };

        const jsonContent = JSON.stringify({ rules: [redosRule] });
        const rules = RuleParser.parseRules(jsonContent);

        const loadedRule = rules.find(r => r.id === "redos-rule");
        expect(loadedRule).toBeUndefined();
    });
});

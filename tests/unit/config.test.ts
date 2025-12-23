import { describe, expect, it } from "bun:test";
import { getConfig, mergeIgnorePatterns } from "../../packages/core/src/config/index";

describe("Config System", () => {
    it("should perform deep merging correctly", () => {
        const userConfig = {
            security: {
                enabled: false
            }
        };
        const config = getConfig(userConfig);

        // Deep merge should preserve other nested properties
        expect(config.security.enabled).toBe(false);
        expect(config.security.autoFix).toBe(true); // Default value preserved
        expect(config.security.minSeverity).toBe('low'); // Default value preserved
    });

    it("should validate aiBackend values", () => {
        expect(() => getConfig({ aiBackend: 'invalid' as any })).toThrow("Invalid aiBackend");
        expect(() => getConfig({ aiBackend: 'direct-openai' })).not.toThrow();
    });

    it("should validate minSeverity values", () => {
        expect(() => getConfig({ security: { minSeverity: 'invalid' as any } })).toThrow("Invalid minSeverity");
        expect(() => getConfig({ security: { minSeverity: 'critical' } })).not.toThrow();
    });

    it("should merge ignore patterns without duplicates", () => {
        const config = getConfig();
        const initialCount = config.files.exclude.length;

        const newPatterns = ["**/temp/**", "**/dist/**"]; // dist is already in defaults
        const updatedConfig = mergeIgnorePatterns(config, newPatterns);

        expect(updatedConfig.files.exclude).toContain("**/temp/**");
        expect(updatedConfig.files.exclude).toContain("**/dist/**");

        // Should only add 1 new pattern because dist was already there
        expect(updatedConfig.files.exclude.length).toBe(initialCount + 1);
    });
});

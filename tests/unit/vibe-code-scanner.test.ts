import { describe, expect, it } from "bun:test";
import { VibeCodeScanner } from "../../packages/core/src/adapters/vibe-code-scanner";

describe("VibeCodeScanner", () => {
    const scanner = new VibeCodeScanner();

    it("should detect missing imports", async () => {
        const content = `
      fs.readFileSync('test.txt');
    `;
        const issues = await scanner.scanFile("test.ts", content);
        const missingImport = issues.find(i => i.ruleId === 'vibe-code.missing-import');
        expect(missingImport).toBeDefined();
        expect(missingImport?.description).toContain("'fs' is used but not imported");
    });

    it("should detect inconsistent naming", async () => {
        const content = `
      function myTestFunction() {}
      mytestfunction();
    `;
        const issues = await scanner.scanFile("test.ts", content);
        const nameMismatch = issues.find(i => i.ruleId === 'vibe-code.name-mismatch');
        expect(nameMismatch).toBeDefined();
        expect(nameMismatch?.description).toContain("'mytestfunction' should be 'myTestFunction'");
    });

    it("should detect unhandled promises", async () => {
        const content = `
      fetch('https://api.example.com');
    `;
        const issues = await scanner.scanFile("test.ts", content);
        const unhandledPromise = issues.find(i => i.ruleId === 'vibe-code.unhandled-promise');
        expect(unhandledPromise).toBeDefined();
    });

    it("should detect deprecated APIs via regex rule", async () => {
        const content = `
      class MyComponent extends React.Component {
        componentWillMount() {}
      }
    `;
        const issues = await scanner.scanFile("test.ts", content);
        const deprecatedApi = issues.find(i => i.ruleId === 'vibe-code.deprecated-api');
        expect(deprecatedApi).toBeDefined();
        expect(deprecatedApi?.description).toContain("Use of deprecated React lifecycle methods");
    });

    it("should return the correct name", () => {
        expect(scanner.name).toBe("vibe-code");
    });

    it("should support common extensions", () => {
        const extensions = scanner.getSupportedExtensions();
        expect(extensions).toContain(".ts");
        expect(extensions).toContain(".py");
    });
});

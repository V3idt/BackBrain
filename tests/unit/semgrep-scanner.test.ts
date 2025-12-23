import { describe, expect, it, beforeEach } from "bun:test";

import { SemgrepScanner } from "../../packages/core/src/adapters/semgrep-scanner";

describe("SemgrepScanner", () => {
    let scanner: SemgrepScanner;
    let mockExec: any;

    beforeEach(() => {
        mockExec = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') {
                callback = options;
            }

            if (cmd === "semgrep --version") {
                callback(new Error("not found"), "", "not found");
            } else {
                callback(null, "success", "");
            }
            return { on: () => { } };
        };
        scanner = new SemgrepScanner(mockExec as any);
    });

    it("should return false if semgrep is not available", async () => {
        // Mock exec to fail for all semgrep checks
        mockExec = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') callback = options;
            callback(new Error("not found"), "", "not found");
            return { on: () => { } };
        };
        scanner = new SemgrepScanner(mockExec as any);

        const available = await scanner.isAvailable();
        expect(available).toBe(false);
    });

    it("should allow setting custom binary path", async () => {
        let lastCommand = "";
        mockExec = (cmd: string, options: any, callback: any) => {
            lastCommand = cmd;
            if (typeof options === 'function') callback = options;
            callback(null, "1.0.0", "");
            return { on: () => { } };
        };
        scanner = new SemgrepScanner(mockExec as any);
        scanner.setBinaryPath("/custom/path/to/semgrep");

        await scanner.isAvailable();
        expect(lastCommand).toContain("/custom/path/to/semgrep");
    });

    it("should be available if system semgrep exists", async () => {
        mockExec = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') callback = options;
            if (cmd === "semgrep --version") {
                callback(null, "1.0.0", "");
            } else {
                callback(new Error("not found"), "", "not found");
            }
            return { on: () => { } };
        };
        scanner = new SemgrepScanner(mockExec as any);

        const available = await scanner.isAvailable();
        expect(available).toBe(true);
    });

    it("should return the correct name", () => {
        expect(scanner.name).toBe("semgrep");
    });

    it("should support common extensions", () => {
        const extensions = scanner.getSupportedExtensions();
        expect(extensions).toContain(".ts");
        expect(extensions).toContain(".py");
        expect(extensions).toContain(".go");
    });
});

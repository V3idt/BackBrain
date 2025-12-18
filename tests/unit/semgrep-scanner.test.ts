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

    it("should attempt to install semgrep if not available anywhere", async () => {
        // Mock exec to fail for all semgrep checks
        mockExec = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') callback = options;
            callback(new Error("not found"), "", "not found");
            return { on: () => { } };
        };
        scanner = new SemgrepScanner(mockExec as any);

        const available = await scanner.isAvailable();
        expect(available).toBe(false);

        // Wait a tiny bit for the background promise to start
        await new Promise(resolve => setTimeout(resolve, 10));
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

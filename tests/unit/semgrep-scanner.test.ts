import { describe, expect, it, beforeEach } from "bun:test";
import { promisify } from "util";

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

    it("should return empty results when semgrep auto config is unavailable offline", async () => {
        mockExec = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') callback = options;

            if (cmd.includes("--config=auto --json")) {
                const error: any = new Error("network failure");
                error.stderr = "HTTPSConnectionPool(host='semgrep.dev', port=443): Max retries exceeded with url: /c/auto (Caused by NameResolutionError(\"Temporary failure in name resolution\"))";
                callback(error, "", error.stderr);
                return { on: () => { } };
            }

            callback(null, "1.0.0", "");
            return { on: () => { } };
        };
        scanner = new SemgrepScanner(mockExec as any);

        const result = await scanner.scan(["/repo/app.py"]);
        expect(result.issues).toEqual([]);
        expect(result.scannerInfo).toBe("Semgrep (auto config unavailable)");
    });

    it("should parse semgrep json results when scan succeeds", async () => {
        mockExec = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') callback = options;

            if (cmd.includes("--config=auto --json")) {
                callback(null, JSON.stringify({
                    results: [
                        {
                            check_id: "python.lang.security.audit.sql-injection",
                            path: "/repo/app.py",
                            start: { line: 12, col: 5 },
                            end: { line: 12, col: 20 },
                            extra: {
                                message: "Possible SQL injection",
                                severity: "ERROR",
                                lines: "query = f\"select *\"",
                                metadata: {
                                    references: ["https://example.com/rule"],
                                },
                            },
                        },
                    ],
                }), "");
                return { on: () => { } };
            }

            callback(null, "1.0.0", "");
            return { on: () => { } };
        };
        (mockExec as any)[promisify.custom] = (cmd: string, options?: any) => new Promise((resolve, reject) => {
            mockExec(cmd, options, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
        scanner = new SemgrepScanner(mockExec as any);

        const result = await scanner.scan(["/repo/app.py"]);
        expect(result.issues.length).toBe(1);
        expect(result.issues[0]?.ruleId).toBe("python.lang.security.audit.sql-injection");
        expect(result.issues[0]?.severity).toBe("high");
        expect(result.issues[0]?.snippet).toContain("query");
    });
});

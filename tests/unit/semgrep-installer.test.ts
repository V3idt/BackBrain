import { describe, expect, it, beforeEach, mock } from "bun:test";

// Mock vscode module before importing the installer
mock.module("vscode", () => ({
    ExtensionContext: class { },
}));

import { SemgrepInstaller } from "../../packages/extension/src/utils/semgrep-installer";

describe("SemgrepInstaller", () => {
    let installer: SemgrepInstaller;
    let mockExec: any;
    let mockFs: any;
    let mockContext: any;

    beforeEach(() => {
        mockContext = {};
        mockFs = {
            existsSync: mock((path: string) => false),
        };
        mockExec = mock((cmd: string, callback: any) => {
            callback(null, "success", "");
        });

        installer = new SemgrepInstaller(mockContext, mockExec, mockFs);
    });

    it("should return true if semgrep is in venv", async () => {
        mockFs.existsSync.mockImplementation((path: string) => path.includes("semgrep"));

        const result = await installer.isAvailable();
        expect(result).toBe(true);
    });

    it("should return true if semgrep is in global path", async () => {
        mockFs.existsSync.mockImplementation(() => false);
        mockExec.mockImplementation((cmd: string, callback: any) => {
            if (cmd === "semgrep --version") {
                callback(null, "1.0.0", "");
            } else {
                callback(new Error("not found"), "", "");
            }
        });

        const result = await installer.isAvailable();
        expect(result).toBe(true);
    });

    it("should return false if semgrep is missing", async () => {
        mockFs.existsSync.mockImplementation(() => false);
        mockExec.mockImplementation((cmd: string, callback: any) => {
            callback(new Error("not found"), "", "");
        });

        const result = await installer.isAvailable();
        expect(result).toBe(false);
    });

    it("should install semgrep in venv", async () => {
        const executedCommands: string[] = [];
        mockExec.mockImplementation((cmd: string, callback: any) => {
            executedCommands.push(cmd);
            // Mock Python version check
            if (cmd.includes('--version')) {
                callback(null, "Python 3.9.0", "");
            } else {
                callback(null, "success", "");
            }
        });

        // Add mkdirSync mock
        mockFs.mkdirSync = mock(() => { });

        // Simulate venv not existing
        mockFs.existsSync.mockImplementation(() => false);

        await installer.install();

        // Should create venv and install semgrep
        expect(executedCommands.some(cmd => cmd.includes("python3 -m venv"))).toBe(true);
        expect(executedCommands.some(cmd => cmd.includes("pip") && cmd.includes("install semgrep"))).toBe(true);
    });

    it("should skip venv creation if it exists", async () => {
        const executedCommands: string[] = [];
        mockExec.mockImplementation((cmd: string, callback: any) => {
            executedCommands.push(cmd);
            // Mock Python version check
            if (cmd.includes('--version')) {
                callback(null, "Python 3.9.0", "");
            } else {
                callback(null, "success", "");
            }
        });

        // Add mkdirSync mock
        mockFs.mkdirSync = mock(() => { });

        // Simulate venv existing
        mockFs.existsSync.mockImplementation((path: string) => path.includes("semgrep-venv"));

        await installer.install();

        // Should NOT create venv, but SHOULD install semgrep
        expect(executedCommands.some(cmd => cmd.includes("python3 -m venv"))).toBe(false);
        expect(executedCommands.some(cmd => cmd.includes("pip") && cmd.includes("install semgrep"))).toBe(true);
    });
});

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger } from '@backbrain/core';

const logger = createLogger('SemgrepInstaller');

export class SemgrepInstaller {
    private execFn: typeof cp.exec;
    private fs: typeof fs;

    constructor(
        _context: vscode.ExtensionContext,
        execFn?: typeof cp.exec,
        fileSystem?: typeof fs
    ) {
        this.execFn = execFn || cp.exec;
        this.fs = fileSystem || fs;
    }

    /**
     * Check if Semgrep is installed and available
     */
    public async isAvailable(): Promise<boolean> {
        try {
            // First check if we have it in our private venv
            const venvSemgrep = this.getVenvSemgrepPath();
            if (this.fs.existsSync(venvSemgrep)) {
                logger.debug('Found Semgrep in private venv', { path: venvSemgrep });
                return true;
            }

            // Then check global path
            await this.exec('semgrep --version');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the path to the Semgrep executable (venv or global)
     */
    public getSemgrepPath(): string {
        const venvSemgrep = this.getVenvSemgrepPath();
        if (this.fs.existsSync(venvSemgrep)) {
            return venvSemgrep;
        }
        return 'semgrep'; // Fallback to global
    }

    /**
     * Check if Python is available on the system
     */
    private async checkPythonAvailability(): Promise<string> {
        try {
            await this.exec('python3 --version');
            return 'python3';
        } catch {
            try {
                await this.exec('python --version');
                return 'python';
            } catch {
                throw new Error(
                    'Python is not installed or not in PATH. Please install Python 3.7+ from https://www.python.org/downloads/'
                );
            }
        }
    }

    /**
     * Check if Python version meets minimum requirements (3.7+)
     */
    private async checkPythonVersion(pythonCmd: string): Promise<void> {
        const { stdout } = await this.exec(`${pythonCmd} --version`);
        const versionMatch = stdout.match(/(\d+)\.(\d+)/);

        if (!versionMatch) {
            throw new Error('Could not determine Python version');
        }

        const major = parseInt(versionMatch[1]!, 10);
        const minor = parseInt(versionMatch[2]!, 10);

        if (major < 3 || (major === 3 && minor < 7)) {
            throw new Error(
                `Python ${major}.${minor} is not supported. Semgrep requires Python 3.7 or higher. Please upgrade Python.`
            );
        }

        logger.info(`Python version check passed: ${major}.${minor}`);
    }

    /**
     * Install Semgrep into a private virtual environment
     */
    public async install(): Promise<void> {
        logger.info('Starting Semgrep installation...');

        try {
            // 1. Check Python availability and version
            const pythonCmd = await this.checkPythonAvailability();
            await this.checkPythonVersion(pythonCmd);

            const venvPath = this.getVenvPath();

            // 2. Ensure ~/.backbrain directory exists (handle permissions)
            const backbrainDir = path.dirname(venvPath);
            if (!this.fs.existsSync(backbrainDir)) {
                try {
                    this.fs.mkdirSync(backbrainDir, { recursive: true });
                } catch (err) {
                    throw new Error(
                        `Cannot create directory ${backbrainDir}. Please check file permissions or create it manually.`
                    );
                }
            }

            // 3. Create venv if it doesn't exist
            if (!this.fs.existsSync(venvPath)) {
                logger.info('Creating virtual environment', { venvPath });
                await this.exec(`${pythonCmd} -m venv ${venvPath}`);
            }

            // 4. Install semgrep with retry logic
            const pipPath = this.getVenvPipPath();
            logger.info('Installing semgrep via pip', { pipPath });

            const maxRetries = 3;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    await this.exec(`"${pipPath}" install semgrep`);
                    logger.info('Semgrep installed successfully');
                    return;
                } catch (err) {
                    lastError = err as Error;
                    logger.warn(`Installation attempt ${attempt} failed`, { error: err });

                    if (attempt < maxRetries) {
                        logger.info(`Retrying in 2 seconds... (${attempt}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            throw new Error(
                `Failed to install Semgrep after ${maxRetries} attempts. ` +
                `Please check your internet connection and try again. ` +
                `Error: ${lastError?.message || 'Unknown error'}`
            );
        } catch (error) {
            logger.error('Semgrep installation failed', { error });
            throw error;
        }
    }

    private getVenvPath(): string {
        // Use a hidden folder in the user's home directory for persistence across sessions
        // and to avoid cluttering the workspace
        return path.join(os.homedir(), '.backbrain', 'semgrep-venv');
    }

    private getVenvSemgrepPath(): string {
        const venv = this.getVenvPath();
        const isWin = process.platform === 'win32';
        return isWin
            ? path.join(venv, 'Scripts', 'semgrep.exe')
            : path.join(venv, 'bin', 'semgrep');
    }

    private getVenvPipPath(): string {
        const venv = this.getVenvPath();
        const isWin = process.platform === 'win32';
        return isWin
            ? path.join(venv, 'Scripts', 'pip.exe')
            : path.join(venv, 'bin', 'pip');
    }

    private exec(command: string): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            this.execFn(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }
}

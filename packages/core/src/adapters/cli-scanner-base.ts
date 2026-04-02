import { exec } from 'child_process';
import { promisify } from 'util';

export abstract class CliScannerBase {
    protected execFn: typeof exec;
    protected binaryPath: string;

    constructor(binaryPath: string, execFn?: typeof exec) {
        this.binaryPath = binaryPath;
        this.execFn = execFn || exec;
    }

    protected get execAsync() {
        return promisify(this.execFn);
    }

    setBinaryPath(path: string): void {
        this.binaryPath = path;
    }

    async checkAvailable(versionArg = '--version'): Promise<boolean> {
        try {
            await this.execAsync(`${this.binaryPath} ${versionArg}`);
            return true;
        } catch {
            return false;
        }
    }

    protected quote(value: string): string {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
}

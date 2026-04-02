import { describe, expect, it } from 'bun:test';
import { promisify } from 'util';

import { TrivyScanner } from '../../packages/core/src/adapters/trivy-scanner';

describe('TrivyScanner', () => {
    it('should return empty results when the vulnerability DB is unavailable', async () => {
        const execMock = (cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') {
                callback = options;
            }

            if (cmd.includes('trivy fs')) {
                const error: any = new Error('trivy db unavailable');
                error.stderr = 'FATAL\tFatal error\trun error: init error: DB error: failed to download vulnerability DB: OCI artifact error: failed to download vulnerability DB: failed to download artifact from mirror.gcr.io/aquasec/trivy-db:2: oci download error: copy error: context deadline exceeded';
                callback(error, '', error.stderr);
                return { on: () => { } };
            }

            callback(null, 'ok', '');
            return { on: () => { } };
        };

        (execMock as any)[promisify.custom] = (cmd: string, options?: any) => new Promise((resolve, reject) => {
            execMock(cmd, options, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });

        const scanner = new TrivyScanner(execMock as any);
        const result = await scanner.scan(['/repo/app.py']);

        expect(result.issues).toEqual([]);
        expect(result.scannerInfo).toBe('Trivy (vulnerability DB unavailable)');
    });
});

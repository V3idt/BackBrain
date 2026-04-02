import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { GitHubCliInstaller } from '../../packages/extension/src/utils/github-cli-installer';

describe('GitHubCliInstaller', () => {
    let installer: GitHubCliInstaller;
    let mockExec: any;
    let mockFs: any;

    beforeEach(() => {
        mockExec = mock((cmd: string, options: any, callback: any) => {
            if (typeof options === 'function') {
                callback = options;
            }
            callback(null, 'ok', '');
        });
        mockFs = {
            existsSync: mock(() => false),
            readFileSync: mock(() => ''),
            writeFileSync: mock(() => {}),
            mkdirSync: mock(() => {}),
            readdirSync: mock(() => []),
            chmodSync: mock(() => {}),
            copyFileSync: mock(() => {}),
        };

        installer = new GitHubCliInstaller(mockExec, mockFs);
    });

    it('should return installed binary path from marker file when present', () => {
        mockFs.existsSync.mockImplementation((target: string) => target.endsWith('current-path.txt') || target === '/tmp/gitleaks');
        mockFs.readFileSync.mockReturnValue('/tmp/gitleaks');

        const binaryPath = installer.getBinaryPath('gitleaks');
        expect(binaryPath).toBe('/tmp/gitleaks');
    });

    it('should fall back to global binary name when no installed marker exists', () => {
        expect(installer.getBinaryPath('trivy')).toBe('trivy');
        expect(installer.getBinaryPath('osv-scanner')).toBe('osv-scanner');
    });

    it('should report tool available when global binary works', async () => {
        const available = await installer.isAvailable('gitleaks');
        expect(available).toBe(true);
    });
});

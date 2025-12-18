import { SemgrepScanner } from './semgrep-scanner';
import { VibeCodeScanner } from './vibe-code-scanner';

export * from './semgrep-scanner';
export * from './vibe-code-scanner';

export const DEFAULT_SCANNERS = [
    { name: 'semgrep', scanner: new SemgrepScanner() },
    { name: 'vibe-code', scanner: new VibeCodeScanner() },
];

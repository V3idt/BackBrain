import { SemgrepScanner } from './semgrep-scanner';
import { VibeCodeScanner } from './vibe-code-scanner';
import { TreeSitterScanner } from './tree-sitter-scanner';

export * from './semgrep-scanner';
export * from './vibe-code-scanner';
export * from './tree-sitter-scanner';
export * from './vercel-ai-adapter';

export const DEFAULT_SCANNERS = [
    { name: 'semgrep', scanner: new SemgrepScanner() },
    { name: 'vibe-code', scanner: new VibeCodeScanner() },
    { name: 'tree-sitter', scanner: new TreeSitterScanner() },
];

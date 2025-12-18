import type { Severity } from '../ports';

export interface VibeRule {
    id: string;
    title: string;
    description: string;
    severity: Severity;
    pattern: RegExp | string;
    type: 'regex' | 'logic';
    message?: (match: any) => string;
}

export const DEFAULT_VIBE_RULES: VibeRule[] = [
    {
        id: 'vibe-code.missing-import',
        title: 'Missing Import',
        description: 'Module is used but not imported',
        severity: 'high',
        pattern: /([a-zA-Z0-9_]+)\./g,
        type: 'logic', // Handled by custom logic for now
    },
    {
        id: 'vibe-code.name-mismatch',
        title: 'Inconsistent Naming',
        description: 'Variable or function used with inconsistent casing',
        severity: 'medium',
        pattern: /(?:const|let|var|function)\s+(\w+)/g,
        type: 'logic',
    },
    {
        id: 'vibe-code.unhandled-promise',
        title: 'Unhandled Promise',
        description: 'Async operation without error handling',
        severity: 'high',
        pattern: /\b(fetch|axios\.[a-z]+)\(/g,
        type: 'logic',
    },
    {
        id: 'vibe-code.deprecated-api',
        title: 'Deprecated API',
        description: 'Use of deprecated React lifecycle methods',
        severity: 'medium',
        pattern: /\b(componentWillMount|componentWillReceiveProps)\b/g,
        type: 'regex',
    }
];

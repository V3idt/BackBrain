/**
 * BackBrain Configuration
 * 
 * Environment-based configuration with debug mode support.
 */

export interface BackBrainConfig {
    /** Enable debug mode */
    debug: boolean;

    /** Enable verbose logging */
    verboseLogging: boolean;

    /** AI backend to use */
    aiBackend: 'backbrain' | 'direct-openai' | 'direct-claude' | 'direct-gemini';

    /** Security scanning options */
    security: {
        /** Enable security scanning */
        enabled: boolean;
        /** Auto-fix security issues */
        autoFix: boolean;
        /** Minimum severity to report */
        minSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    };

    /** File patterns */
    files: {
        /** Patterns to include */
        include: string[];
        /** Patterns to exclude */
        exclude: string[];
    };
}

/** Default configuration */
export const defaultConfig: BackBrainConfig = {
    debug: process.env.BACKBRAIN_DEBUG === 'true',
    verboseLogging: process.env.BACKBRAIN_VERBOSE === 'true',
    aiBackend: 'backbrain',
    security: {
        enabled: true,
        autoFix: true,
        minSeverity: 'low',
    },
    files: {
        include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
};

/**
 * Get configuration from environment and user settings
 */
export function getConfig(userConfig: Partial<BackBrainConfig> = {}): BackBrainConfig {
    return {
        ...defaultConfig,
        ...userConfig,
        security: {
            ...defaultConfig.security,
            ...userConfig.security,
        },
        files: {
            ...defaultConfig.files,
            ...userConfig.files,
        },
    };
}

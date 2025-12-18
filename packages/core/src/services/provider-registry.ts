/**
 * Provider Registry
 * 
 * Central registry for swappable adapters. This enables easy switching
 * between different implementations at runtime or configuration time.
 */

import type { AIProvider, SecurityScanner, FileSystem, Logger } from '../ports';

interface ProviderMap {
    ai: Map<string, AIProvider>;
    scanner: Map<string, SecurityScanner>;
    filesystem: Map<string, FileSystem>;
    logger: Map<string, Logger>;
}

interface ProviderConfig {
    defaultAI: string;
    defaultScanner: string;
    defaultFilesystem: string;
    defaultLogger: string;
}

class ProviderRegistryImpl {
    private providers: ProviderMap = {
        ai: new Map(),
        scanner: new Map(),
        filesystem: new Map(),
        logger: new Map(),
    };

    private config: ProviderConfig = {
        defaultAI: '',
        defaultScanner: '',
        defaultFilesystem: '',
        defaultLogger: '',
    };

    // ==================== Registration ====================

    registerAI(name: string, provider: AIProvider, setAsDefault = false): void {
        this.providers.ai.set(name, provider);
        if (setAsDefault || !this.config.defaultAI) {
            this.config.defaultAI = name;
        }
    }

    registerScanner(name: string, scanner: SecurityScanner, setAsDefault = false): void {
        this.providers.scanner.set(name, scanner);
        if (setAsDefault || !this.config.defaultScanner) {
            this.config.defaultScanner = name;
        }
    }

    registerFilesystem(name: string, fs: FileSystem, setAsDefault = false): void {
        this.providers.filesystem.set(name, fs);
        if (setAsDefault || !this.config.defaultFilesystem) {
            this.config.defaultFilesystem = name;
        }
    }

    registerLogger(name: string, logger: Logger, setAsDefault = false): void {
        this.providers.logger.set(name, logger);
        if (setAsDefault || !this.config.defaultLogger) {
            this.config.defaultLogger = name;
        }
    }

    // ==================== Retrieval ====================

    getAI(name?: string): AIProvider | undefined {
        const key = name ?? this.config.defaultAI;
        return this.providers.ai.get(key);
    }

    getScanner(name?: string): SecurityScanner | undefined {
        const key = name ?? this.config.defaultScanner;
        return this.providers.scanner.get(key);
    }

    getFilesystem(name?: string): FileSystem | undefined {
        const key = name ?? this.config.defaultFilesystem;
        return this.providers.filesystem.get(key);
    }

    getLogger(name?: string): Logger | undefined {
        const key = name ?? this.config.defaultLogger;
        return this.providers.logger.get(key);
    }

    // ==================== Listing ====================

    listAI(): string[] {
        return Array.from(this.providers.ai.keys());
    }

    listScanners(): string[] {
        return Array.from(this.providers.scanner.keys());
    }

    listFilesystems(): string[] {
        return Array.from(this.providers.filesystem.keys());
    }

    listLoggers(): string[] {
        return Array.from(this.providers.logger.keys());
    }

    // ==================== Configuration ====================

    setDefaultAI(name: string): void {
        if (this.providers.ai.has(name)) {
            this.config.defaultAI = name;
        }
    }

    setDefaultScanner(name: string): void {
        if (this.providers.scanner.has(name)) {
            this.config.defaultScanner = name;
        }
    }

    setDefaultFilesystem(name: string): void {
        if (this.providers.filesystem.has(name)) {
            this.config.defaultFilesystem = name;
        }
    }

    setDefaultLogger(name: string): void {
        if (this.providers.logger.has(name)) {
            this.config.defaultLogger = name;
        }
    }

    getDefaults(): Readonly<ProviderConfig> {
        return { ...this.config };
    }
}

// Singleton instance
export const providerRegistry = new ProviderRegistryImpl();

// Export class for instantiation
export class ProviderRegistry extends ProviderRegistryImpl {
    register<T extends keyof ProviderMap>(
        type: T,
        name: string,
        provider: ProviderMap[T] extends Map<string, infer P> ? P : never,
        setAsDefault = false
    ): void {
        if (type === 'ai') this.registerAI(name, provider as AIProvider, setAsDefault);
        else if (type === 'scanner') this.registerScanner(name, provider as SecurityScanner, setAsDefault);
        else if (type === 'filesystem') this.registerFilesystem(name, provider as FileSystem, setAsDefault);
        else if (type === 'logger') this.registerLogger(name, provider as Logger, setAsDefault);
    }
}

// Re-export for convenience
export type { ProviderConfig };

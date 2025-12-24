/**
 * Fix History Service
 * 
 * Tracks fix sessions within VS Code for revert capability.
 * Persists to globalState so sessions survive across reloads.
 */

import * as vscode from 'vscode';
import { createLogger, type FixSummary } from '@backbrain/core';

const logger = createLogger('FixHistoryService');

const STORAGE_KEY = 'backbrain.fixHistory';
const MAX_SESSIONS = 20; // Keep last 20 sessions

/**
 * Represents a fix session with metadata
 */
export interface FixSession {
    /** Unique session ID from AutoFixService */
    sessionId: string;
    /** When the fix was applied */
    timestamp: number;
    /** Summary of what was fixed */
    summary: FixSummary;
    /** Whether this session has been reverted */
    reverted: boolean;
    /** Files that were modified */
    files: string[];
}

/**
 * Serialized format for storage
 */
interface StoredHistory {
    sessions: FixSession[];
}

/**
 * Fix History Service
 * 
 * Manages fix session history for revert functionality.
 */
export class FixHistoryService {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Record a new fix session
     */
    async recordSession(
        sessionId: string,
        summary: FixSummary,
        files: string[]
    ): Promise<void> {
        const history = this.getHistory();

        const session: FixSession = {
            sessionId,
            timestamp: Date.now(),
            summary,
            reverted: false,
            files,
        };

        // Add to beginning (most recent first)
        history.sessions.unshift(session);

        // Trim to max size
        if (history.sessions.length > MAX_SESSIONS) {
            history.sessions = history.sessions.slice(0, MAX_SESSIONS);
        }

        await this.saveHistory(history);
        logger.info('Recorded fix session', { sessionId, fixed: summary.fixed });
    }

    /**
     * Get a specific session by ID
     */
    getSession(sessionId: string): FixSession | undefined {
        const history = this.getHistory();
        return history.sessions.find(s => s.sessionId === sessionId);
    }

    /**
     * Get all sessions (most recent first)
     */
    getSessions(): FixSession[] {
        return this.getHistory().sessions;
    }

    /**
     * Get sessions that can be reverted (not already reverted)
     */
    getRevertableSessions(): FixSession[] {
        return this.getSessions().filter(s => !s.reverted);
    }

    /**
     * Mark a session as reverted
     */
    async markReverted(sessionId: string): Promise<boolean> {
        const history = this.getHistory();
        const session = history.sessions.find(s => s.sessionId === sessionId);

        if (!session) {
            logger.warn('Session not found for revert', { sessionId });
            return false;
        }

        session.reverted = true;
        await this.saveHistory(history);
        logger.info('Marked session as reverted', { sessionId });
        return true;
    }

    /**
     * Get the most recent revertable session
     */
    getLastRevertableSession(): FixSession | undefined {
        return this.getRevertableSessions()[0];
    }

    /**
     * Clear all history
     */
    async clearHistory(): Promise<void> {
        await this.context.globalState.update(STORAGE_KEY, undefined);
        logger.info('Fix history cleared');
    }

    /**
     * Get history from storage
     */
    private getHistory(): StoredHistory {
        const stored = this.context.globalState.get<StoredHistory>(STORAGE_KEY);
        return stored ?? { sessions: [] };
    }

    /**
     * Save history to storage
     */
    private async saveHistory(history: StoredHistory): Promise<void> {
        await this.context.globalState.update(STORAGE_KEY, history);
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: FixHistoryService | null = null;

/**
 * Initialize the Fix History Service (call once during activation)
 */
export function initializeFixHistoryService(context: vscode.ExtensionContext): FixHistoryService {
    instance = new FixHistoryService(context);
    return instance;
}

/**
 * Get the Fix History Service instance
 */
export function getFixHistoryService(): FixHistoryService {
    if (!instance) {
        throw new Error('FixHistoryService not initialized. Call initializeFixHistoryService first.');
    }
    return instance;
}

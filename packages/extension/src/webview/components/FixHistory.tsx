/**
 * FixHistory Component
 * 
 * Displays recent fix sessions with revert capability.
 */

import React from 'react';
import './FixHistory.css';

export interface FixSessionDisplay {
    sessionId: string;
    timestamp: number;
    fixed: number;
    failed: number;
    files: string[];
    reverted: boolean;
}

export interface FixHistoryProps {
    /** List of fix sessions */
    sessions: FixSessionDisplay[];
    /** Called when user wants to revert a session */
    onRevert: (sessionId: string) => void;
    /** Whether a revert is in progress */
    isReverting?: boolean;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

export const FixHistory: React.FC<FixHistoryProps> = ({
    sessions,
    onRevert,
    isReverting = false,
}) => {
    if (sessions.length === 0) {
        return null; // Don't show anything if no history
    }

    const revertableSessions = sessions.filter(s => !s.reverted);

    return (
        <div className="fix-history">
            <div className="fix-history__header">
                <span className="fix-history__title">Recent Fixes</span>
                <span className="fix-history__count">{revertableSessions.length} revertable</span>
            </div>

            <div className="fix-history__list">
                {sessions.slice(0, 5).map((session) => {
                    const fileName = session.files[0]?.split('/').pop() || 'Unknown';
                    const moreFiles = session.files.length > 1 ? ` +${session.files.length - 1}` : '';

                    return (
                        <div
                            key={session.sessionId}
                            className={`fix-history__item ${session.reverted ? 'fix-history__item--reverted' : ''}`}
                        >
                            <div className="fix-history__item-info">
                                <span className="fix-history__item-summary">
                                    {session.fixed} fix{session.fixed !== 1 ? 'es' : ''}
                                    {session.failed > 0 && ` (${session.failed} failed)`}
                                </span>
                                <span className="fix-history__item-files">
                                    {fileName}{moreFiles}
                                </span>
                                <span className="fix-history__item-time">
                                    {formatRelativeTime(session.timestamp)}
                                </span>
                            </div>

                            {session.reverted ? (
                                <span className="fix-history__item-status">Reverted</span>
                            ) : (
                                <button
                                    className="fix-history__revert-button"
                                    onClick={() => onRevert(session.sessionId)}
                                    disabled={isReverting}
                                    title="Revert this fix"
                                >
                                    Revert
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

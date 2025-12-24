/**
 * DiffPreview Component
 * 
 * Shows a unified diff view of original vs fixed code before applying.
 * Provides Apply and Cancel actions.
 */

import React from 'react';
import './DiffPreview.css';

export interface DiffPreviewProps {
    /** Issue title */
    title: string;
    /** Fix description */
    description: string;
    /** File path */
    filePath: string;
    /** Line number */
    line: number;
    /** Original code snippet */
    original: string;
    /** Fixed/replacement code */
    replacement: string;
    /** Whether fix is auto-fixable (safe) */
    autoFixable: boolean;
    /** Called when user wants to apply the fix */
    onApply: () => void;
    /** Called when user cancels */
    onCancel: () => void;
    /** Whether the apply action is in progress */
    isApplying?: boolean;
}

/**
 * Compute diff lines from original and replacement
 */
function computeDiffLines(original: string, replacement: string): Array<{ type: 'context' | 'remove' | 'add'; content: string }> {
    const originalLines = original.split('\n');
    const replacementLines = replacement.split('\n');
    const lines: Array<{ type: 'context' | 'remove' | 'add'; content: string }> = [];

    // Simple diff: show all original as removed, all replacement as added
    // For more sophisticated diffs, we could use a library like `diff`
    for (const line of originalLines) {
        if (line.trim()) {
            lines.push({ type: 'remove', content: line });
        }
    }
    for (const line of replacementLines) {
        if (line.trim()) {
            lines.push({ type: 'add', content: line });
        }
    }

    return lines;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({
    title,
    description,
    filePath,
    line,
    original,
    replacement,
    autoFixable,
    onApply,
    onCancel,
    isApplying = false,
}) => {
    const diffLines = computeDiffLines(original, replacement);

    // Extract just the filename from the path
    const fileName = filePath.split('/').pop() || filePath;

    return (
        <div className="diff-preview">
            <div className="diff-preview__header">
                <div className="diff-preview__title">
                    <span className="diff-preview__icon">🔧</span>
                    <span>{title}</span>
                    {autoFixable && (
                        <span className="diff-preview__badge diff-preview__badge--safe">Safe Fix</span>
                    )}
                </div>
                <div className="diff-preview__description">{description}</div>
            </div>

            <div className="diff-preview__file-info">
                <span className="diff-preview__file-name">{fileName}</span>
                <span className="diff-preview__line">Line {line}</span>
            </div>

            <div className="diff-preview__content">
                <pre className="diff-preview__code">
                    {diffLines.map((diffLine, index) => (
                        <div
                            key={index}
                            className={`diff-preview__line diff-preview__line--${diffLine.type}`}
                        >
                            <span className="diff-preview__line-prefix">
                                {diffLine.type === 'remove' ? '-' : diffLine.type === 'add' ? '+' : ' '}
                            </span>
                            <span className="diff-preview__line-content">{diffLine.content}</span>
                        </div>
                    ))}
                </pre>
            </div>

            <div className="diff-preview__actions">
                <button
                    className="diff-preview__button diff-preview__button--cancel"
                    onClick={onCancel}
                    disabled={isApplying}
                >
                    Cancel
                </button>
                <button
                    className="diff-preview__button diff-preview__button--apply"
                    onClick={onApply}
                    disabled={isApplying}
                >
                    {isApplying ? 'Applying...' : 'Apply Fix'}
                </button>
            </div>
        </div>
    );
};

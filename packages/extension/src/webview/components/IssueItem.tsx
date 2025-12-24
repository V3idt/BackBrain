import React from 'react';
import type { IssueData, FixData } from '../messages';
import { vscode } from '../messages';
import { DiffPreview } from './DiffPreview';
import './IssueItem.css';

interface IssueItemProps {
    issue: IssueData;
    activeFix: FixData | null;
    onClearActiveFix: () => void;
}

export const IssueItem: React.FC<IssueItemProps> = ({ issue, activeFix, onClearActiveFix }) => {
    const handleClick = () => {
        vscode.postMessage({
            type: 'navigateToIssue',
            filePath: issue.filePath,
            line: issue.line,
            column: issue.column,
        });
    };

    const handleExplain = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering navigation
        vscode.postMessage({
            type: 'explainIssue',
            issue: issue,
        });
    };

    const handleSuggestFix = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering navigation
        vscode.postMessage({
            type: 'suggestFix',
            issue: issue,
        });
    };

    const fileName = issue.filePath.split('/').pop() || issue.filePath;

    // Dynamic severity colors using CSS variables
    const severityStyle = {
        '--severity-color': `var(--bb-severity-${issue.severity})`,
        '--severity-bg': `var(--bb-severity-${issue.severity}-bg)`,
    } as React.CSSProperties;

    const handleApplyFix = () => {
        if (!activeFix) return;
        vscode.postMessage({
            type: 'applyFix',
            issue: issue,
            fix: activeFix
        });
    };

    if (activeFix) {
        return (
            <div className="issue-item issue-item--fixing" style={severityStyle}>
                <DiffPreview
                    title={`Fix: ${issue.title}`}
                    description={activeFix.description}
                    filePath={issue.filePath}
                    line={issue.line}
                    original={activeFix.original || issue.snippet || ''}
                    replacement={activeFix.replacement}
                    autoFixable={activeFix.autoFixable}
                    onApply={handleApplyFix}
                    onCancel={onClearActiveFix}
                />
            </div>
        );
    }

    return (
        <div
            className="issue-item"
            onClick={handleClick}
            style={severityStyle}
        >
            {/* Header: Severity + Title */}
            <div className="issue-item-header">
                <span className="severity-badge">
                    {issue.severity}
                </span>
                <span className="issue-title">
                    {issue.title}
                </span>
            </div>

            {/* Description */}
            <div className="issue-description">
                {issue.description}
            </div>

            {/* Location */}
            <div className="issue-location">
                <span>{fileName}:{issue.line}</span>
            </div>

            {/* Snippet (if available) */}
            {issue.snippet && (
                <pre className="issue-snippet">
                    {issue.snippet}
                </pre>
            )}

            {/* AI Actions */}
            <div className="issue-actions">
                <button
                    className="action-button action-explain"
                    onClick={handleExplain}
                    title="Explain this issue with AI"
                >
                    Explain
                </button>
                <button
                    className="action-button action-fix"
                    onClick={handleSuggestFix}
                    title="Get AI-suggested fix"
                >
                    Suggest Fix
                </button>
            </div>
        </div>
    );
};


import React from 'react';
import type { IssueData } from '../messages';
import { vscode } from '../messages';
import './IssueItem.css';

interface IssueItemProps {
    issue: IssueData;
}

export const IssueItem: React.FC<IssueItemProps> = ({ issue }) => {
    const handleClick = () => {
        vscode.postMessage({
            type: 'navigateToIssue',
            filePath: issue.filePath,
            line: issue.line,
            column: issue.column,
        });
    };

    const fileName = issue.filePath.split('/').pop() || issue.filePath;

    // Dynamic severity colors using CSS variables
    const severityStyle = {
        '--severity-color': `var(--bb-severity-${issue.severity})`,
        '--severity-bg': `var(--bb-severity-${issue.severity}-bg)`,
    } as React.CSSProperties;

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
        </div>
    );
};

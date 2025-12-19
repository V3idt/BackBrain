import * as React from 'react';

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                'vscode-button': any;
                'vscode-checkbox': any;
                'vscode-dropdown': any;
                'vscode-option': any;
                'vscode-text-field': any;
                'vscode-text-area': any;
                'vscode-divider': any;
                'vscode-link': any;
                'vscode-progress-ring': any;
                'vscode-tag': any;
                'vscode-badge': any;
                'vscode-panels': any;
                'vscode-panel-view': any;
                'vscode-panel-tab': any;
                'vscode-data-grid': any;
                'vscode-data-grid-row': any;
                'vscode-data-grid-cell': any;
            }
        }
    }
}

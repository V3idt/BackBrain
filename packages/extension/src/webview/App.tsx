import React from 'react';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodePanelTab, vsCodePanelView, vsCodePanels } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodePanelTab(), vsCodePanelView(), vsCodePanels());

const App: React.FC = () => {
    return (
        <div style={{ padding: 'var(--container-padding)' }}>
            <h1>BackBrain Security</h1>
            <p>Severity Panel Placeholder</p>
            <vscode-button>Scan Workspace</vscode-button>
        </div>
    );
};



export default App;

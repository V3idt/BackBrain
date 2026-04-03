import * as vscode from 'vscode';

const PREVIEW_SCHEME = 'backbrain-fix-preview';

class FixPreviewProvider implements vscode.TextDocumentContentProvider {
    private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
    private readonly documents = new Map<string, string>();

    readonly onDidChange = this.emitter.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.documents.get(uri.toString()) || '';
    }

    setContent(uri: vscode.Uri, content: string): void {
        this.documents.set(uri.toString(), content);
        this.emitter.fire(uri);
    }

    delete(uri: vscode.Uri): void {
        this.documents.delete(uri.toString());
    }

    createUri(filePath: string, title: string): vscode.Uri {
        const encodedPath = encodeURIComponent(filePath);
        const encodedTitle = encodeURIComponent(title);
        return vscode.Uri.parse(`${PREVIEW_SCHEME}:${encodedPath}?title=${encodedTitle}`);
    }
}

let instance: FixPreviewProvider | null = null;

export function registerFixPreviewProvider(context: vscode.ExtensionContext): FixPreviewProvider {
    if (!instance) {
        instance = new FixPreviewProvider();
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, instance)
        );
    }

    return instance;
}

export function getFixPreviewProvider(): FixPreviewProvider {
    if (!instance) {
        throw new Error('FixPreviewProvider not initialized. Call registerFixPreviewProvider first.');
    }

    return instance;
}

import * as vscode from 'vscode';
import type { FileSystem, FileInfo } from '@backbrain/core';

export class VSCodeFileSystem implements FileSystem {
  private toUri(path: string): vscode.Uri {
    try {
      // Handle URI strings (e.g., file:///path or vscode-vfs://...)
      if (/^[a-z0-9.+-]+:\/\//i.test(path)) {
        return vscode.Uri.parse(path);
      }
    } catch {
      // Fallback to standard file path if parsing fails
    }
    return vscode.Uri.file(path);
  }

  async readFile(path: string): Promise<string> {
    const uri = this.toUri(path);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    const uri = this.toUri(path);
    const bytes = Buffer.from(content, 'utf-8');
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const uri = this.toUri(path);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async readDir(path: string): Promise<FileInfo[]> {
    const uri = this.toUri(path);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, type]) => ({
      path: `${path}/${name}`,
      name,
      isDirectory: type === vscode.FileType.Directory,
    }));
  }

  watch(path: string, callback: (event: 'change' | 'delete', path: string) => void): () => void {
    const uri = this.toUri(path);

    // If watching a specific file, don't use a broad glob pattern
    const pattern = path.includes('.') ? uri.fsPath : new vscode.RelativePattern(uri, '**/*');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange((e) => callback('change', e.fsPath));
    watcher.onDidDelete((e) => callback('delete', e.fsPath));

    return () => watcher.dispose();
  }
}

// Local Files sidebar: user-added folder/file roots, browsed lazily one level at a time.

import * as vscode from 'vscode';
import * as path from 'path';
import { listMediaDir, MediaKind, mediaKind } from './library';

export interface RootEntry {
  path: string;
  type: 'dir' | 'file';
}

export type LibraryNode = RootItem | DirItem | FileItem;

export class FileItem extends vscode.TreeItem {
  constructor(public readonly filePath: string, public readonly kind: MediaKind) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(kind === 'video' ? 'file-video' : 'file-media');
    this.contextValue = 'mediaFile';
    this.tooltip = filePath;
    this.resourceUri = vscode.Uri.file(filePath);
    this.command = { command: 'musicPlayer.playFile', title: 'Play', arguments: [this] };
  }
}

export class DirItem extends vscode.TreeItem {
  constructor(public readonly dirPath: string) {
    super(path.basename(dirPath), vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = vscode.ThemeIcon.Folder;
    this.contextValue = 'dir';
    this.tooltip = dirPath;
    this.resourceUri = vscode.Uri.file(dirPath);
  }
}

export class RootItem extends vscode.TreeItem {
  readonly filePath: string;
  constructor(public readonly entry: RootEntry) {
    super(
      path.basename(entry.path),
      entry.type === 'dir' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    this.filePath = entry.path;
    this.description = entry.path;
    this.tooltip = entry.path;
    this.contextValue = 'root';
    if (entry.type === 'dir') {
      this.iconPath = vscode.ThemeIcon.Folder;
    } else {
      const kind = mediaKind(entry.path) ?? 'audio';
      this.iconPath = new vscode.ThemeIcon(kind === 'video' ? 'file-video' : 'file-media');
      this.command = { command: 'musicPlayer.playFile', title: 'Play', arguments: [this] };
    }
  }
}

export class LibraryProvider implements vscode.TreeDataProvider<LibraryNode> {
  private readonly emitter = new vscode.EventEmitter<LibraryNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly getRoots: () => RootEntry[]) {}

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(element: LibraryNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LibraryNode): LibraryNode[] {
    if (!element) {
      return this.getRoots().map(r => new RootItem(r));
    }
    if (element instanceof RootItem) {
      return element.entry.type === 'dir' ? this.listDir(element.entry.path) : [];
    }
    if (element instanceof DirItem) {
      return this.listDir(element.dirPath);
    }
    return [];
  }

  private listDir(dir: string): LibraryNode[] {
    const listing = listMediaDir(dir);
    return [
      ...listing.dirs.map(d => new DirItem(d)),
      ...listing.files.map(f => new FileItem(f.path, f.kind))
    ];
  }
}
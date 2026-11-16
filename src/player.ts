// Host side of the player webview panel. Playback keeps running when the tab is hidden
// thanks to retainContextWhenHidden; closing the panel stops playback.

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { getPlayerHtml } from './playerHtml';

export interface Track {
  kind: 'radio' | 'file';
  title: string;
  subtitle: string;
  url: string;
  favicon?: string;
  isVideo: boolean;
  hls: boolean;
}

export interface PlayerState {
  track?: Track;
  playing: boolean;
}

export class Player implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private ready = false;
  private pending: Track | undefined;
  private current: Track | undefined;
  private playing = false;
  private readonly stateEmitter = new vscode.EventEmitter<PlayerState>();
  readonly onDidChangeState = this.stateEmitter.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getVolume: () => number,
    private readonly setVolume: (value: number) => void
  ) {}

  get state(): PlayerState {
    return { track: this.current, playing: this.playing };
  }

  play(track: Track): void {
    this.current = track;
    this.ensurePanel();
    this.panel!.reveal(vscode.ViewColumn.Beside, true);
    if (this.ready) {
      this.panel!.webview.postMessage({ type: 'play', track });
    } else {
      this.pending = track;
    }
    this.emit();
  }

  reveal(): void {
    this.ensurePanel();
    this.panel!.reveal(undefined, true);
  }

  toggle(): void {
    if (!this.panel || !this.current) { return; }
    this.panel.webview.postMessage({ type: this.playing ? 'pause' : 'resume' });
  }

  stop(): void {
    this.panel?.webview.postMessage({ type: 'stop' });
    this.current = undefined;
    this.playing = false;
    this.emit();
  }

  private ensurePanel(): void {
    if (this.panel) { return; }
    this.panel = vscode.window.createWebviewPanel(
      'musicPlayer.player',
      'Music Player',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );
    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'music.svg');
    const nonce = crypto.randomBytes(16).toString('hex');
    const hlsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'hls.js', 'dist', 'hls.min.js')
    ).toString();
    this.panel.webview.html = getPlayerHtml({
      cspSource: this.panel.webview.cspSource,
      nonce,
      hlsUri
    });
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'ready') {
        this.ready = true;
        this.panel?.webview.postMessage({ type: 'setVolume', value: this.getVolume() });
        if (this.pending) {
          this.panel?.webview.postMessage({ type: 'play', track: this.pending });
          this.pending = undefined;
        }
      } else if (msg.type === 'state') {
        this.playing = !!msg.playing;
        this.emit();
      } else if (msg.type === 'volumeChanged') {
        this.setVolume(Number(msg.value));
      }
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.ready = false;
      this.pending = undefined;
      this.current = undefined;
      this.playing = false;
      this.emit();
    });
  }

  private emit(): void {
    this.stateEmitter.fire(this.state);
  }

  dispose(): void {
    this.panel?.dispose();
    this.stateEmitter.dispose();
  }
}
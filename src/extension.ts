// Activation entry: wires the file server, trees, player, status bar and commands.

import * as vscode from 'vscode';
import { createFileServer } from './fileServer';
import { Station } from './radioBrowser';
import { Player, PlayerState } from './player';
import { RadioProvider } from './radioTree';
import { LibraryProvider, RootEntry } from './libraryTree';
import { registerCommands } from './commands';

const FAVORITES_KEY = 'musicPlayer.favorites';
const ROOTS_KEY = 'musicPlayer.roots';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const fileServer = await createFileServer();

  const getFavorites = () => context.globalState.get<Station[]>(FAVORITES_KEY, []);
  const setFavorites = (favorites: Station[]) => context.globalState.update(FAVORITES_KEY, favorites);
  const getRoots = () => context.globalState.get<RootEntry[]>(ROOTS_KEY, []);
  const setRoots = (roots: RootEntry[]) => context.globalState.update(ROOTS_KEY, roots);

  const radio = new RadioProvider(getFavorites);
  const library = new LibraryProvider(getRoots);

  const getVolume = () => vscode.workspace.getConfiguration('musicPlayer').get<number>('volume', 80);
  const setVolume = (value: number) =>
    vscode.workspace.getConfiguration('musicPlayer').update('volume', value, vscode.ConfigurationTarget.Global);
  const player = new Player(context.extensionUri, getVolume, setVolume);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'musicPlayer.showPlayer';
  const renderStatus = (state: PlayerState) => {
    if (!state.track) {
      statusBar.hide();
      return;
    }
    const name = state.track.title.length > 40 ? state.track.title.slice(0, 37) + '...' : state.track.title;
    statusBar.text = (state.playing ? '$(unmute) ' : '$(mute) ') + name;
    statusBar.tooltip = 'Music Player: ' + state.track.title + (state.playing ? ' (playing)' : ' (paused)') + ' — click to show';
    statusBar.show();
  };
  player.onDidChangeState(renderStatus);

  const updateContextKeys = () => {
    void vscode.commands.executeCommand('setContext', 'musicPlayer.radioEmpty', getFavorites().length === 0 && radio.resultCount === 0);
    void vscode.commands.executeCommand('setContext', 'musicPlayer.libraryEmpty', getRoots().length === 0);
  };

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('musicPlayer.radioView', radio),
    vscode.window.registerTreeDataProvider('musicPlayer.libraryView', library),
    statusBar,
    player,
    { dispose: () => { void fileServer.close(); } },
    registerCommands({
      player,
      radio,
      library,
      fileServer,
      getFavorites,
      setFavorites,
      getRoots,
      setRoots,
      updateContextKeys
    })
  );

  updateContextKeys();
}

export function deactivate(): void {
  // Disposables in context.subscriptions handle cleanup (player panel, file server).
}
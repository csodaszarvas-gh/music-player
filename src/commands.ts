// All command handlers for the Music Player extension.

import * as vscode from 'vscode';
import * as path from 'path';
import { searchStations, topTags, topCountries, topLanguages, topCodecs, trackClick, streamUrl, isHls, Station, TagInfo, SearchOptions } from './radioBrowser';
import { mediaKind } from './library';
import { FileServer } from './fileServer';
import { Player } from './player';
import { RadioProvider, StationItem } from './radioTree';
import { LibraryProvider, RootItem, FileItem, RootEntry } from './libraryTree';

export interface CommandDeps {
  player: Player;
  radio: RadioProvider;
  library: LibraryProvider;
  fileServer: FileServer;
  getFavorites: () => Station[];
  setFavorites: (favorites: Station[]) => Thenable<void>;
  getRoots: () => RootEntry[];
  setRoots: (roots: RootEntry[]) => Thenable<void>;
  updateContextKeys: () => void;
}

const MEDIA_FILTERS = {
  'Media files': ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi', 'ogv']
};

function resultLimit(): number {
  return vscode.workspace.getConfiguration('musicPlayer').get<number>('radioResultLimit', 100);
}

export function registerCommands(deps: CommandDeps): vscode.Disposable {
  const { player, radio, library, fileServer } = deps;

  const runSearch = async (label: string, opts: Omit<SearchOptions, 'limit'>) => {
    try {
      const stations = await searchStations({ ...opts, limit: resultLimit() });
      radio.setResults(stations, label);
      deps.updateContextKeys();
      if (!stations.length) {
        vscode.window.showInformationMessage('Music Player: no stations found for this search.');
      }
    } catch (err) {
      vscode.window.showErrorMessage('Music Player: radio search failed (' + (err instanceof Error ? err.message : String(err)) + ').');
    }
  };

  // Shared flow for the browse-by pickers (tag, country, language, codec).
  const browseBy = async (
    load: () => Promise<TagInfo[]>,
    what: string,
    placeHolder: string,
    toFilter: (name: string) => Omit<SearchOptions, 'limit'>,
    labelPrefix: string
  ) => {
    let items;
    try {
      items = await load();
    } catch (err) {
      vscode.window.showErrorMessage('Music Player: could not load radio ' + what + ' (' + (err instanceof Error ? err.message : String(err)) + ').');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      items.map(t => ({ label: t.name, description: t.stationcount + ' stations' })),
      { placeHolder, matchOnDescription: true }
    );
    if (!pick) { return; }
    await runSearch(labelPrefix + pick.label, toFilter(pick.label));
  };

  const disposables: vscode.Disposable[] = [
    vscode.commands.registerCommand('musicPlayer.searchRadio', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Search radio stations by name',
        placeHolder: 'e.g. jazz, news, lo-fi'
      });
      if (!name || !name.trim()) { return; }
      await runSearch('Results: ' + name.trim(), { name: name.trim() });
    }),

    vscode.commands.registerCommand('musicPlayer.browseTags', () =>
      browseBy(() => topTags(150), 'tags', 'Pick a tag to browse stations', name => ({ tag: name }), 'Tag: ')),

    vscode.commands.registerCommand('musicPlayer.browseCountries', () =>
      browseBy(() => topCountries(250), 'countries', 'Pick a country to browse stations', name => ({ country: name }), 'Country: ')),

    vscode.commands.registerCommand('musicPlayer.browseLanguages', () =>
      browseBy(() => topLanguages(150), 'languages', 'Pick a language to browse stations', name => ({ language: name }), 'Language: ')),

    vscode.commands.registerCommand('musicPlayer.browseCodecs', () =>
      browseBy(() => topCodecs(50), 'codecs', 'Pick a codec to browse stations', name => ({ codec: name }), 'Codec: ')),

    vscode.commands.registerCommand('musicPlayer.topStations', async () => {
      await runSearch('Top Stations', {});
    }),

    vscode.commands.registerCommand('musicPlayer.playStation', (arg: StationItem | Station) => {
      const station = arg instanceof StationItem ? arg.station : arg;
      if (!station) { return; }
      const url = streamUrl(station);
      if (!url) {
        vscode.window.showErrorMessage('Music Player: this station has no stream URL.');
        return;
      }
      trackClick(station.stationuuid);
      const subtitle = [station.country, station.tags].filter(Boolean).join(' • ');
      player.play({
        kind: 'radio',
        title: station.name.trim() || 'Radio',
        subtitle,
        url,
        favicon: station.favicon || undefined,
        isVideo: false,
        hls: isHls(station)
      });
    }),

    vscode.commands.registerCommand('musicPlayer.toggleFavorite', async (arg: StationItem) => {
      if (!arg) { return; }
      const favorites = deps.getFavorites();
      const index = favorites.findIndex(s => s.stationuuid === arg.station.stationuuid);
      if (index >= 0) {
        favorites.splice(index, 1);
      } else {
        favorites.push(arg.station);
      }
      await deps.setFavorites(favorites);
      radio.refresh();
      deps.updateContextKeys();
    }),

    vscode.commands.registerCommand('musicPlayer.addFolder', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Add Music Folder'
      });
      if (!picked || !picked.length) { return; }
      const roots = deps.getRoots();
      const fsPath = picked[0].fsPath;
      if (!roots.some(r => r.path === fsPath)) {
        roots.push({ path: fsPath, type: 'dir' });
        await deps.setRoots(roots);
      }
      library.refresh();
      deps.updateContextKeys();
    }),

    vscode.commands.registerCommand('musicPlayer.addFiles', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        filters: MEDIA_FILTERS,
        openLabel: 'Add Files'
      });
      if (!picked || !picked.length) { return; }
      const roots = deps.getRoots();
      for (const uri of picked) {
        if (!roots.some(r => r.path === uri.fsPath)) {
          roots.push({ path: uri.fsPath, type: 'file' });
        }
      }
      await deps.setRoots(roots);
      library.refresh();
      deps.updateContextKeys();
    }),

    vscode.commands.registerCommand('musicPlayer.removeRoot', async (arg: RootItem) => {
      if (!arg) { return; }
      const roots = deps.getRoots().filter(r => r.path !== arg.entry.path);
      await deps.setRoots(roots);
      library.refresh();
      deps.updateContextKeys();
    }),

    vscode.commands.registerCommand('musicPlayer.refreshLibrary', () => {
      library.refresh();
    }),

    vscode.commands.registerCommand('musicPlayer.playFile', (arg: FileItem | RootItem) => {
      const filePath = arg?.filePath;
      if (!filePath) { return; }
      const kind = mediaKind(filePath);
      if (!kind) {
        vscode.window.showErrorMessage('Music Player: unsupported file type.');
        return;
      }
      fileServer.allow(filePath);
      player.play({
        kind: 'file',
        title: path.basename(filePath),
        subtitle: filePath,
        url: fileServer.urlFor(filePath),
        isVideo: kind === 'video',
        hls: false
      });
    }),

    vscode.commands.registerCommand('musicPlayer.showPlayer', () => {
      player.reveal();
    }),

    vscode.commands.registerCommand('musicPlayer.playPause', () => {
      player.toggle();
    }),

    vscode.commands.registerCommand('musicPlayer.stop', () => {
      player.stop();
    })
  ];

  return vscode.Disposable.from(...disposables);
}
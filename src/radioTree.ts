// Radio sidebar: Favorites section (persisted) plus the latest search results.

import * as vscode from 'vscode';
import { Station } from './radioBrowser';

export type RadioNode = SectionItem | StationItem;

export class SectionItem extends vscode.TreeItem {
  constructor(label: string, public readonly section: 'favorites' | 'results', count: number) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = String(count);
    this.contextValue = 'section';
    this.iconPath = new vscode.ThemeIcon(section === 'favorites' ? 'star-full' : 'search');
  }
}

export class StationItem extends vscode.TreeItem {
  constructor(public readonly station: Station, public readonly favorite: boolean) {
    super(station.name.trim() || 'Unnamed station', vscode.TreeItemCollapsibleState.None);
    const bits: string[] = [];
    if (station.countrycode) { bits.push(station.countrycode); }
    if (station.bitrate) { bits.push(station.bitrate + ' kbps'); }
    if (station.codec) { bits.push(station.codec); }
    this.description = bits.join(' • ');
    const lines = [station.name];
    if (station.tags) { lines.push('Tags: ' + station.tags); }
    if (station.country) { lines.push('Country: ' + station.country); }
    if (station.homepage) { lines.push(station.homepage); }
    this.tooltip = lines.join('\n');
    this.contextValue = favorite ? 'favoriteStation' : 'station';
    this.iconPath = new vscode.ThemeIcon('radio-tower');
    this.command = { command: 'musicPlayer.playStation', title: 'Play', arguments: [this] };
  }
}

export class RadioProvider implements vscode.TreeDataProvider<RadioNode> {
  private readonly emitter = new vscode.EventEmitter<RadioNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private results: Station[] = [];
  private resultsLabel = 'Search Results';

  constructor(private readonly getFavorites: () => Station[]) {}

  get resultCount(): number {
    return this.results.length;
  }

  setResults(stations: Station[], label: string): void {
    this.results = stations;
    this.resultsLabel = label;
    this.emitter.fire(undefined);
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  getTreeItem(element: RadioNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RadioNode): RadioNode[] {
    if (!element) {
      const out: RadioNode[] = [];
      const favs = this.getFavorites();
      if (favs.length) { out.push(new SectionItem('Favorites', 'favorites', favs.length)); }
      if (this.results.length) { out.push(new SectionItem(this.resultsLabel, 'results', this.results.length)); }
      return out;
    }
    if (element instanceof SectionItem) {
      const list = element.section === 'favorites' ? this.getFavorites() : this.results;
      const favIds = new Set(this.getFavorites().map(s => s.stationuuid));
      return list.map(s => new StationItem(s, favIds.has(s.stationuuid)));
    }
    return [];
  }
}
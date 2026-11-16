// Radio sidebar: Favorites section (persisted) plus the latest search results.

import * as vscode from 'vscode';
import { Station, SearchOptions } from './radioBrowser';

export type RadioNode = SectionItem | StationItem | LoadMoreItem;

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

export class LoadMoreItem extends vscode.TreeItem {
  constructor(loaded: number) {
    super('Load More…', vscode.TreeItemCollapsibleState.None);
    this.description = loaded + ' loaded';
    this.contextValue = 'loadMore';
    this.iconPath = new vscode.ThemeIcon('arrow-down');
    this.tooltip = 'Fetch the next page of stations for this search';
    this.command = { command: 'musicPlayer.loadMoreResults', title: 'Load More' };
  }
}

export class RadioProvider implements vscode.TreeDataProvider<RadioNode> {
  private readonly emitter = new vscode.EventEmitter<RadioNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private results: Station[] = [];
  private resultsLabel = 'Search Results';
  private query: Omit<SearchOptions, 'limit' | 'offset'> | undefined;
  private fetched = 0;
  private exhausted = true;

  constructor(private readonly getFavorites: () => Station[]) {}

  get resultCount(): number {
    return this.results.length;
  }

  get currentQuery(): Omit<SearchOptions, 'limit' | 'offset'> | undefined {
    return this.query;
  }

  // Offset for the next page: total rows fetched so far (before dedupe).
  get nextOffset(): number {
    return this.fetched;
  }

  get canLoadMore(): boolean {
    return this.query !== undefined && !this.exhausted;
  }

  setResults(stations: Station[], label: string, query: Omit<SearchOptions, 'limit' | 'offset'>, pageSize: number): void {
    this.results = stations;
    this.resultsLabel = label;
    this.query = query;
    this.fetched = stations.length;
    this.exhausted = stations.length < pageSize;
    this.emitter.fire(undefined);
  }

  appendResults(stations: Station[], pageSize: number): void {
    const seen = new Set(this.results.map(s => s.stationuuid));
    for (const s of stations) {
      if (!seen.has(s.stationuuid)) {
        seen.add(s.stationuuid);
        this.results.push(s);
      }
    }
    this.fetched += stations.length;
    this.exhausted = stations.length < pageSize;
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
      const items: RadioNode[] = list.map(s => new StationItem(s, favIds.has(s.stationuuid)));
      if (element.section === 'results' && this.canLoadMore) {
        items.push(new LoadMoreItem(this.results.length));
      }
      return items;
    }
    return [];
  }
}
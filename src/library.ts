// Local media library browsing helpers. No vscode import (container-testable).

import * as fs from 'fs';
import * as path from 'path';

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac', '.wma']);
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.mkv', '.mov', '.avi', '.ogv']);

export type MediaKind = 'audio' | 'video';

export interface MediaEntry {
  name: string;
  path: string;
  kind: MediaKind;
}

export interface DirListing {
  dirs: string[];
  files: MediaEntry[];
}

export function mediaKind(filePath: string): MediaKind | undefined {
  const ext = path.extname(filePath).toLowerCase();
  if (AUDIO_EXTENSIONS.has(ext)) { return 'audio'; }
  if (VIDEO_EXTENSIONS.has(ext)) { return 'video'; }
  return undefined;
}

// Lazy one-level listing: the tree expands folders on demand, so huge libraries stay cheap.
export function listMediaDir(dir: string): DirListing {
  const dirs: string[] = [];
  const files: MediaEntry[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { dirs, files };
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) { continue; }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      dirs.push(full);
    } else if (e.isFile()) {
      const kind = mediaKind(full);
      if (kind) { files.push({ name: e.name, path: full, kind }); }
    }
  }
  dirs.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { dirs, files };
}
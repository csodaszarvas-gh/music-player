// Loopback HTTP server that streams user-approved local media files to the player webview,
// with Range support so seeking works. No vscode import (container-testable).

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg'
};

export interface FileServer {
  readonly port: number;
  allow(filePath: string): void;
  urlFor(filePath: string): string;
  close(): Promise<void>;
}

export function createFileServer(): Promise<FileServer> {
  const token = crypto.randomBytes(16).toString('hex');
  const allowed = new Set<string>();

  const server = http.createServer((req, res) => {
    const fail = (code: number) => { res.writeHead(code); res.end(); };
    let u: URL;
    try {
      u = new URL(req.url ?? '/', 'http://127.0.0.1');
    } catch {
      return fail(400);
    }
    if (u.pathname !== '/media' || u.searchParams.get('token') !== token) {
      return fail(403);
    }
    const filePath = path.resolve(u.searchParams.get('path') ?? '');
    if (!allowed.has(filePath)) {
      return fail(403);
    }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        return fail(404);
      }
      const mime = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      const size = st.size;
      let start = 0;
      let end = size - 1;
      let status = 200;
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (!m || (m[1] === '' && m[2] === '')) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + size });
          res.end();
          return;
        }
        if (m[1] === '') {
          start = size - Math.min(parseInt(m[2], 10), size);
        } else {
          start = parseInt(m[1], 10);
          if (m[2] !== '') {
            end = Math.min(parseInt(m[2], 10), size - 1);
          }
        }
        if (start >= size || start > end) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + size });
          res.end();
          return;
        }
        status = 206;
      }
      const headers: Record<string, string | number> = {
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1
      };
      if (status === 206) {
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
      }
      res.writeHead(status, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
  });

  return new Promise<FileServer>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        port,
        allow: (p) => { allowed.add(path.resolve(p)); },
        urlFor: (p) => 'http://127.0.0.1:' + port + '/media?token=' + token + '&path=' + encodeURIComponent(path.resolve(p)),
        close: () => new Promise<void>((r) => server.close(() => r()))
      });
    });
  });
}
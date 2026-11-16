# Music Player

Listen to internet radio and local audio/video files without leaving VS Code or Qoder IDE. Radio stations come from the community [Radio Browser](https://www.radio-browser.info/) API.

## Features

- **Radio**: search stations by name, browse by tag/genre, or list the most popular stations; favorite stations are kept between sessions
- **Local files**: add music folders or individual files to a library tree and play them (audio and video)
- Player panel with play/pause, stop, seek (local files), volume and station info; HLS radio streams supported via hls.js
- Playback keeps running while the player tab is hidden; a status bar item shows the current track (click it to reopen the player)
- Local files are served through a loopback-only HTTP server with a random token, restricted to files you explicitly added

Supported local formats: mp3, m4a, aac, ogg, opus, wav, flac, wma (audio) and mp4, m4v, webm, mkv, mov, avi, ogv (video). Actual playback depends on the codecs supported by the IDE's embedded browser (e.g. some mkv/avi codec combinations may not play).

## Install / update

Requires VS Code 1.102 or later (also works in Qoder IDE).

### Windows (PowerShell)

Run this line — it installs the latest release, or updates an existing install:

```powershell
irm https://raw.githubusercontent.com/csodaszarvas-gh/music-player/main/install.ps1 | iex
```

### Linux (bash)

```bash
curl -fsSL https://raw.githubusercontent.com/csodaszarvas-gh/music-player/main/install.sh | bash
```

Both scripts detect VS Code (`code` on PATH), VSCodium (`codium`) or Qoder IDE automatically. To force a specific CLI, set `EXTENSION_CLI` first (PowerShell: `$env:EXTENSION_CLI = 'C:\path\to\code.cmd'`, bash: `export EXTENSION_CLI=/path/to/code`).

Manual alternative: download the `.vsix` from the [latest release](https://github.com/csodaszarvas-gh/music-player/releases/latest), then run `code --install-extension <file>.vsix` or use *Extensions → … → Install from VSIX…* in the IDE.

## Usage

After installing, reload the window and open the **Music** icon in the activity bar:

- **Radio** view: use the search / tag buttons in the view title, then click a station (or its play icon) to listen. Star a station to keep it in Favorites.
- **Local Files** view: *Add Folder* or *Add Files*, then click any media file to play it. Folders are listed lazily, one level at a time.
- Commands are also available from the palette under *Music Player* (Play / Pause, Stop, Show Player…).
- Settings: `musicPlayer.volume` (percent) and `musicPlayer.radioResultLimit` (max stations per search).

Closing the player tab stops playback; hiding it (switching tabs) does not.

## Releasing a new version

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.1.0 && git push origin main v0.1.0`
3. GitHub Actions compiles, packages the `.vsix` and publishes the release automatically.

## Development

```bash
npm install
npm run compile   # tsc src/ -> out/
npm run package   # vsce package -> .vsix
```

## License

[MIT](LICENSE)
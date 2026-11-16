#!/usr/bin/env bash
# Installs or updates the Music Player extension from the latest GitHub release.
# Usage:  curl -fsSL https://raw.githubusercontent.com/csodaszarvas-gh/music-player/main/install.sh | bash
# Override the IDE CLI with:  EXTENSION_CLI=/path/to/code bash install.sh
set -euo pipefail

repo="csodaszarvas-gh/music-player"

fetch() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$1"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$1"
    else
        echo "Error: curl or wget is required." >&2
        exit 1
    fi
}

# Find a VS Code-compatible CLI: explicit override, then code/codium on PATH, then common Qoder IDE locations.
cli="${EXTENSION_CLI:-}"
if [ -z "$cli" ]; then
    for name in code codium; do
        if command -v "$name" >/dev/null 2>&1; then
            cli=$(command -v "$name")
            break
        fi
    done
fi
if [ -z "$cli" ]; then
    for candidate in /opt/qoder*/bin/code /opt/Qoder*/bin/code /usr/share/qoder*/bin/code /usr/lib/qoder*/bin/code; do
        if [ -x "$candidate" ]; then
            cli="$candidate"
            break
        fi
    done
fi
if [ -z "$cli" ]; then
    echo "Error: no VS Code-compatible CLI found. Install VS Code / Qoder IDE, or set EXTENSION_CLI to its CLI path." >&2
    exit 1
fi

# Resolve the .vsix asset of the latest release.
asset_url=$(fetch "https://api.github.com/repos/$repo/releases/latest" \
    | grep -o '"browser_download_url":[[:space:]]*"[^"]*\.vsix"' \
    | head -n1 | cut -d'"' -f4 || true)
if [ -z "$asset_url" ]; then
    echo "Error: no .vsix asset found in the latest release of $repo." >&2
    exit 1
fi

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
vsix="$tmpdir/$(basename "$asset_url")"
echo "Downloading $(basename "$asset_url")..."
if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$asset_url" -o "$vsix"
else
    wget -qO "$vsix" "$asset_url"
fi

echo "Installing with $cli..."
"$cli" --install-extension "$vsix" --force
echo "Done. Reload the IDE window if it is already open."
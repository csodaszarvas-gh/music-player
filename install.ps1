# Installs or updates the Music Player extension from the latest GitHub release.
# Usage:  irm https://raw.githubusercontent.com/csodaszarvas-gh/music-player/main/install.ps1 | iex
# Override the IDE CLI with:  $env:EXTENSION_CLI = 'C:\path\to\code.cmd'
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = 'csodaszarvas-gh/music-player'

# Find a VS Code-compatible CLI: explicit override, then `code` / `codium` on PATH, then Qoder IDE.
$cli = $env:EXTENSION_CLI
if (-not $cli) {
    foreach ($name in 'code', 'codium') {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { $cli = $cmd.Source; break }
    }
}
if (-not $cli) {
    $qoder = Join-Path $env:LOCALAPPDATA 'Programs\Qoder IDE\bin\code.cmd'
    if (Test-Path $qoder) { $cli = $qoder }
}
if (-not $cli) {
    throw 'No VS Code-compatible CLI found. Install VS Code / Qoder IDE, or set $env:EXTENSION_CLI to its CLI path.'
}

# Resolve the .vsix asset of the latest release.
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'vsix-installer' }
$asset = @($release.assets | Where-Object { $_.name -like '*.vsix' })[0]
if (-not $asset) { throw "No .vsix asset found in the latest release of $repo." }

$vsix = Join-Path ([System.IO.Path]::GetTempPath()) $asset.name
Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $vsix

Write-Host "Installing with $cli..."
& $cli --install-extension $vsix --force
if ($LASTEXITCODE -ne 0) { throw "Extension install failed (exit code $LASTEXITCODE)." }
Write-Host 'Done. Reload the IDE window if it is already open.'
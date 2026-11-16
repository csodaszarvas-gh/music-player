// Player webview HTML. The embedded script deliberately avoids backticks and regex
// so the surrounding TS template literal cannot corrupt it (see editorHtml.ts lesson).
// No vscode import: the emitted script can be parse-checked with vm.Script in the container.

export interface PlayerHtmlOptions {
  cspSource: string;
  nonce: string;
  hlsUri: string;
}

export function getPlayerHtml(opts: PlayerHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${opts.nonce}'; style-src 'unsafe-inline'; img-src ${opts.cspSource} https: data:; media-src ${opts.cspSource} http: https: blob:; connect-src ${opts.cspSource} http: https:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Music Player</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100vh;
    box-sizing: border-box;
  }
  [hidden] { display: none !important; }
  header { display: flex; align-items: center; gap: 12px; }
  #art, #artPlaceholder {
    width: 48px; height: 48px; border-radius: 6px; flex: none;
    background: var(--vscode-editor-inactiveSelectionBackground);
  }
  #art { object-fit: cover; }
  #artPlaceholder { display: flex; align-items: center; justify-content: center; }
  #artPlaceholder svg { width: 26px; height: 26px; opacity: 0.7; }
  .meta { min-width: 0; }
  #title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #subtitle { font-size: 12px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #stage {
    flex: 1; min-height: 120px; display: flex; align-items: center; justify-content: center;
    background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; overflow: hidden;
  }
  #media { width: 100%; height: 100%; object-fit: contain; background: #000; }
  #audioArt svg { width: 96px; height: 96px; opacity: 0.45; }
  #error {
    color: var(--vscode-errorForeground);
    background: var(--vscode-inputValidation-errorBackground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
    padding: 8px 10px; border-radius: 6px; font-size: 12px;
  }
  #controls { display: flex; align-items: center; gap: 10px; }
  #controls button {
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    border: none; border-radius: 4px; width: 36px; height: 30px; cursor: pointer; font-size: 12px; flex: none;
  }
  #controls button:hover { background: var(--vscode-button-hoverBackground); }
  #seek { flex: 1; }
  #volume { width: 90px; flex: none; }
  .time { font-size: 11px; opacity: 0.8; min-width: 40px; text-align: center; flex: none; }
  input[type=range] { accent-color: var(--vscode-button-background); }
</style>
</head>
<body>
<header>
  <img id="art" alt="" hidden>
  <div id="artPlaceholder">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M10 18V5l10-2v13" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="meta">
    <div id="title">Nothing playing</div>
    <div id="subtitle">Pick a radio station or a local file from the Music sidebar.</div>
  </div>
</header>
<div id="stage">
  <video id="media" playsinline hidden></video>
  <div id="audioArt">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M10 18V5l10-2v13" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
</div>
<div id="error" hidden></div>
<div id="controls">
  <button id="playPause" title="Play / Pause">&#9654;</button>
  <button id="stop" title="Stop">&#9632;</button>
  <span id="current" class="time">0:00</span>
  <input id="seek" type="range" min="0" max="1000" value="0" disabled>
  <span id="duration" class="time">0:00</span>
  <input id="volume" type="range" min="0" max="100" value="80" title="Volume">
</div>
<script src="${opts.hlsUri}" nonce="${opts.nonce}"></script>
<script nonce="${opts.nonce}">
(function () {
  var vscode = acquireVsCodeApi();
  var media = document.getElementById('media');
  var playPauseBtn = document.getElementById('playPause');
  var stopBtn = document.getElementById('stop');
  var seek = document.getElementById('seek');
  var volumeInput = document.getElementById('volume');
  var currentEl = document.getElementById('current');
  var durationEl = document.getElementById('duration');
  var titleEl = document.getElementById('title');
  var subtitleEl = document.getElementById('subtitle');
  var artImg = document.getElementById('art');
  var artPlaceholder = document.getElementById('artPlaceholder');
  var audioArt = document.getElementById('audioArt');
  var errorEl = document.getElementById('error');

  var hls = null;
  var current = null;
  var volume = 80;
  var saved = vscode.getState();
  if (saved && typeof saved.volume === 'number') { volume = saved.volume; }
  volumeInput.value = String(volume);
  media.volume = volume / 100;

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) { return '0:00'; }
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function showError(msg) { errorEl.textContent = msg; errorEl.hidden = false; }
  function clearError() { errorEl.hidden = true; errorEl.textContent = ''; }
  function destroyHls() { if (hls) { try { hls.destroy(); } catch (e) { /* ignore */ } hls = null; } }
  function updatePlayButton() { playPauseBtn.textContent = media.paused ? '\u25B6' : '\u275A\u275A'; }
  function postState() {
    vscode.postMessage({
      type: 'state',
      playing: !media.paused && !!current,
      title: current ? current.title : '',
      error: errorEl.hidden ? '' : errorEl.textContent
    });
  }
  function tryPlay() {
    var p = media.play();
    if (p && p.catch) {
      p.catch(function () {
        showError('Press play to start (autoplay was blocked).');
        updatePlayButton();
      });
    }
  }
  function loadTrack(t) {
    clearError();
    destroyHls();
    current = t;
    titleEl.textContent = t.title || 'Unknown';
    subtitleEl.textContent = t.subtitle || '';
    if (t.favicon) {
      artImg.src = t.favicon;
      artImg.hidden = false;
      artPlaceholder.hidden = true;
    } else {
      artImg.hidden = true;
      artPlaceholder.hidden = false;
    }
    var showVideo = !!t.isVideo;
    media.hidden = !showVideo;
    audioArt.hidden = showVideo;
    seek.disabled = t.kind === 'radio';
    seek.value = '0';
    currentEl.textContent = '0:00';
    durationEl.textContent = t.kind === 'radio' ? 'LIVE' : '0:00';
    var useHls = t.hls && window.Hls && window.Hls.isSupported();
    if (useHls) {
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, function (evt, data) {
        if (data.fatal) {
          showError('Stream error (' + (data.details || 'unknown') + '). The station may be offline or geo-blocked.');
          postState();
        }
      });
      hls.loadSource(t.url);
      hls.attachMedia(media);
    } else {
      media.src = t.url;
    }
    tryPlay();
    updatePlayButton();
    postState();
  }

  media.addEventListener('play', function () { updatePlayButton(); postState(); });
  media.addEventListener('pause', function () { updatePlayButton(); postState(); });
  media.addEventListener('ended', function () { updatePlayButton(); postState(); });
  media.addEventListener('error', function () {
    if (!current) { return; }
    showError('Playback failed. The stream may be offline, or the format is not supported by the IDE.');
    postState();
  });
  media.addEventListener('timeupdate', function () {
    if (!current || current.kind === 'radio') { return; }
    currentEl.textContent = fmt(media.currentTime);
    if (isFinite(media.duration) && media.duration > 0) {
      seek.value = String(Math.round(media.currentTime / media.duration * 1000));
    }
  });
  media.addEventListener('durationchange', function () {
    if (current && current.kind !== 'radio') { durationEl.textContent = fmt(media.duration); }
  });

  playPauseBtn.addEventListener('click', function () {
    if (!current) { return; }
    if (media.paused) { clearError(); tryPlay(); } else { media.pause(); }
  });
  stopBtn.addEventListener('click', function () {
    destroyHls();
    media.pause();
    media.removeAttribute('src');
    media.load();
    current = null;
    titleEl.textContent = 'Nothing playing';
    subtitleEl.textContent = 'Pick a radio station or a local file from the Music sidebar.';
    artImg.hidden = true;
    artPlaceholder.hidden = false;
    media.hidden = true;
    audioArt.hidden = false;
    seek.value = '0';
    seek.disabled = true;
    currentEl.textContent = '0:00';
    durationEl.textContent = '0:00';
    clearError();
    updatePlayButton();
    postState();
  });
  seek.addEventListener('input', function () {
    if (!current || current.kind === 'radio') { return; }
    if (isFinite(media.duration) && media.duration > 0) {
      media.currentTime = Number(seek.value) / 1000 * media.duration;
    }
  });
  volumeInput.addEventListener('input', function () {
    volume = Number(volumeInput.value);
    media.volume = volume / 100;
    vscode.setState({ volume: volume });
    vscode.postMessage({ type: 'volumeChanged', value: volume });
  });

  window.addEventListener('message', function (evt) {
    var msg = evt.data || {};
    if (msg.type === 'play') { loadTrack(msg.track); }
    else if (msg.type === 'pause') { media.pause(); }
    else if (msg.type === 'resume') { if (current) { tryPlay(); } }
    else if (msg.type === 'stop') { stopBtn.click(); }
    else if (msg.type === 'setVolume') {
      volume = Number(msg.value);
      volumeInput.value = String(volume);
      media.volume = volume / 100;
    }
  });

  updatePlayButton();
  vscode.postMessage({ type: 'ready', volume: volume });
})();
</script>
</body>
</html>`;
}
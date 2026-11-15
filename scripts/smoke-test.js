#!/usr/bin/env node
// Smoke test: starts the real app with the dev hooks and checks the main features end to end.
//
//   npm test
//
// It serves a few small pages from this machine (a page, a login form, a download), drives the
// app through scripts/dev-hooks.js, and compares what the app reports with what is expected.
// It never touches your real settings (it uses a throw-away profile) and needs no network.
const { spawn, execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const electron = require('electron');
const TIMEOUT_MS = 180000;

// ---- 1. every script must at least parse
for (const file of ['main.js', 'preload.js', 'renderer/renderer.js', 'renderer/changelog.js', 'renderer/error.js', 'scripts/dev-hooks.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)]);
}
console.log('ok   all scripts parse');

// ---- 2. a tiny website
const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title>${body}`;
const server = http.createServer((req, res) => {
  if (req.url === '/file.bin') {
    const data = Buffer.alloc(200 * 1024, 7);
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="smoke.bin"', 'content-length': data.length });
    res.end(data);
  } else if (req.url === '/login') {
    res.setHeader('content-type', 'text/html');
    res.end(page('Login', '<form method="post" action="/done"><input id="u" name="email" type="text" autocomplete="username"><input id="p" name="password" type="password"><button type="submit">Sign in</button></form>'));
  } else {
    res.setHeader('content-type', 'text/html');
    res.end(page('Smoke page', '<h1>Hello</h1><p>' + 'text '.repeat(100) + '</p>'));
  }
});

server.listen(0, '127.0.0.1', () => run(server.address().port));

function run(port) {
  const base = `http://127.0.0.1:${port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thanary-smoke-'));
  const downloads = path.join(tmp, 'downloads');
  fs.mkdirSync(downloads);

  const tabsOrder = 'JSON.stringify(tabs.filter((t) => t.groupId === "default").map((t) => !!t.pinned))';
  const inputs = `(async () => JSON.stringify(await activeWC().executeJavaScript('({u: document.querySelector("#u").value, p: document.querySelector("#p").value})')))()`;
  const permissionTest = `(async () => {
    const r = {};
    const ask = (w, p, u) => new Promise((res) => handlePermissionRequest(session.defaultSession, w, p, res, { requestingUrl: u }));
    const wc = { getURL: () => 'https://example.com/' };
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: true });
    r.allowed = await ask(wc, 'geolocation', 'https://example.com/a');
    r.checkSame = handlePermissionCheck(session.defaultSession, 'geolocation', 'https://example.com', {});
    r.checkOther = handlePermissionCheck(session.defaultSession, 'geolocation', 'https://other.example', {});
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    r.blocked = await ask(wc, 'notifications', 'https://example.com/a');
    r.insecure = await ask({ getURL: () => 'http://insecure.test/' }, 'geolocation', 'http://insecure.test/');
    r.unknown = await ask(wc, 'midi', 'https://example.com/');
    return JSON.stringify(r);
  })()`;
  const crash = `(async () => { activeWC().forcefullyCrashRenderer(); return 'crashed'; })()`;
  const where = `JSON.stringify({ url: activeWC().getURL(), tabUrl: activeTab().url, failed: activeTab().failedUrl || null })`;

  // Each step is [kind, ...args]; `expect` (only on js/main steps) judges the value it returns.
  const plan = [
    { step: ['wait', 3000] },
    { step: ['js', 'closeModal(); "x"'] },
    { name: 'start page shows the links and a greeting', step: ['js', 'JSON.stringify({ tiles: document.querySelectorAll(".sq").length, greeting: document.getElementById("greeting").textContent })'],
      expect: (v) => v.tiles >= 5 && /Good|Hello/.test(v.greeting) },

    { step: ['main', `(app.setPath("downloads", ${JSON.stringify(downloads)}), "ok")`] },
    { step: ['act', 'nav.go', `${base}/page`] }, { step: ['wait', 2500] },
    { name: 'a page loads and gets its title', step: ['main', 'activeTab().title'], expect: (v) => v === 'Smoke page' },

    { name: 'a tab can be pinned', step: ['main', '(setPinned(activeTabId(), true), !!activeTab().pinned)'], expect: (v) => v === true },
    { step: ['act', 'tab.new'] }, { step: ['wait', 600] },
    { name: 'pinned tabs stay first', step: ['main', tabsOrder], expect: (v) => v.length === 2 && v[0] === true && v[1] === false },
    { name: 'the pinned tab shows as a compact tab', step: ['js', 'document.querySelectorAll(".tab.pinned").length'], expect: (v) => v === 1 },
    { name: 'a pinned tab can be unpinned', step: ['main', '(setPinned(tabs.find((t) => t.pinned).id, false), tabs.filter((t) => t.pinned).length)'], expect: (v) => v === 0 },

    { step: ['act', 'nav.go', 'http://127.0.0.1:1/'] }, { step: ['wait', 3000] },
    { name: 'a refused connection shows the error page', step: ['main', where], expect: (v) => /error\.html/.test(v.url) && v.failed === 'http://127.0.0.1:1/' && v.tabUrl === 'http://127.0.0.1:1/' },

    { step: ['act', 'nav.go', `${base}/page`] }, { step: ['wait', 2500] },
    { step: ['main', crash] }, { step: ['wait', 3500] },
    { name: 'a crashed page reloads by itself', step: ['main', where], expect: (v) => v.url === `${base}/page` },
    { step: ['main', crash] }, { step: ['wait', 3500] },
    { name: 'a page that keeps crashing stops with an error page', step: ['main', where], expect: (v) => /error\.html/.test(v.url) && /kind=crashed/.test(v.url) },

    { step: ['act', 'nav.go', `${base}/file.bin`] }, { step: ['wait', 3000] },
    { name: 'a download completes into the Downloads folder', step: ['main', `JSON.stringify({ state: downloads[0] && downloads[0].state, exists: require("fs").existsSync(${JSON.stringify(path.join(downloads, 'smoke.bin'))}) })`],
      expect: (v) => v.state === 'completed' && v.exists === true },

    { step: ['act', 'nav.go', `${base}/page`] }, { step: ['wait', 2500] },
    { step: ['main', '(closeTab(activeTabId()), closedTabs.length)'] },
    { step: ['main', '(reopenClosedTab(), "x")'] }, { step: ['wait', 2500] },
    { name: 'a closed tab can be reopened', step: ['main', 'activeTab().url'], expect: (v) => v === `${base}/page` },

    { step: ['main', `(vault.push({ id: "t", origin: ${JSON.stringify(base)}, username: "user@example.com", password: "pw-12345", enabled: true, autoSubmit: false }), "ok")`] },
    { step: ['act', 'nav.go', `${base}/login`] }, { step: ['wait', 2500] },
    { name: 'Auto-Login fills a saved login', step: ['main', inputs], expect: (v) => v.u === 'user@example.com' && v.p === 'pw-12345' },
    { step: ['main', '(vault[0].enabled = false, "off")'] },
    { step: ['act', 'nav.go', `${base}/login`] }, { step: ['wait', 2500] },
    { name: 'Auto-Login stays out when a site is switched off', step: ['main', inputs], expect: (v) => v.u === '' && v.p === '' },

    { step: ['main', '(globalThis.__historyBefore = history.length, "ok")'] },
    { step: ['act', 'group.newPrivate'] }, { step: ['wait', 500] },
    { step: ['act', 'nav.go', `${base}/page`] }, { step: ['wait', 2500] },
    { name: 'private groups use their own session and leave no history', step: ['main', 'JSON.stringify({ isolated: activeWC().session !== session.defaultSession, memory: !activeWC().session.isPersistent(), historyUnchanged: history.length === globalThis.__historyBefore })'],
      expect: (v) => v.isolated && v.memory && v.historyUnchanged },
    { name: 'private tabs are never saved to disk', step: ['main', '(writeState(true), (() => { const d = JSON.parse(require("fs").readFileSync(storeFile(), "utf8")); return JSON.stringify({ groups: d.groups.length, savedTabs: d.tabs.length, expected: tabs.filter((t) => !isPrivateGroup(t.groupId)).length }); })())'],
      expect: (v) => v.groups === 0 && v.savedTabs === v.expected },
    { step: ['act', 'group.switch', 'default'] }, { step: ['wait', 400] },

    // update flow: a spinner that holds for a moment, a toolbar button when ready, a delayed restart
    { step: ['main', '(actions["update.check"](), "started")'] }, { step: ['wait', 300] },
    { name: 'checking for updates shows a spinner state', step: ['main', 'updateStatus.state'], expect: (v) => v === 'checking' },
    { step: ['wait', 700] },
    { name: 'the check does not flash: it is still going after a second', step: ['main', 'updateStatus.state'], expect: (v) => v === 'checking' },
    { step: ['wait', 1800] },
    { name: 'the check then settles on a result', step: ['main', 'updateStatus.state'], expect: (v) => v === 'unavailable' },
    { step: ['main', '(setUpdate("ready", { version: "9.9.9" }), "ready")'] }, { step: ['wait', 400] },
    { name: 'a ready update shows the toolbar Update button', step: ['js', '!document.getElementById("update-pill").hidden'], expect: (v) => v === true },
    { step: ['main', '(actions["update.restart"](), updateStatus.state)'] }, { step: ['wait', 300] },
    { name: 'Restart shows a restarting state before anything closes', step: ['main', 'updateStatus.state'], expect: (v) => v === 'restarting' },
    { step: ['wait', 1800] },
    { name: 'the app is still running after the restart delay (development build: nothing to install)', step: ['main', '"alive"'], expect: (v) => v === 'alive' },
    { step: ['main', '(setUpdate("idle"), "reset")'] },

    { step: ['act', 'set', 'effects', 'reduced'] }, { step: ['wait', 400] },
    { name: 'Glass effects: Reduced switches the blur off', step: ['js', 'document.body.classList.contains("low-fx")'], expect: (v) => v === true },
    { step: ['act', 'set', 'effects', 'full'] }, { step: ['wait', 400] },
    { name: 'Glass effects: Full switches it back on', step: ['js', '!document.body.classList.contains("low-fx")'], expect: (v) => v === true },
    { name: 'a sheet opens and closes with its animation', step: ['js', '(async () => { openSettings("general"); await new Promise((r) => setTimeout(r, 700)); const open = document.body.classList.contains("modal-settings"); closeModal(); await new Promise((r) => setTimeout(r, 120)); const closing = document.body.classList.contains("modal-closing"); await new Promise((r) => setTimeout(r, 400)); const gone = !document.body.classList.contains("modal-settings") && !document.body.classList.contains("modal-closing"); return JSON.stringify({ open, closing, gone }); })()'],
      expect: (v) => v.open && v.closing && v.gone },
    { step: ['js', 'openPalette(); "x"'] }, { step: ['wait', 500] },
    { name: 'the command palette lists tabs and commands', step: ['js', '(() => { const i = document.getElementById("pal-input"); i.value = "new"; i.dispatchEvent(new Event("input", { bubbles: true })); return JSON.stringify(palItems.map((p) => p.kind)); })()'],
      expect: (v) => v.includes('Command') },
    { step: ['js', 'closeModal(); "x"'] },

    { name: 'site permissions are asked for, remembered per site, and unsafe ones refused', step: ['main', permissionTest],
      expect: (v) => v.allowed === true && v.checkSame === true && v.checkOther === false && v.blocked === false && v.insecure === false && v.unknown === false },
    { step: ['quit'] },
  ];

  const harness = plan.map((p) => p.step);
  const logged = plan.filter((p) => p.step[0] === 'js' || p.step[0] === 'main');

  const child = spawn(electron, ['.', `--user-data-dir=${path.join(tmp, 'profile')}`], {
    cwd: root,
    env: { ...process.env, THANARY_DEV: path.join(tmp, 'shots'), THANARY_STEPS: JSON.stringify(harness) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const results = [];
  const uiErrors = [];
  let buffer = '';
  const onData = (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const m = /^(js|main)> (.*)$/.exec(line);
      if (m) results.push(m[2]);
      else if (line.startsWith('[chrome] error')) uiErrors.push(line);
      else if (line.startsWith('step failed')) uiErrors.push(line);
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  const killer = setTimeout(() => { console.error('FAIL timed out after 3 minutes'); child.kill('SIGKILL'); }, TIMEOUT_MS);

  child.on('exit', () => {
    clearTimeout(killer);
    server.close();
    let failed = 0;
    logged.forEach((item, i) => {
      if (!item.name) return;
      let value;
      try {
        value = JSON.parse(results[i]);
        if (typeof value === 'string' && /^[[{]/.test(value)) value = JSON.parse(value);
      } catch {
        value = undefined;
      }
      const ok = results[i] !== undefined && (() => { try { return item.expect(value); } catch { return false; } })();
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${item.name}${ok ? '' : `  (got ${results[i]})`}`);
      if (!ok) failed += 1;
    });
    for (const error of uiErrors) { console.log(`FAIL ${error}`); failed += 1; }
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
    process.exit(failed ? 1 : 0);
  });
}

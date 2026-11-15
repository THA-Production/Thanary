const { app, BaseWindow, WebContentsView, Menu, ipcMain, session, dialog, clipboard, shell, nativeTheme, net, safeStorage, systemPreferences } = require('electron');
// electron-updater is large, so it is only loaded when an update check actually runs.
let updater = null;
const getUpdater = () => updater || (updater = require('electron-updater').autoUpdater);
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
};
const engine = () => ENGINES[settings.searchEngine] || ENGINES.google;
const searchBase = () => engine().url;
// Searches made with any engine (also ones used before the setting existed) are not "sites".
const isSearchURL = (url) => Object.values(ENGINES).some((e) => url.startsWith(e.url));
const DEFAULT_GROUP = 'default';
const HISTORY_LIMIT = 3000;
const isMac = process.platform === 'darwin';
const ERROR_PAGE = path.join(__dirname, 'renderer', 'error.html');
const ERROR_PAGE_URL = pathToFileURL(ERROR_PAGE).href;

let win = null;
let ui = null; // one WebContentsView that draws all browser chrome (toolbar, sidebar, start page)
let tabs = []; // every tab in every group; a tab only gets a `view` once it has loaded a page
let groups = [{ id: DEFAULT_GROUP, name: '' }];
let activeGroupId = DEFAULT_GROUP;
let activeByGroup = {}; // groupId -> tab id last active in that group
let nextId = 1;

let bookmarks = [];
let readingList = [];
let history = [];
// Links shown on the start page, grouped into columns. Editable in Settings > Start Page.
const mkLink = (title, url, group) => ({ title, url, group, favicon: null });
const DEFAULT_WORK_LINKS = [
  mkLink('YouTube', 'https://www.youtube.com/@THA-Production', 'Platform'),
  mkLink('Instagram', 'https://www.instagram.com/zh.tha/', 'Platform'),
  mkLink('TikTok', 'https://www.tiktok.com/@zh.tha', 'Platform'),
  mkLink('Pinterest', 'https://www.pinterest.com/', 'Platform'),
  mkLink('Behance', 'https://www.behance.net/', 'Platform'),
  mkLink('MyClient', 'https://tha-production.com/myclient.html', 'Platform'),
  mkLink('THA Production', 'https://tha-production.com/', 'Platform'),
  mkLink('ChatGPT', 'https://chatgpt.com/', 'AI Tools'),
  mkLink('Claude', 'https://claude.ai/', 'AI Tools'),
  mkLink('Gemini', 'https://gemini.google.com/', 'AI Tools'),
  mkLink('Higgsfield', 'https://higgsfield.ai/', 'AI Tools'),
  mkLink('Adobe', 'https://www.adobe.com/', 'Creative'),
  mkLink('Adobe Portfolio', 'https://portfolio.adobe.com/', 'Creative'),
  mkLink('Milanote', 'https://milanote.com/', 'Creative'),
  mkLink('Mentimeter', 'https://www.mentimeter.com/', 'Creative'),
  mkLink('Soundly', 'https://getsoundly.com/', 'Creative'),
  mkLink('Convertio', 'https://convertio.co/', 'Creative'),
  mkLink('Texture Labs', 'https://texturelabs.org/', 'Creative'),
  mkLink('Shutter Count', 'https://www.shuttercount.com/', 'Creative'),
  mkLink('Cloudflare', 'https://dash.cloudflare.com/', 'Business'),
  mkLink('Stripe', 'https://dashboard.stripe.com/', 'Business'),
  mkLink('Namecheap', 'https://www.namecheap.com/', 'Business'),
  mkLink('Linktree', 'https://linktr.ee/', 'Business'),
  mkLink('OneNote', 'https://www.onenote.com/', 'Business'),
  mkLink('GitHub', 'https://github.com/THA-Production', 'Business'),
  mkLink('Apple Support', 'https://support.apple.com/', 'Help'),
  mkLink('Google Translate', 'https://translate.google.com/', 'Help'),
  mkLink('DeepL', 'https://www.deepl.com/', 'Help'),
  mkLink('Wikipedia', 'https://www.wikipedia.org/', 'Help'),
  mkLink('Stack Overflow', 'https://stackoverflow.com/', 'Help'),
  mkLink('MDN Web Docs', 'https://developer.mozilla.org/', 'Help'),
];
// The links the previous version shipped with, to tell an untouched list from one the user edited.
const V2_DEFAULT_LINK_URLS = new Set([
  'https://tha-production.com/', 'https://tha-production.com/projekte.html', 'https://tha-production.com/angebote.html',
  'https://tha-production.com/team.html', 'https://www.youtube.com/@THA-Production', 'https://tha-production.com/myclient.html',
  'https://tha-production.com/login.html', 'https://tha-production.com/gallery.html', 'https://tha-production.com/tha-calendar/',
  'https://github.com/THA-Production', 'https://dash.cloudflare.com/',
]);
// The links v0.3.x shipped with, to tell an untouched list from one the user edited.
const OLD_DEFAULT_LINK_URLS = new Set([
  'https://tha-production.com/', 'https://tha-production.com/projekte.html', 'https://tha-production.com/myclient.html',
  'https://tha-production.com/angebote.html', 'https://github.com/THA-Production', 'https://dash.cloudflare.com/',
  'https://www.youtube.com/@THA-Production',
]);

let settings = {
  sidebar: false,
  favBar: false,
  adblock: true,
  autoUpdate: true,
  autoLogin: true,
  effects: 'auto', // auto = lighter on Macs with 8 GB or less; or 'full' / 'reduced'
  sleepTabs: true, // tabs you have not looked at for a while free their memory
  linksVersion: 3,
  searchEngine: 'google',
  userName: null, // null = not chosen yet; filled from the Mac's user name on first launch
  defaultGroupName: 'Tabs',
  aiModel: 'openai/gpt-4.1-mini',
  lastVersion: '', // the version whose "What's New" has been shown
  sitePermissions: {}, // origin -> { camera: 'allow' | 'deny', ... }
  workLinks: DEFAULT_WORK_LINKS.map((l) => ({ ...l })),
};
let freshProfile = false; // true when there was no saved state at all (first ever launch)

let insets = { left: 0, top: 90 }; // where the page area starts, reported by the chrome UI
let overlay = false; // true while the chrome draws over the page (suggestions, tab overview)
let htmlFullscreen = false;

// ---------- Saved state ----------

const storeFile = () => path.join(app.getPath('userData'), 'thanary-state.json');
let saveTimer = null;

function loadStore() {
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch {
    data = null;
  }
  if (!data || typeof data !== 'object') {
    freshProfile = true;
    bookmarks = [
      { id: uid(), title: 'Google', url: 'https://www.google.com/', favicon: null, favorite: true },
      { id: uid(), title: 'Wikipedia', url: 'https://www.wikipedia.org/', favicon: null, favorite: true },
    ];
    return;
  }
  const list = (value) => (Array.isArray(value) ? value : []);
  bookmarks = list(data.bookmarks).filter((b) => b && isWebURL(b.url));
  readingList = list(data.readingList).filter((r) => r && isWebURL(r.url));
  history = list(data.history).filter((h) => h && isWebURL(h.url)).slice(0, HISTORY_LIMIT);
  settings = { ...settings, ...(data.settings || {}) };
  const savedVersion = (data.settings && data.settings.linksVersion) || 1;
  if (savedVersion < 2) {
    const saved = cleanLinks(settings.workLinks);
    const untouched = saved.length === OLD_DEFAULT_LINK_URLS.size && saved.every((l) => OLD_DEFAULT_LINK_URLS.has(l.url));
    settings.workLinks = untouched ? DEFAULT_WORK_LINKS.map((l) => ({ ...l })) : saved.map((l) => ({ ...l, group: l.group || 'Links' }));
    settings.linksVersion = 2;
  } else {
    settings.workLinks = cleanLinks(settings.workLinks);
  }
  if (savedVersion < 3) {
    // v0.6: a bigger set of helpful sites; "MyClient" is no longer a group of its own.
    const links = settings.workLinks || [];
    const untouched = links.length === V2_DEFAULT_LINK_URLS.size && links.every((l) => V2_DEFAULT_LINK_URLS.has(l.url));
    if (untouched) {
      settings.workLinks = DEFAULT_WORK_LINKS.map((l) => ({ ...l }));
    } else {
      const have = new Set(links.map((l) => l.url));
      const renamed = links.map((l) => (l.group === 'MyClient' ? { ...l, group: 'Platform' } : l));
      settings.workLinks = [...renamed, ...DEFAULT_WORK_LINKS.filter((l) => !have.has(l.url)).map((l) => ({ ...l }))].slice(0, 60);
    }
    if (settings.effects === 'full') settings.effects = 'auto';
    settings.linksVersion = 3;
  }
  if (!ENGINES[settings.searchEngine]) settings.searchEngine = 'google';
  settings.sitePermissions = cleanPermissions(settings.sitePermissions);
  downloads = list(data.downloads).filter((d) => d && typeof d.id === 'string' && typeof d.path === 'string' && d.state === 'completed').slice(0, 50);
  const savedGroups = list(data.groups).filter((g) => g && typeof g.id === 'string' && g.id !== DEFAULT_GROUP);
  groups = [{ id: DEFAULT_GROUP, name: '' }, ...savedGroups.map((g) => ({ id: g.id, name: String(g.name || 'Untitled') }))];
  for (const saved of list(data.tabs)) {
    if (!saved || !groups.some((g) => g.id === saved.groupId)) continue;
    const tab = makeTab(saved.groupId, isWebURL(saved.url) ? saved.url : '');
    tab.title = String(saved.title || '');
    tab.favicon = typeof saved.favicon === 'string' ? saved.favicon : null;
    tab.pinned = !!saved.pinned && isWebURL(tab.url);
    if (saved.active) activeByGroup[saved.groupId] = tab.id;
  }
  for (const g of groups) normalizePins(g.id);
  if (groups.some((g) => g.id === data.activeGroupId)) activeGroupId = data.activeGroupId;
  if (savedVersion < 3) {
    // the "MyClient" tab group is gone: its tabs move to the main group
    const legacy = groups.filter((g) => g.id !== DEFAULT_GROUP && g.name === 'MyClient');
    for (const g of legacy) {
      for (const t of tabs) if (t.groupId === g.id) t.groupId = DEFAULT_GROUP;
      delete activeByGroup[g.id];
    }
    groups = groups.filter((g) => !legacy.includes(g));
    if (!groups.some((g) => g.id === activeGroupId)) activeGroupId = DEFAULT_GROUP;
    normalizePins(DEFAULT_GROUP);
  }
}

// Big inline icons would bloat the file that is rewritten after every navigation.
const slimIcon = (favicon) => (typeof favicon === 'string' && favicon.length < 2000 ? favicon : null);

let writeSeq = 0;

// sync=true is for quitting (the process may exit right after); otherwise the write happens
// off the main thread so it can't stall scrolling or animations.
function writeState(sync) {
  clearTimeout(saveTimer);
  saveTimer = null;
  const json = JSON.stringify({
    groups: groups.filter((g) => g.id !== DEFAULT_GROUP && !g.private),
    activeGroupId: isPrivateGroup(activeGroupId) ? DEFAULT_GROUP : activeGroupId,
    tabs: tabs
      .filter((t) => !isPrivateGroup(t.groupId)) // private tabs are never written to disk
      .map((t) => ({ groupId: t.groupId, url: t.failedUrl || t.url, title: t.title, favicon: slimIcon(t.favicon), pinned: !!t.pinned, active: activeByGroup[t.groupId] === t.id })),
    bookmarks,
    readingList,
    history: history.map((h) => ({ ...h, favicon: slimIcon(h.favicon) })),
    downloads: downloads.filter((d) => !d.priv && d.state === 'completed').slice(0, 50).map(({ priv, ...d }) => d),
    settings,
  });
  const file = storeFile();
  const seq = ++writeSeq;
  if (sync) {
    try {
      fs.writeFileSync(file, json);
    } catch (error) {
      console.error('Could not save state:', error.message);
    }
    return;
  }
  const temp = file + '.tmp';
  fs.promises
    .writeFile(temp, json)
    .then(() => { if (seq === writeSeq) return fs.promises.rename(temp, file); }) // a newer write wins
    .catch((error) => console.error('Could not save state:', error.message));
}

const saveNow = () => writeState(true);

function save() {
  if (!saveTimer) saveTimer = setTimeout(() => writeState(false), 2500);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- URL handling ----------

function isWebURL(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function sameSite(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

// Turns whatever the user typed into a URL: real URL, host name, or a search.
function toURL(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  if (isWebURL(text)) return text;
  if (/\s/.test(text)) return searchBase() + encodeURIComponent(text);
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(text)) return 'http://' + text;
  if (/^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(text)) return 'https://' + text;
  return searchBase() + encodeURIComponent(text);
}

// ---------- Layout ----------

function pageBounds() {
  const { width, height } = win.getContentBounds();
  if (htmlFullscreen) return { x: 0, y: 0, width, height };
  const x = Math.min(Math.max(0, Math.round(insets.left)), width);
  const y = Math.min(Math.max(0, Math.round(insets.top)), height);
  return { x, y, width: width - x, height: height - y };
}

function layout() {
  if (!win || !ui) return;
  const { width, height } = win.getContentBounds();
  ui.setBounds({ x: 0, y: 0, width, height });
  // Only the visible page is resized. Hidden tabs get the right size when they are shown, so
  // resizing the window or the sidebar doesn't relayout every open page.
  const tab = activeTab();
  if (tab && tab.view) tab.view.setBounds(pageBounds());
}

// The chrome view sits under the page views, and is lifted above them while it
// needs to draw over the page.
function applyZ() {
  if (!win || !ui) return;
  if (overlay && !htmlFullscreen) win.contentView.addChildView(ui);
  else win.contentView.addChildView(ui, 0);
}

function updateVisibility() {
  const activeId = activeTabId();
  const bounds = pageBounds();
  for (const t of tabs) {
    if (!t.view) continue;
    if (t.id === activeId) {
      t.view.setBounds(bounds);
      t.view.setVisible(true);
    } else {
      t.view.setVisible(false);
    }
  }
}

// ---------- State sent to the chrome UI ----------

function activeTabId() {
  return activeByGroup[activeGroupId] ?? null;
}

function activeTab() {
  const id = activeTabId();
  return tabs.find((t) => t.id === id) || null;
}

function activeWC() {
  const tab = activeTab();
  return tab && tab.view ? tab.view.webContents : null;
}

function send(channel, ...args) {
  if (ui && !ui.webContents.isDestroyed()) ui.webContents.send(channel, ...args);
}

// Page events (title, icon, loading) can arrive many times a second, especially while several
// tabs load. pushSoon() merges them into one update; push() sends right away (user actions).
let pushTimer = null;
function pushSoon() {
  if (!pushTimer) pushTimer = setTimeout(push, 40);
}

function push() {
  clearTimeout(pushTimer);
  pushTimer = null;
  const active = activeTab();
  const nav = active && active.view ? active.view.webContents.navigationHistory : null;
  send('state', {
    tabs: tabs
      .filter((t) => t.groupId === activeGroupId)
      .map(({ id, title, url, loading, favicon, pinned, sleeping }) => ({ id, title, url, loading, favicon, pinned: !!pinned, sleeping: !!sleeping })),
    activeId: active ? active.id : null,
    groups: groups.map((g) => ({ id: g.id, name: groupName(g), private: !!g.private, count: tabs.filter((t) => t.groupId === g.id).length })),
    activeGroupId,
    canGoBack: !!(nav && nav.canGoBack()),
    canGoForward: !!(nav && nav.canGoForward()),
    settings,
    fullscreen: !!(win && win.isFullScreen()),
    searchName: engine().name,
    version: app.getVersion(),
    versions: { electron: process.versions.electron, chrome: process.versions.chrome },
    aiTokenSaved,
    logins: vaultList(),
    permissions: permissionList(),
    effectsActive: effectiveEffects(),
    defaultBrowser: defaultBrowserCached,
  });
}

function topSites() {
  const counts = new Map();
  for (const h of history) {
    if (isSearchURL(h.url)) continue;
    const entry = counts.get(h.url) || { url: h.url, title: h.title, favicon: h.favicon || null, count: 0 };
    entry.count += 1;
    if (!entry.title && h.title) entry.title = h.title;
    counts.set(h.url, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

// Bookmarks, reading list and history change on every navigation, and building the top sites
// walks the whole history, so updates are merged and sent at most every 150 ms.
let libraryTimer = null;
function pushLibrary() {
  if (libraryTimer) return;
  libraryTimer = setTimeout(() => {
    libraryTimer = null;
    send('library', { bookmarks, readingList, history: history.slice(0, 300), topSites: topSites() });
  }, 150);
}

function focusAddress() {
  if (!ui) return;
  ui.webContents.focus();
  send('cmd', 'focus-address');
}

// ---------- History, bookmarks, reading list ----------

// The page being loaded is always one of the newest history entries, so don't scan all of them.
function recentEntry(url) {
  const limit = Math.min(history.length, 25);
  for (let i = 0; i < limit; i++) if (history[i].url === url) return history[i];
  return null;
}

function addHistory(tab) {
  if (!isWebURL(tab.url) || isPrivateGroup(tab.groupId)) return;
  if (history[0] && history[0].url === tab.url) return;
  history.unshift({ url: tab.url, title: tab.title || '', favicon: tab.favicon || null, ts: Date.now() });
  if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
  save();
  pushLibrary();
}

function addBookmark(favorite, source) {
  const page = source || activeTab();
  if (!page || !isWebURL(page.url)) return;
  const existing = bookmarks.find((b) => b.url === page.url);
  if (existing) existing.favorite = existing.favorite || favorite;
  else bookmarks.push({ id: uid(), title: page.title || page.url, url: page.url, favicon: page.favicon || null, favorite });
  save();
  pushLibrary();
}

function addReadingList(source) {
  const page = source || activeTab();
  if (!page || !isWebURL(page.url) || readingList.some((r) => r.url === page.url)) return;
  readingList.unshift({ id: uid(), title: page.title || page.url, url: page.url, favicon: page.favicon || null, added: Date.now() });
  save();
  pushLibrary();
}

function openURL(url, newTab) {
  if (!isWebURL(url)) return;
  const tab = activeTab();
  if (newTab || !tab) createTab(url);
  else navigate(tab, url);
}

// ---------- Tabs ----------

function makeTab(groupId, url) {
  const tab = { id: nextId++, groupId, url: url || '', title: '', favicon: null, loading: false, view: null, thumb: null, pinned: false, sleeping: false, lastActive: Date.now() };
  tabs.push(tab);
  return tab;
}

function ensureView(tab) {
  if (tab.view) return tab.view;
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      session: isPrivateGroup(tab.groupId) ? privateSession() : session.defaultSession,
    },
  });
  view.setBackgroundColor('#ffffff');
  tab.view = view;
  view.setVisible(false);
  view.setBounds(pageBounds());
  win.contentView.addChildView(view);
  applyZ();

  const wc = view.webContents;
  // Links that want a new window (target=_blank, window.open) open as a new tab.
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebURL(url)) createTab(url);
    return { action: 'deny' };
  });
  wc.on('page-title-updated', (_e, title) => {
    tab.title = title;
    const entry = recentEntry(tab.url);
    if (entry && !entry.title) { entry.title = title; pushLibrary(); }
    pushSoon();
    save();
  });
  wc.on('page-favicon-updated', (_e, icons) => {
    tab.favicon = icons[0] || null;
    const entry = recentEntry(tab.url);
    if (entry && !entry.favicon) entry.favicon = tab.favicon;
    // Bookmarks saved without an icon pick one up the first time their site is visited.
    if (tab.favicon) {
      let changed = false;
      for (const item of [...bookmarks, ...readingList, ...settings.workLinks]) {
        if (!item.favicon && sameSite(item.url, tab.url)) { item.favicon = tab.favicon; changed = true; }
      }
      if (changed) { save(); pushLibrary(); }
    }
    pushSoon();
  });
  wc.on('did-start-loading', () => { tab.loading = true; pushSoon(); });
  wc.on('did-stop-loading', () => {
    tab.loading = false;
    pushSoon();
    setTimeout(() => captureThumb(tab), 1500);
  });
  wc.on('did-navigate', (_e, url) => {
    if (url.startsWith(ERROR_PAGE_URL)) { pushSoon(); return; } // keep the address of the page that failed
    tab.failedUrl = null;
    tab.url = url;
    tab.favicon = null;
    addHistory(tab);
    pushSoon();
    save();
  });
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (isMainFrame) { tab.url = url; pushSoon(); save(); }
  });
  wc.on('found-in-page', (_e, result) => {
    if (tab.id === activeTabId()) send('cmd', 'found', { active: result.activeMatchOrdinal, total: result.matches });
  });
  wc.on('enter-html-full-screen', () => { htmlFullscreen = true; applyZ(); layout(); });
  wc.on('leave-html-full-screen', () => { htmlFullscreen = false; applyZ(); layout(); });
  wc.on('context-menu', (_e, params) => pageContextMenu(tab, params));
  wc.on('dom-ready', () => autofillFor(tab));
  wc.on('did-fail-load', (_e, code, description, validatedURL, isMainFrame) => {
    // -3 means the load was simply cancelled (a download, or a newer navigation).
    if (!isMainFrame || code === -3 || validatedURL.startsWith(ERROR_PAGE_URL) || !isWebURL(validatedURL)) return;
    showErrorPage(tab, { kind: errorKind(code), url: validatedURL, code, detail: description });
  });
  wc.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit') recoverFromCrash(tab, details.reason);
  });
  return view;
}

// Keeps a small screenshot of the tab for the tab overview.
// Grabbing and encoding a screenshot is expensive and runs on the main thread, so it is
// rate-limited per tab; `force` is for when the overview is actually being opened.
const THUMB_MIN_AGE_MS = 15000;
async function captureThumb(tab, force) {
  if (!tab.view || tab.id !== activeTabId() || tab.view.webContents.isDestroyed()) return;
  if (!force && tab.thumbAt && Date.now() - tab.thumbAt < THUMB_MIN_AGE_MS) return;
  tab.thumbAt = Date.now();
  try {
    const image = await tab.view.webContents.capturePage();
    if (!image.isEmpty()) tab.thumb = 'data:image/jpeg;base64,' + image.resize({ width: 480, quality: 'good' }).toJPEG(65).toString('base64');
  } catch {
    // The page went away while capturing; the overview falls back to a plain card.
  }
}

function loadTab(tab, url) {
  const view = ensureView(tab);
  tab.url = url;
  view.webContents.loadURL(url).catch(() => {});
}

function switchTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || !win) return;
  const previous = activeTab();
  if (previous && previous !== tab) captureThumb(previous);
  if (previous) previous.lastActive = Date.now();
  tab.lastActive = Date.now();
  tab.sleeping = false;
  activeGroupId = tab.groupId;
  activeByGroup[tab.groupId] = tab.id;
  if (tab.url && !tab.view) loadTab(tab, tab.url); // restored tabs load the first time they're shown
  else if (tab.needsReload) { tab.needsReload = false; loadTab(tab, tab.failedUrl || tab.url); } // it crashed while hidden
  updateVisibility();
  if (tab.view) tab.view.webContents.focus();
  else if (ui) ui.webContents.focus();
  push();
  save();
}

function createTab(input, options = {}) {
  if (!win) return null;
  const groupId = options.groupId || activeGroupId;
  const tab = makeTab(groupId, '');
  const url = toURL(input);
  if (url) loadTab(tab, url);
  if (options.background) { push(); save(); } else switchTab(tab.id);
  return tab;
}

function navigate(tab, input) {
  const url = toURL(input);
  if (!tab || !url) return;
  loadTab(tab, url);
  updateVisibility();
  if (tab.id === activeTabId()) tab.view.webContents.focus();
  push();
}

function destroyTab(tab) {
  tabs = tabs.filter((t) => t !== tab);
  if (tab.view) {
    win.contentView.removeChildView(tab.view);
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    tab.view = null;
  }
}

function closeTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || !win) return;
  const siblings = tabs.filter((t) => t.groupId === tab.groupId);
  const index = siblings.indexOf(tab);
  rememberClosedTab(tab);
  destroyTab(tab);
  if (activeByGroup[tab.groupId] !== id) { push(); save(); return; }
  const next = siblings[index + 1] || siblings[index - 1];
  if (next) {
    activeByGroup[tab.groupId] = next.id;
    if (tab.groupId === activeGroupId) switchTab(next.id);
  } else {
    delete activeByGroup[tab.groupId];
    if (tab.groupId === activeGroupId) createTab(null); // a group always keeps one tab open
  }
  push();
  save();
}

// Moves a tab so it sits just before `beforeId` (or at the end) in its group.
function moveTab(id, beforeId) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || id === beforeId) return;
  tabs = tabs.filter((t) => t !== tab);
  const index = beforeId == null ? -1 : tabs.findIndex((t) => t.id === beforeId);
  if (index === -1) tabs.push(tab);
  else tabs.splice(index, 0, tab);
  normalizePins(tab.groupId);
  push();
  save();
}

function moveTabToGroup(id, groupId) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.groupId === groupId || !groups.some((g) => g.id === groupId)) return;
  if (isPrivateGroup(tab.groupId) !== isPrivateGroup(groupId)) return; // a page can't change its session
  const from = tab.groupId;
  const siblings = tabs.filter((t) => t.groupId === from && t !== tab);
  tab.groupId = groupId;
  tabs = tabs.filter((t) => t !== tab);
  tabs.push(tab);
  normalizePins(groupId);
  normalizePins(from);
  if (!activeByGroup[groupId]) activeByGroup[groupId] = tab.id;
  if (activeByGroup[from] === id) {
    if (siblings.length) activeByGroup[from] = siblings[0].id;
    else delete activeByGroup[from];
  }
  switchGroup(activeGroupId);
}

function stepTab(delta) {
  const list = tabs.filter((t) => t.groupId === activeGroupId);
  if (list.length < 2) return;
  const index = list.findIndex((t) => t.id === activeTabId());
  switchTab(list[(index + delta + list.length) % list.length].id);
}

// ---------- Tab groups ----------

function switchGroup(id) {
  if (!groups.some((g) => g.id === id)) return;
  const previous = activeTab();
  if (previous) captureThumb(previous);
  activeGroupId = id;
  const list = tabs.filter((t) => t.groupId === id);
  if (!list.length) { createTab(null, { groupId: id }); return; }
  const target = list.find((t) => t.id === activeByGroup[id]) || list[0];
  switchTab(target.id);
}

function createGroup(isPrivate) {
  const group = { id: uid(), name: isPrivate ? 'Private' : 'Untitled' };
  if (isPrivate) group.private = true;
  groups.push(group);
  switchGroup(group.id);
  if (!isPrivate) send('cmd', 'rename', { kind: 'group', id: group.id });
}

function deleteGroup(id) {
  const group = groups.find((g) => g.id === id);
  if (id === DEFAULT_GROUP || !group) return;
  for (const tab of tabs.filter((t) => t.groupId === id)) destroyTab(tab);
  groups = groups.filter((g) => g.id !== id);
  delete activeByGroup[id];
  if (group.private && !groups.some((g) => g.private)) clearPrivateData(); // last private group: forget everything
  if (activeGroupId === id) switchGroup(DEFAULT_GROUP);
  else { push(); save(); }
}

// ---------- Native context menus ----------

function popup(template) {
  if (win) Menu.buildFromTemplate(template).popup({ window: win });
}

function tabMenu(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  const others = groups.filter((g) => g.id !== tab.groupId && !!g.private === isPrivateGroup(tab.groupId));
  popup([
    { label: 'Close Tab', click: () => closeTab(id) },
    {
      label: 'Close Other Tabs',
      enabled: tabs.some((t) => t.groupId === tab.groupId && t !== tab && !t.pinned),
      click: () => {
        for (const t of tabs.filter((t) => t.groupId === tab.groupId && t !== tab && !t.pinned)) destroyTab(t); // pinned tabs stay
        switchTab(id);
      },
    },
    { type: 'separator' },
    { label: 'Duplicate Tab', enabled: isWebURL(tab.url), click: () => createTab(tab.url) },
    { label: tab.pinned ? 'Unpin Tab' : 'Pin Tab', enabled: !!tab.pinned || isWebURL(tab.failedUrl || tab.url), click: () => setPinned(id, !tab.pinned) },
    {
      label: 'Move to Tab Group',
      submenu: [
        ...others.map((g) => ({ label: groupName(g), click: () => moveTabToGroup(id, g.id) })),
        ...(others.length ? [{ type: 'separator' }] : []),
        {
          label: 'New Tab Group',
          visible: !isPrivateGroup(tab.groupId),
          click: () => {
            const group = { id: uid(), name: 'Untitled' };
            groups.push(group);
            moveTabToGroup(id, group.id);
            send('cmd', 'rename', { kind: 'group', id: group.id });
          },
        },
      ],
    },
    { type: 'separator' },
    { label: 'Add Bookmark', enabled: isWebURL(tab.url), click: () => addBookmark(false, tab) },
    { label: 'Add to Reading List', enabled: isWebURL(tab.url), click: () => addReadingList(tab) },
  ]);
}

function groupMenu(id) {
  const items = [{ label: 'Rename', click: () => send('cmd', 'rename', { kind: 'group', id }) }];
  if (id !== DEFAULT_GROUP) items.push({ label: 'Delete Tab Group', click: () => deleteGroup(id) });
  popup(items);
}

function bookmarkMenu(id) {
  const bookmark = bookmarks.find((b) => b.id === id);
  if (!bookmark) return;
  popup([
    { label: 'Open in New Tab', click: () => createTab(bookmark.url) },
    { label: 'Copy Link', click: () => clipboard.writeText(bookmark.url) },
    { type: 'separator' },
    { label: 'Rename', click: () => { settings.sidebar = true; push(); send('cmd', 'rename', { kind: 'bookmark', id }); } },
    {
      label: bookmark.favorite ? 'Remove from Favorites' : 'Add to Favorites',
      click: () => { bookmark.favorite = !bookmark.favorite; save(); pushLibrary(); },
    },
    { label: 'Delete', click: () => { bookmarks = bookmarks.filter((b) => b.id !== id); save(); pushLibrary(); } },
  ]);
}

function readingMenu(id) {
  const item = readingList.find((r) => r.id === id);
  if (!item) return;
  popup([
    { label: 'Open in New Tab', click: () => createTab(item.url) },
    { label: 'Copy Link', click: () => clipboard.writeText(item.url) },
    { type: 'separator' },
    { label: 'Remove Item', click: () => { readingList = readingList.filter((r) => r.id !== id); save(); pushLibrary(); } },
  ]);
}

function historyMenu(url, ts) {
  popup([
    { label: 'Open in New Tab', click: () => createTab(url) },
    { label: 'Copy Link', click: () => clipboard.writeText(url) },
    { type: 'separator' },
    { label: 'Delete', click: () => { history = history.filter((h) => !(h.url === url && h.ts === ts)); save(); pushLibrary(); } },
  ]);
}

function pageMenu() {
  const tab = activeTab();
  const ok = !!tab && isWebURL(tab.url);
  popup([
    { label: 'Add Bookmark', enabled: ok, click: () => addBookmark(false) },
    { label: 'Add to Favorites', enabled: ok, click: () => addBookmark(true) },
    { label: 'Add to Reading List', enabled: ok, click: () => addReadingList() },
    { type: 'separator' },
    { label: 'Copy Link', enabled: ok, click: () => clipboard.writeText(tab.url) },
    { label: 'Open in Default Browser', enabled: ok, click: () => shell.openExternal(tab.url) },
  ]);
}

function pageContextMenu(tab, params) {
  const wc = tab.view.webContents;
  const template = [];
  if (isWebURL(params.linkURL)) {
    template.push(
      { label: 'Open Link in New Tab', click: () => createTab(params.linkURL, { background: true }) },
      { label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) },
      { label: 'Add Link to Reading List', click: () => addReadingList({ url: params.linkURL, title: params.linkText || params.linkURL }) },
      { type: 'separator' },
    );
  }
  if (params.mediaType === 'image' && isWebURL(params.srcURL)) {
    template.push(
      { label: 'Open Image in New Tab', click: () => createTab(params.srcURL) },
      { label: 'Copy Image', click: () => wc.copyImageAt(params.x, params.y) },
      { type: 'separator' },
    );
  }
  if (params.isEditable) {
    template.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' });
  } else if (params.selectionText.trim()) {
    const text = params.selectionText.trim();
    template.push(
      { role: 'copy' },
      { label: `Search for “${text.length > 28 ? text.slice(0, 28) + '…' : text}”`, click: () => createTab(searchBase() + encodeURIComponent(text)) },
      { type: 'separator' },
    );
  }
  const selected = params.selectionText.trim();
  if (selected) {
    template.push(
      { label: 'Ask AI', submenu: AI_ACTIONS.map((a) => ({ label: a.label, click: () => runAI(a.instruction, selected) })) },
      { type: 'separator' },
    );
  }
  if (params.isEditable && params.inputFieldType === 'password' && loginOrigin(tab.url)) {
    template.push(
      { label: 'Save Auto-Login for This Site…', click: () => openSettings('logins', { prefillUrl: loginOrigin(tab.url) }) },
      { type: 'separator' },
    );
  }
  const nav = wc.navigationHistory;
  template.push(
    { label: 'Back', enabled: nav.canGoBack(), click: () => nav.goBack() },
    { label: 'Forward', enabled: nav.canGoForward(), click: () => nav.goForward() },
    { label: 'Reload', click: () => wc.reload() },
    { type: 'separator' },
    { label: 'Inspect Element', click: () => wc.inspectElement(params.x, params.y) },
  );
  popup(template);
}

function clearHistory() {
  if (!win) return;
  dialog
    .showMessageBox(win, {
      type: 'warning',
      message: 'Clear all browsing history?',
      detail: 'This removes every page from History and Frequently Visited. It cannot be undone.',
      buttons: ['Clear History', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response !== 0) return;
      history = [];
      save();
      pushLibrary();
    });
}

// ---------- Window ----------

const SETTING_RULES = {
  sidebar: (v) => !!v,
  favBar: (v) => !!v,
  adblock: (v) => !!v,
  autoUpdate: (v) => !!v,
  autoLogin: (v) => !!v,
  effects: (v) => (v === 'full' || v === 'reduced' ? v : 'auto'),
  sleepTabs: (v) => !!v,
  searchEngine: (v) => (ENGINES[v] ? v : 'google'),
  userName: (v) => String(v == null ? '' : v).trim().slice(0, 40),
  aiModel: (v) => (/^[\w.\-\/]{2,80}$/.test(String(v || '').trim()) ? String(v).trim() : 'openai/gpt-4.1-mini'),
};

function setSetting(key, value) {
  const rule = SETTING_RULES[key];
  if (!rule) return;
  settings[key] = rule(value);
  if (key === 'adblock') { sendAdStatus(); buildMenu(); }
  if (key === 'effects') applyEffects();
  push();
  save();
}

function overlayColors() {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#2a2a2c', symbolColor: '#f5f5f7', height: 52 }
    : { color: '#f1f1f3', symbolColor: '#1d1d1f', height: 52 };
}

function createWindow() {
  win = new BaseWindow({
    width: 1320,
    height: 860,
    minWidth: 720,
    minHeight: 460,
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 19, y: 19 }, vibrancy: 'sidebar', visualEffectState: 'followWindow', backgroundColor: '#00000000' }
      : { titleBarOverlay: overlayColors(), backgroundColor: nativeTheme.shouldUseDarkColors ? '#2a2a2c' : '#f1f1f3' }),
  });

  ui = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  ui.setBackgroundColor('#00000000');
  win.contentView.addChildView(ui);
  ui.webContents.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  ui.webContents.on('did-finish-load', () => { push(); pushLibrary(); send('update', updateStatus); sendAdStatus(); sendDownloads(); announceVersion(); });
  // If the interface process ever dies, bring it straight back (but not in an endless loop).
  let uiCrashes = [];
  ui.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    const now = Date.now();
    uiCrashes = uiCrashes.filter((t) => now - t < 60000);
    uiCrashes.push(now);
    if (uiCrashes.length <= 3 && ui && !ui.webContents.isDestroyed()) ui.webContents.reload();
  });
  // The chrome page never navigates anywhere else.
  ui.webContents.on('will-navigate', (event) => event.preventDefault());
  ui.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.on('resize', layout);
  win.on('enter-full-screen', push);
  win.on('leave-full-screen', push);
  win.on('closed', () => {
    saveNow();
    for (const t of tabs) {
      if (t.view && !t.view.webContents.isDestroyed()) t.view.webContents.close();
      t.view = null;
      t.loading = false;
    }
    overlay = false;
    htmlFullscreen = false;
    win = null;
    ui = null;
  });

  layout();
  if (!tabs.some((t) => t.groupId === activeGroupId)) createTab(null);
  else switchGroup(activeGroupId);
  applyEffects();

  if (!app.isPackaged && process.env.THANARY_DEV) require('./scripts/dev-hooks')({ win, ui, actions, inspect: (code) => eval(code) });
}

// ---------- Actions the chrome UI may ask for ----------

const withWC = (fn) => () => { const wc = activeWC(); if (wc) fn(wc); };
const goBack = withWC((wc) => { if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); });
const goForward = withWC((wc) => { if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); });
const reload = () => {
  const tab = activeTab();
  if (!tab || !tab.view) return;
  if (tab.failedUrl) loadTab(tab, tab.failedUrl);
  else tab.view.webContents.reload();
};

const actions = {
  'tab.new': () => { createTab(null); focusAddress(); },
  'tab.close': (id) => closeTab(id),
  'tab.switch': (id) => switchTab(id),
  'tab.move': (id, beforeId) => moveTab(id, beforeId ?? null),
  'tab.toGroup': (id, groupId) => moveTabToGroup(id, groupId),
  'tab.menu': (id) => tabMenu(id),
  'nav.go': (text) => navigate(activeTab(), text),
  'nav.open': (url, newTab) => openURL(url, !!newTab),
  'nav.back': goBack,
  'nav.forward': goForward,
  'nav.reload': reload,
  'nav.stop': withWC((wc) => wc.stop()),
  'group.new': () => createGroup(false),
  'group.newPrivate': () => createGroup(true),
  'group.switch': (id) => switchGroup(id),
  'group.rename': (id, name) => {
    const text = String(name || '').trim().slice(0, 40);
    if (!text) return;
    if (id === DEFAULT_GROUP) {
      settings.defaultGroupName = text;
    } else {
      const group = groups.find((g) => g.id === id);
      if (!group) return;
      group.name = text;
    }
    push();
    save();
  },
  'group.menu': (id) => groupMenu(id),
  'group.newMenu': () => popup([
    { label: 'New Tab Group', click: () => createGroup(false) },
    { label: 'New Private Tab Group', click: () => createGroup(true) },
  ]),
  'settings.open': (pane) => send('cmd', 'settings', pane || 'general'),
  'update.check': () => checkForUpdates(true),
  'update.restart': () => restartToUpdate(),
  'update.download': () => shell.openExternal(`${RELEASES_URL}/latest`),
  'whatsnew.open': () => send('cmd', 'whatsnew', { version: app.getVersion(), fresh: false }),
  'work.save': (links) => { settings.workLinks = cleanLinks(links); save(); push(); },
  'privacy.clear': () => clearSiteData(),
  'app.open': (url, groupName) => openApp(url, groupName),
  'tab.reopen': () => reopenClosedTab(),
  'home': () => goHome(),
  'default.set': () => makeDefaultBrowser(),
  'tab.pin': (id, pinned) => setPinned(id, !!pinned),
  'page.print': () => printPage(),
  'page.pdf': () => { savePDF().catch((error) => console.error('PDF export failed:', error.message)); },
  'dev.inspect': withWC((wc) => wc.toggleDevTools()),
  'palette.request': () => sendPaletteData(),
  'download.open': (id) => downloadAction(id, 'open'),
  'download.show': (id) => downloadAction(id, 'show'),
  'download.cancel': (id) => downloadAction(id, 'cancel'),
  'download.remove': (id) => downloadAction(id, 'remove'),
  'downloads.clear': () => clearDownloads(),
  'permission.remove': (origin, key) => {
    const perms = settings.sitePermissions[origin];
    if (!perms) return;
    delete perms[key];
    if (!Object.keys(perms).length) delete settings.sitePermissions[origin];
    save();
    push();
  },
  'permission.clear': () => { settings.sitePermissions = {}; save(); push(); },
  'login.save': (data) => { const result = saveLogin(data || {}); push(); send('cmd', 'login-result', result); },
  'login.update': (id, patch) => {
    const login = vault.find((v) => v.id === id);
    if (!login || !patch) return;
    if ('enabled' in patch) login.enabled = !!patch.enabled;
    if ('autoSubmit' in patch) login.autoSubmit = !!patch.autoSubmit;
    saveVault();
    push();
  },
  'login.remove': (id) => { vault = vault.filter((v) => v.id !== id); saveVault(); push(); },
  'ai.ask': (id, history, includePage) => askAI(id, Array.isArray(history) ? history : [], !!includePage),
  'ai.setToken': (token) => { const ok = saveAiToken(token); push(); send('cmd', 'ai-token', { ok }); },
  'ai.removeToken': () => { removeAiToken(); push(); },
  'bookmark.rename': (id, title) => {
    const bookmark = bookmarks.find((b) => b.id === id);
    const text = String(title || '').trim().slice(0, 120);
    if (!bookmark || !text) return;
    bookmark.title = text;
    save();
    pushLibrary();
  },
  'bookmark.menu': (id) => bookmarkMenu(id),
  'reading.menu': (id) => readingMenu(id),
  'history.menu': (url, ts) => historyMenu(url, ts),
  'history.clear': () => clearHistory(),
  'page.menu': () => pageMenu(),
  'set': (key, value) => setSetting(key, value),
  'ui.insets': (next) => {
    if (!next || !Number.isFinite(next.left) || !Number.isFinite(next.top)) return;
    insets = { left: next.left, top: next.top };
    layout();
  },
  'ui.overlay': (on, wantBackdrop) => {
    overlay = !!on;
    applyZ();
    if (overlay && ui) ui.webContents.focus();
    if (overlay && wantBackdrop) captureBackdrop();
  },
  'overview.request': async () => {
    const active = activeTab();
    if (active) await captureThumb(active, true);
    const thumbs = {};
    for (const t of tabs) if (t.groupId === activeGroupId && t.thumb) thumbs[t.id] = t.thumb;
    send('cmd', 'thumbs', thumbs);
  },
  'find.query': (text, forward) => {
    const wc = activeWC();
    const query = String(text || '');
    if (!wc) return;
    if (!query) { wc.stopFindInPage('clearSelection'); send('cmd', 'found', { active: 0, total: 0 }); return; }
    wc.findInPage(query, { forward: forward !== false, findNext: true });
  },
  'find.stop': withWC((wc) => { wc.stopFindInPage('keepSelection'); wc.focus(); }),
  'focus.page': withWC((wc) => wc.focus()),
};

// Only our own chrome page may send actions.
ipcMain.on('act', (event, name, ...args) => {
  if (!ui || event.sender !== ui.webContents) return;
  if (Object.prototype.hasOwnProperty.call(actions, name)) actions[name](...args);
});

// ---------- Helpers: groups, private browsing, sessions, links ----------

const groupName = (g) => (g.id === DEFAULT_GROUP ? settings.defaultGroupName || 'Tabs' : g.name || 'Untitled');
const isPrivateGroup = (id) => !!(groups.find((g) => g.id === id) || {}).private;

// Private tab groups use their own session that only ever lives in memory, so cookies, logins
// and cache vanish when the last private group is closed (or the app quits).
let privateSes = null;
function privateSession() {
  if (!privateSes) {
    privateSes = session.fromPartition('thanary-private'); // no "persist:" prefix = memory only
    configureSession(privateSes);
  }
  return privateSes;
}

function clearPrivateData() {
  if (!privateSes) return;
  privateSes.clearStorageData().catch(() => {});
  privateSes.clearCache().catch(() => {});
}

function configureSession(ses) {
  // Camera, microphone, location and notifications need the user's OK (see handlePermissionRequest).
  ses.setPermissionRequestHandler((wc, permission, callback, details) => handlePermissionRequest(ses, wc, permission, callback, details));
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => handlePermissionCheck(ses, permission, requestingOrigin, details));
  watchDownloads(ses);
  // Sites such as Google and YouTube serve slower fallback pages, or refuse sign-in, when the
  // user agent says "Electron". Identify as plain Chrome instead.
  ses.setUserAgent(ses.getUserAgent().replace(/\s(?:Electron|Thanary)\/\S+/gi, ''));
  hookAdblock(ses);
}

// The first name of whoever is logged in to this Mac, for the start page greeting.
function systemFirstName() {
  if (!isMac) return '';
  try {
    const full = execFileSync('/usr/bin/id', ['-F'], { encoding: 'utf8', timeout: 1000 }).trim();
    return (full.split(/\s+/)[0] || '').slice(0, 40);
  } catch {
    return '';
  }
}

// Start-page links come from the settings file and from the Settings screen: keep only sane ones.
function cleanLinks(list) {
  if (!Array.isArray(list)) return DEFAULT_WORK_LINKS.map((l) => ({ ...l }));
  const out = [];
  for (const link of list.slice(0, 60)) {
    if (!link || !isWebURL(link.url) || link.url.length > 500) continue;
    let title = String(link.title || '').trim().slice(0, 40);
    if (!title) {
      try { title = new URL(link.url).hostname.replace(/^www\./, ''); } catch { continue; }
    }
    const group = String(link.group || '').trim().slice(0, 30) || 'Links';
    out.push({ title, url: link.url, group, favicon: slimIcon(link.favicon) });
  }
  return out;
}

function clearSiteData() {
  if (!win) return;
  dialog
    .showMessageBox(win, {
      type: 'warning',
      message: 'Clear cookies and website data?',
      detail: 'You will be signed out of websites. Your history and bookmarks are not affected.',
      buttons: ['Clear', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    .then(async ({ response }) => {
      if (response !== 0) return;
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    });
}

function viewSource() {
  const tab = activeTab();
  if (!tab || !tab.view || !isWebURL(tab.url)) return;
  const source = makeTab(tab.groupId, '');
  loadTab(source, 'view-source:' + tab.url);
  switchTab(source.id);
}

function openSettings(pane, extra) {
  if (!win) return;
  ui.webContents.focus();
  send('cmd', 'settings', extra ? { pane, ...extra } : pane || 'general');
}

function showUpdates() {
  openSettings('updates');
  checkForUpdates(true);
}

// Shows "What's New" the first time a version runs (and a welcome on the very first launch).
function announceVersion() {
  const version = app.getVersion();
  if (settings.lastVersion === version) return;
  const fresh = freshProfile;
  settings.lastVersion = version;
  freshProfile = false;
  save();
  setTimeout(() => send('cmd', 'whatsnew', { version, fresh }), 900);
}

// ---------- Ad and tracker blocker ----------
// Uses the Ghostery filter engine with its ready-made ad and tracker lists (downloaded once,
// cached, and refreshed weekly). It only looks at page sub-requests, never the page you typed.

const ADBLOCK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const adCacheFile = () => path.join(app.getPath('userData'), 'adblock-engine.bin');
const REQUEST_TYPES = {
  mainFrame: 'main_frame', subFrame: 'sub_frame', stylesheet: 'stylesheet', script: 'script', image: 'image',
  font: 'font', object: 'object', xhr: 'xmlhttprequest', ping: 'ping', cspReport: 'csp_report',
  media: 'media', webSocket: 'websocket',
};

let adEngine = null;
let adRequest = null;
let adState = 'loading'; // loading | ready | failed
let adBlockedCount = 0;
let adNotifyTimer = null;
const hookedSessions = new WeakSet();

const adStatus = () => ({ enabled: !!settings.adblock, state: adState, blocked: adBlockedCount });
const sendAdStatus = () => send('adblock', adStatus());
function adStatusSoon() {
  if (!adNotifyTimer) adNotifyTimer = setTimeout(() => { adNotifyTimer = null; sendAdStatus(); }, 1000);
}

async function initAdblock() {
  try {
    const { FiltersEngine, Request } = await import('@ghostery/adblocker');
    adRequest = Request;
    const file = adCacheFile();
    let cached = null;
    let fresh = false;
    try {
      const stat = await fs.promises.stat(file);
      cached = FiltersEngine.deserialize(new Uint8Array(await fs.promises.readFile(file)));
      fresh = Date.now() - stat.mtimeMs < ADBLOCK_MAX_AGE_MS;
    } catch {
      // no usable cache yet
    }
    if (cached) {
      adEngine = cached; // block with the saved lists straight away, even if they are a bit old
      adState = 'ready';
      sendAdStatus();
    }
    if (!fresh) {
      try {
        const downloaded = await FiltersEngine.fromPrebuiltAdsAndTracking(net.fetch);
        adEngine = downloaded;
        adState = 'ready';
        fs.promises.writeFile(file, downloaded.serialize()).catch(() => {});
      } catch (error) {
        if (!cached) throw error;
      }
    }
  } catch (error) {
    console.error('Ad blocker unavailable:', error.message);
    adState = 'failed';
  }
  sendAdStatus();
}

function hookAdblock(ses) {
  if (hookedSessions.has(ses)) return;
  hookedSessions.add(ses);
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (!settings.adblock || !adEngine || details.resourceType === 'mainFrame') {
      callback({});
      return;
    }
    try {
      const wc = details.webContents;
      const source = (wc && !wc.isDestroyed() ? wc.getURL() : '') || details.referrer || '';
      const request = adRequest.fromRawDetails({
        url: details.url,
        sourceUrl: source,
        type: REQUEST_TYPES[details.resourceType] || 'other',
      });
      const { match, redirect } = adEngine.match(request);
      if (redirect) {
        adBlockedCount += 1;
        adStatusSoon();
        callback({ redirectURL: redirect.dataUrl });
        return;
      }
      if (match) {
        adBlockedCount += 1;
        adStatusSoon();
        callback({ cancel: true });
        return;
      }
    } catch {
      // the blocker must never be the reason a page fails to load
    }
    callback({});
  });
}

// ---------- AI assistant (GitHub Models) ----------
// Your own GitHub token (kept encrypted with the Mac keychain) is sent only to GitHub, and only
// when you press Ask. The page text is included only if "Include this page" is ticked.

const AI_ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const tokenFile = () => path.join(app.getPath('userData'), 'ai-token.bin');
let aiTokenSaved = false;

function loadAiToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(tokenFile()));
  } catch {
    return null;
  }
}

function saveAiToken(token) {
  const text = String(token || '').trim();
  if (!/^[\x21-\x7e]{20,400}$/.test(text)) return false; // printable characters, no spaces
  if (!safeStorage.isEncryptionAvailable()) return false;
  try {
    fs.writeFileSync(tokenFile(), safeStorage.encryptString(text), { mode: 0o600 });
    aiTokenSaved = true;
    return true;
  } catch {
    return false;
  }
}

function removeAiToken() {
  try { fs.unlinkSync(tokenFile()); } catch { /* already gone */ }
  aiTokenSaved = false;
}

async function askAI(id, history, includePage) {
  const reply = (payload) => send('ai', { id, ...payload });
  const token = loadAiToken();
  if (!token) return reply({ error: 'Add your GitHub token in Settings > AI Assistant first.' });

  const messages = [{ role: 'system', content: 'You are the assistant built into Thanary, the THA Production browser. Answer clearly and concisely.' }];
  const tab = activeTab();
  if (includePage && tab && tab.view && isWebURL(tab.url)) {
    if (isPrivateGroup(tab.groupId)) return reply({ error: 'Pages from private tab groups are never shared with the AI.' });
    let text = '';
    try {
      text = await tab.view.webContents.executeJavaScript('document.body ? document.body.innerText : ""');
    } catch {
      text = '';
    }
    messages.push({
      role: 'system',
      content: `The user is looking at this page.\nTitle: ${tab.title}\nURL: ${tab.url}\n\nPage text (may be cut off):\n${String(text).slice(0, 12000)}`,
    });
  }
  for (const m of history.slice(-10)) {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  }

  try {
    const res = await net.fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ model: settings.aiModel, messages, max_tokens: 900 }),
    });
    const body = await res.text();
    if (!res.ok) {
      const reasons = {
        401: 'GitHub rejected the token. Create a new one that has the "Models: read" permission.',
        403: 'GitHub denied access. Check that the token can use GitHub Models.',
        404: `GitHub does not know the model "${settings.aiModel}". Change it in Settings.`,
        429: 'The free usage limit was reached. Try again later.',
      };
      return reply({ error: reasons[res.status] || `GitHub Models error ${res.status}: ${body.slice(0, 160)}` });
    }
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      return reply({ error: `GitHub Models sent a reply Thanary could not read: ${body.slice(0, 120)}` });
    }
    const choice = json.choices && json.choices[0];
    return reply({ text: (choice && choice.message && choice.message.content) || '(The model returned no answer.)' });
  } catch (error) {
    return reply({ error: 'Could not reach GitHub Models: ' + error.message });
  }
}

// ---------- Home ----------

// Lands on the start page without throwing anything away: reuse an empty start-page tab if one
// is open in this group, otherwise open a new one.
function goHome() {
  if (!win) return;
  const groupId = isPrivateGroup(activeGroupId) ? DEFAULT_GROUP : activeGroupId;
  const here = activeTab();
  if (here && !here.url && !here.view && here.groupId === groupId) return; // already home
  const blank = tabs.find((t) => t.groupId === groupId && !t.url && !t.view);
  if (blank) switchTab(blank.id);
  else createTab(null, { groupId });
}

// ---------- Links from other apps, and the default browser ----------
// Thanary registers for http and https links (Info.plist on the Mac), so it appears in
// System Settings > Desktop & Dock > Default web browser, and links clicked in Mail, Messages,
// etc. arrive here.

const pendingExternalURLs = [];

function openExternalURL(raw) {
  const url = String(raw || '').trim();
  if (!isWebURL(url)) return; // only web addresses; never javascript:, file: or other schemes
  if (!win) {
    pendingExternalURLs.push(url);
    if (app.isReady()) { createWindow(); flushExternalURLs(); }
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  const tab = activeTab();
  if (tab && !tab.url && !tab.view && !isPrivateGroup(tab.groupId)) navigate(tab, url); // reuse an empty start tab
  else createTab(url, { groupId: isPrivateGroup(activeGroupId) ? DEFAULT_GROUP : activeGroupId });
}

function flushExternalURLs() {
  for (const url of pendingExternalURLs.splice(0)) openExternalURL(url);
}

// An .html file opened with Thanary (File > Open With, or dropped on the icon).
function openLocalFile(filePath) {
  if (!/\.(html?|xhtml)$/i.test(String(filePath))) return;
  if (!win && app.isReady()) createWindow();
  if (!win) return;
  const tab = makeTab(isPrivateGroup(activeGroupId) ? DEFAULT_GROUP : activeGroupId, '');
  loadTab(tab, pathToFileURL(filePath).href);
  switchTab(tab.id);
}

let defaultBrowserCached = false;
function checkDefaultBrowser() {
  try {
    return app.isDefaultProtocolClient('https') && app.isDefaultProtocolClient('http');
  } catch {
    return false;
  }
}

function makeDefaultBrowser() {
  if (!app.isPackaged) {
    send('cmd', 'default-note', 'Only the installed app can become the default browser.');
    return;
  }
  app.setAsDefaultProtocolClient('http');
  app.setAsDefaultProtocolClient('https');
  // macOS asks for confirmation; check again while the answer comes in.
  for (const delay of [2500, 8000, 20000]) {
    setTimeout(() => { defaultBrowserCached = checkDefaultBrowser(); push(); }, delay);
  }
}

// ---------- Lighter on small Macs ----------

const LOW_MEMORY_BYTES = 9 * 1024 ** 3; // an 8 GB Mac reports 8 GiB

const isLowMemoryMac = () => os.totalmem() < LOW_MEMORY_BYTES;

// "Auto" uses the lighter look on Macs with 8 GB of memory or less.
function effectiveEffects() {
  if (settings.effects === 'full' || settings.effects === 'reduced') return settings.effects;
  return isLowMemoryMac() ? 'reduced' : 'full';
}

// In the lighter mode the window stops blending with the desktop (macOS vibrancy), which saves
// the graphics chip real work on small machines.
function applyEffects() {
  if (!win || !isMac) return;
  const light = effectiveEffects() === 'reduced';
  try {
    win.setVibrancy(light ? null : 'sidebar');
    win.setBackgroundColor(light ? (nativeTheme.shouldUseDarkColors ? '#2a2a2c' : '#f1f1f3') : '#00000000');
  } catch {
    // an older macOS may not support every option; the page styling still applies
  }
}

// ---------- Sleeping tabs ----------
// A tab you have not looked at for a while gives its page process back to the system. It stays in
// the tab bar with its title and icon, and reloads when you click it. This is the biggest memory
// saving on a Mac with 8 GB.

const SLEEP_CHECK_MS = 60 * 1000;

function sleepTab(tab) {
  if (!tab.view) return;
  if (!tab.view.webContents.isDestroyed()) {
    win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
  }
  tab.view = null;
  tab.sleeping = true;
  pushSoon();
}

// idleOverride (milliseconds) is for tests.
function sleepTick(idleOverride) {
  if (!win || !settings.sleepTabs) return 0;
  const idleMs = idleOverride != null ? idleOverride : (isLowMemoryMac() ? 10 : 20) * 60 * 1000;
  const now = Date.now();
  let slept = 0;
  for (const tab of tabs) {
    if (!tab.view || tab.id === activeTabId() || now - (tab.lastActive || 0) < idleMs) continue;
    const wc = tab.view.webContents;
    if (wc.isDestroyed() || wc.isLoading() || wc.isCurrentlyAudible() || wc.isDevToolsOpened()) continue;
    if (!isWebURL(tab.failedUrl || tab.url)) continue;
    sleepTab(tab);
    slept += 1;
  }
  return slept;
}

// ---------- Error pages, crash recovery ----------

// Maps Chromium's network error numbers to the few kinds of message the error page can show.
function errorKind(code) {
  if (code === -106) return 'offline';
  if (code === -105 || code === -137) return 'dns';
  if (code <= -200 && code > -300) return 'cert';
  if ([-100, -101, -102, -104, -109, -111, -118, -7, -324].includes(code)) return 'server';
  if (code === -310) return 'redirects';
  return 'generic';
}

function showErrorPage(tab, info) {
  if (!tab.view || tab.view.webContents.isDestroyed()) return;
  tab.failedUrl = info.url; // the address bar and Reload keep pointing at the page that failed
  tab.view.webContents
    .loadFile(ERROR_PAGE, { query: { kind: info.kind, url: info.url, code: String(info.code == null ? '' : info.code), detail: String(info.detail || '').slice(0, 200) } })
    .catch(() => {});
}

// A page's renderer process died. The first time, reload it; if it dies again within a minute,
// stop and show an error page instead of looping.
function recoverFromCrash(tab, reason) {
  const url = tab.failedUrl || tab.url;
  if (!isWebURL(url)) return;
  const now = Date.now();
  tab.crashes = (tab.crashes || []).filter((t) => now - t < 60000);
  tab.crashes.push(now);
  if (tab.crashes.length > 1) {
    showErrorPage(tab, { kind: 'crashed', url, code: '', detail: reason });
  } else if (tab.id === activeTabId()) {
    loadTab(tab, url);
  } else {
    tab.needsReload = true; // reloaded when the user comes back to it
  }
}

// ---------- Pinned tabs ----------

// Pinned tabs always sit first in their group; everything else keeps its order.
function normalizePins(groupId) {
  const slots = [];
  tabs.forEach((t, i) => { if (t.groupId === groupId) slots.push(i); });
  const ordered = slots.map((i) => tabs[i]).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // stable
  slots.forEach((slot, k) => { tabs[slot] = ordered[k]; });
}

function setPinned(id, pinned) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || !!tab.pinned === !!pinned) return;
  if (pinned && !isWebURL(tab.failedUrl || tab.url)) return; // only real pages can be pinned
  tab.pinned = !!pinned;
  normalizePins(tab.groupId);
  push();
  save();
}

// ---------- Site permissions (camera, microphone, location, notifications) ----------
// A site must ask, and you decide. "Remember" stores the answer per website in Settings >
// Privacy, where it can be revoked. Private tab groups only remember for the current session.

const ALWAYS_ALLOWED = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock']);
const ASKABLE = new Set(['media', 'geolocation', 'notifications', 'clipboard-read']);
const PERMISSION_ACTIONS = {
  camera: 'use your camera',
  microphone: 'use your microphone',
  geolocation: 'see your location',
  notifications: 'show notifications',
  'clipboard-read': 'read your clipboard',
};
const PERMISSION_LABELS = { camera: 'Camera', microphone: 'Microphone', geolocation: 'Location', notifications: 'Notifications', 'clipboard-read': 'Clipboard' };
const privatePermissions = {}; // origin -> { permission: 'allow' | 'deny' }, memory only
const pendingPrompts = new Map(); // "origin|keys" -> callbacks waiting for the same answer

const secureOrigin = (origin) => /^https:\/\//.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);

function permissionKeys(permission, mediaTypes) {
  if (permission !== 'media') return [permission];
  const keys = [];
  if (mediaTypes.includes('video')) keys.push('camera');
  if (mediaTypes.includes('audio')) keys.push('microphone');
  return keys.length ? keys : ['camera', 'microphone'];
}

const permissionStore = (ses) => (ses === privateSes ? privatePermissions : settings.sitePermissions);
const rememberedDecision = (ses, origin, key) => (permissionStore(ses)[origin] || {})[key];

function rememberDecision(ses, origin, key, decision) {
  const store = permissionStore(ses);
  (store[origin] = store[origin] || {})[key] = decision;
  if (store === settings.sitePermissions) { save(); push(); }
}

function permissionList() {
  const out = [];
  for (const [origin, perms] of Object.entries(settings.sitePermissions)) {
    for (const [key, decision] of Object.entries(perms)) out.push({ origin, key, label: PERMISSION_LABELS[key] || key, decision });
  }
  return out;
}

function cleanPermissions(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [origin, perms] of Object.entries(value)) {
    if (!secureOrigin(origin) || !perms || typeof perms !== 'object') continue;
    for (const [key, decision] of Object.entries(perms)) {
      if (PERMISSION_LABELS[key] && (decision === 'allow' || decision === 'deny')) (out[origin] = out[origin] || {})[key] = decision;
    }
  }
  return out;
}

// macOS has its own camera/microphone switch per app; ask for it the first time.
async function systemAccessOK(keys) {
  if (!isMac) return true;
  for (const key of keys) {
    if (key !== 'camera' && key !== 'microphone') continue;
    let status = systemPreferences.getMediaAccessStatus(key);
    if (status === 'not-determined') {
      try { await systemPreferences.askForMediaAccess(key); } catch { /* treated as not granted below */ }
      status = systemPreferences.getMediaAccessStatus(key);
    }
    if (status !== 'granted') return false;
  }
  return true;
}

async function askPermission(ses, origin, keys) {
  let host = origin;
  try { host = new URL(origin).host; } catch { /* keep the origin */ }
  const what = keys.map((k) => PERMISSION_ACTIONS[k]).join(' and ');
  const options = {
    type: 'question',
    message: `“${host}” wants to ${what}.`,
    detail: 'You can change this later in Settings > Privacy.',
    buttons: ['Allow', 'Block'],
    defaultId: 1,
    cancelId: 1,
    checkboxLabel: 'Remember my choice for this site',
    checkboxChecked: true,
  };
  const { response, checkboxChecked } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  const allow = response === 0;
  if (checkboxChecked) for (const key of keys) rememberDecision(ses, origin, key, allow ? 'allow' : 'deny');
  return allow;
}

function handlePermissionRequest(ses, wc, permission, callback, details) {
  if (ALWAYS_ALLOWED.has(permission)) return callback(true);
  if (!ASKABLE.has(permission)) return callback(false);
  let origin;
  try {
    origin = new URL((details && details.requestingUrl) || wc.getURL()).origin;
  } catch {
    return callback(false);
  }
  if (!secureOrigin(origin)) return callback(false);
  const keys = permissionKeys(permission, (details && details.mediaTypes) || []);
  const saved = keys.map((k) => rememberedDecision(ses, origin, k));
  const finish = async (allow) => callback(allow && (await systemAccessOK(keys)));
  if (saved.some((v) => v === 'deny')) return callback(false);
  if (saved.every((v) => v === 'allow')) return finish(true);

  const id = `${origin}|${keys.join(',')}|${ses === privateSes}`;
  if (pendingPrompts.has(id)) { pendingPrompts.get(id).push(finish); return undefined; }
  pendingPrompts.set(id, [finish]);
  askPermission(ses, origin, keys)
    .then((allow) => { for (const f of pendingPrompts.get(id)) f(allow); })
    .catch(() => { for (const f of pendingPrompts.get(id)) f(false); })
    .finally(() => pendingPrompts.delete(id));
  return undefined;
}

function handlePermissionCheck(ses, permission, requestingOrigin, details) {
  if (ALWAYS_ALLOWED.has(permission)) return true;
  if (!ASKABLE.has(permission) || !secureOrigin(String(requestingOrigin || ''))) return false;
  const type = details && details.mediaType;
  const keys = permission === 'media' ? permissionKeys('media', type === 'video' ? ['video'] : type === 'audio' ? ['audio'] : []) : [permission];
  return keys.every((k) => rememberedDecision(ses, requestingOrigin, k) === 'allow');
}

// ---------- Downloads ----------

let downloads = []; // newest first: { id, name, url, path, total, received, state, startedAt, priv }
const downloadItems = new Map(); // id -> the live Electron DownloadItem
const watchedForDownloads = new WeakSet();
let downloadTimer = null;
const RISKY_EXTENSIONS = new Set(['.app', '.command', '.sh', '.pkg', '.dmg', '.exe', '.msi', '.bat', '.scpt', '.jar']);

function sendDownloads() {
  clearTimeout(downloadTimer);
  downloadTimer = null;
  send('downloads', downloads.map(({ priv, ...d }) => ({ ...d, missing: d.state === 'completed' && !fs.existsSync(d.path) })));
}
function sendDownloadsSoon() {
  if (!downloadTimer) downloadTimer = setTimeout(sendDownloads, 250);
}

function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = path.join(dir, name);
  for (let n = 1; fs.existsSync(candidate) && n < 1000; n++) candidate = path.join(dir, `${base} (${n})${ext}`);
  return candidate;
}

function watchDownloads(ses) {
  if (watchedForDownloads.has(ses)) return;
  watchedForDownloads.add(ses);
  ses.on('will-download', (_event, item) => {
    const name = path.basename(item.getFilename() || 'download').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'download';
    const target = uniquePath(app.getPath('downloads'), name);
    item.setSavePath(target); // no save dialog: files go to the Downloads folder
    const entry = {
      id: uid(), name: path.basename(target), url: item.getURL(), path: target,
      total: item.getTotalBytes(), received: 0, state: 'progressing', startedAt: Date.now(), priv: ses === privateSes,
    };
    downloads.unshift(entry);
    for (const old of downloads.splice(50)) downloadItems.delete(old.id);
    downloadItems.set(entry.id, item);
    item.on('updated', (_e, state) => {
      entry.received = item.getReceivedBytes();
      entry.total = item.getTotalBytes();
      entry.state = state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing';
      sendDownloadsSoon();
    });
    item.once('done', (_e, state) => {
      entry.state = state; // completed | cancelled | interrupted
      if (state === 'completed') {
        entry.received = item.getReceivedBytes();
        entry.total = entry.received;
        if (isMac) app.dock.downloadFinished(target);
      }
      downloadItems.delete(entry.id);
      save();
      sendDownloads();
    });
    send('cmd', 'downloads-open');
    sendDownloads();
  });
}

function downloadAction(id, what) {
  const entry = downloads.find((d) => d.id === id);
  if (!entry) return;
  if (what === 'cancel') {
    const item = downloadItems.get(id);
    if (item) item.cancel();
  } else if (what === 'remove') {
    const item = downloadItems.get(id);
    if (item) item.cancel();
    downloadItems.delete(id);
    downloads = downloads.filter((d) => d.id !== id);
    save();
    sendDownloads();
  } else if (what === 'show') {
    if (fs.existsSync(entry.path)) shell.showItemInFolder(entry.path);
  } else if (what === 'open' && entry.state === 'completed' && fs.existsSync(entry.path)) {
    // Programs and installers are revealed instead of launched.
    if (RISKY_EXTENSIONS.has(path.extname(entry.path).toLowerCase())) shell.showItemInFolder(entry.path);
    else shell.openPath(entry.path);
  }
}

function clearDownloads() {
  downloads = downloads.filter((d) => d.state === 'progressing' || d.state === 'paused');
  save();
  sendDownloads();
}

// ---------- Reopen closed tab, Print, PDF ----------

let closedTabs = [];

function rememberClosedTab(tab) {
  if (!isWebURL(tab.url) || isPrivateGroup(tab.groupId)) return;
  closedTabs.push({ url: tab.url, groupId: tab.groupId });
  if (closedTabs.length > 20) closedTabs.shift();
}

function reopenClosedTab() {
  const last = closedTabs.pop();
  if (!last || !win) return;
  createTab(last.url, { groupId: groups.some((g) => g.id === last.groupId) ? last.groupId : activeGroupId });
}

function printPage() {
  const wc = activeWC();
  if (wc) wc.print({ printBackground: true });
}

// target is for tests; normally the user picks where to save.
async function savePDF(target) {
  const wc = activeWC();
  const tab = activeTab();
  if (!wc || !tab) return null;
  const data = await wc.printToPDF({ printBackground: true });
  let file = target;
  if (!file) {
    const title = (tab.title || 'page').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80) || 'page';
    const result = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), `${title}.pdf`), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (result.canceled || !result.filePath) return null;
    file = result.filePath;
  }
  await fs.promises.writeFile(file, data);
  return file;
}

// The command palette (⌘K) lists tabs from every group; private groups are left out.
function sendPaletteData() {
  send('cmd', 'palette-data', tabs
    .filter((t) => !isPrivateGroup(t.groupId))
    .map((t) => ({ id: t.id, title: t.title, url: t.url, group: groupName(groups.find((g) => g.id === t.groupId) || { id: DEFAULT_GROUP }) })));
}

// ---------- Glass backdrop ----------
// A web page is its own native view, so the interface cannot blur it directly. When a sheet opens
// over a page, grab a small snapshot of that page; the sheet blurs the snapshot like frosted glass.
async function captureBackdrop() {
  const tab = activeTab();
  const wc = tab && tab.view && !tab.view.webContents.isDestroyed() ? tab.view.webContents : null;
  if (!wc) { send('cmd', 'backdrop', null); return; }
  try {
    const image = await wc.capturePage();
    if (image.isEmpty()) { send('cmd', 'backdrop', null); return; }
    send('cmd', 'backdrop', 'data:image/jpeg;base64,' + image.resize({ width: 480, quality: 'good' }).toJPEG(55).toString('base64'));
  } catch {
    send('cmd', 'backdrop', null);
  }
}

// ---------- Right-click "Ask AI" ----------
// Select text on any page, right-click, and pick what the AI should do with it.

const AI_ACTIONS = [
  { label: 'Explain', instruction: 'Explain this in simple terms.' },
  { label: 'Solve', instruction: 'Solve this. Show the steps and the final answer.' },
  { label: 'Summarize', instruction: 'Summarize this in a few short points.' },
  { label: 'Translate to English', instruction: 'Translate this to English.' },
  { label: 'Fix and Improve Writing', instruction: 'Correct the spelling and grammar and improve the wording, keeping the meaning.' },
];

function runAI(instruction, selection) {
  if (!win) return;
  ui.webContents.focus();
  send('cmd', 'ai-run', { instruction, selection: String(selection).slice(0, 6000) });
}

// Opens a MyClient (or any other) page as a single "app" tab: focus it if it is already open,
// and keep such app pages together in their own tab group (e.g. "MyClient") in the top bar.
function openApp(url, groupName) {
  if (!isWebURL(url)) return;
  let target;
  try {
    target = new URL(url);
  } catch {
    return;
  }
  const open = tabs.find((t) => {
    if (t.appUrl === url && !isPrivateGroup(t.groupId)) return true; // it may have been redirected (e.g. to a login page)
    try {
      const u = new URL(t.url);
      return u.origin === target.origin && u.pathname === target.pathname && !isPrivateGroup(t.groupId);
    } catch {
      return false;
    }
  });
  if (open) {
    if (open.groupId !== activeGroupId) switchGroup(open.groupId);
    switchTab(open.id);
    return;
  }
  let groupId = isPrivateGroup(activeGroupId) ? DEFAULT_GROUP : activeGroupId;
  const name = String(groupName || '').trim().slice(0, 40);
  if (name) {
    let group = groups.find((g) => !g.private && g.id !== DEFAULT_GROUP && g.name === name);
    if (!group) {
      group = { id: uid(), name };
      groups.push(group);
    }
    groupId = group.id;
  }
  const opened = createTab(url, { groupId });
  if (opened) opened.appUrl = url;
}

// ---------- Auto-login (saved logins) ----------
// Logins are stored encrypted with the Mac keychain (safeStorage) and are only ever filled in on
// the exact website they were saved for (https, same origin). The Settings screen never receives
// a saved password back; it only sees the username.

const vaultFile = () => path.join(app.getPath('userData'), 'logins.bin');
let vault = []; // { id, origin, username, password, enabled, autoSubmit }
const lastAutoSubmit = new Map(); // origin -> time of the last automatic sign-in
const AUTO_SUBMIT_COOLDOWN_MS = 90 * 1000; // stops a wrong password from being retried in a loop

const validLogin = (l) => l && typeof l.id === 'string' && typeof l.origin === 'string' && typeof l.username === 'string' && typeof l.password === 'string';

function loadVault() {
  if (!fs.existsSync(vaultFile())) return; // nothing saved yet, so the keychain is never touched
  try {
    const list = JSON.parse(safeStorage.decryptString(fs.readFileSync(vaultFile())));
    vault = Array.isArray(list) ? list.filter(validLogin) : [];
  } catch (error) {
    console.error('Could not read saved logins:', error.message);
    vault = [];
  }
}

function saveVault() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  try {
    fs.writeFileSync(vaultFile(), safeStorage.encryptString(JSON.stringify(vault)), { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

const vaultList = () => vault.map(({ id, origin, username, enabled, autoSubmit }) => ({ id, origin, username, enabled, autoSubmit }));

// "https://example.com/login?x" -> "https://example.com". https only (plain http just for localhost).
function loginOrigin(input) {
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : 'https://' + input);
  } catch {
    return null;
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.origin;
  return null;
}

function saveLogin(data) {
  const origin = loginOrigin(String(data.url || ''));
  const username = String(data.username || '').trim().slice(0, 200);
  if (!origin || !username) return { ok: false, error: 'Enter a website address and a username or email.' };
  const password = String(data.password || '').slice(0, 500);
  const existing = data.id ? vault.find((v) => v.id === data.id) : null;
  if (!existing && !password) return { ok: false, error: 'Enter the password.' };
  if (existing) {
    existing.origin = origin;
    existing.username = username;
    if (password) existing.password = password; // a blank password keeps the saved one
    existing.autoSubmit = !!data.autoSubmit;
  } else {
    if (vault.length >= 100) return { ok: false, error: 'There are too many saved logins.' };
    vault.push({ id: uid(), origin, username, password, enabled: true, autoSubmit: !!data.autoSubmit });
  }
  if (!saveVault()) return { ok: false, error: 'Secure storage is not available on this Mac.' };
  return { ok: true };
}

// Runs inside the page: finds the login form, fills it, and optionally presses the button.
// Waits up to 15 seconds for forms that only appear after the page's scripts have run.
function autofillInPage(username, password, submit) {
  return new Promise((resolve) => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !el.disabled;
    };
    const setValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
      setter.call(el, value); // the native setter, so React/Vue see the change
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const textInputs = (scope) =>
      [...scope.querySelectorAll('input')].filter((i) => visible(i) && !i.readOnly && ['text', 'email', 'tel', ''].includes((i.type || '').toLowerCase()));
    const guessUser = (scope, before) => {
      const list = textInputs(scope).filter((i) => !before || i.compareDocumentPosition(before) & Node.DOCUMENT_POSITION_FOLLOWING);
      const likely = list.filter((i) => /user|mail|login|name|account|konto|benutzer|identif/i.test(`${i.name} ${i.id} ${i.autocomplete} ${i.placeholder}`));
      return likely[likely.length - 1] || list[list.length - 1] || null;
    };
    let usernameDone = false;
    const attempt = () => {
      const pw = [...document.querySelectorAll('input[type="password"]')].find(visible);
      if (!pw) {
        // Two-step sign-ins show the username first.
        if (!usernameDone) {
          const only = textInputs(document).find((i) => /email|username|login|user/i.test(`${i.type} ${i.name} ${i.id} ${i.autocomplete}`));
          if (only && !only.value) { setValue(only, username); usernameDone = true; }
        }
        return false;
      }
      if (pw.value) { resolve('already'); return true; }
      const form = pw.form || pw.closest('form');
      const user = guessUser(form || document, pw);
      if (user && !user.value) setValue(user, username);
      setValue(pw, password);
      if (!submit) { resolve('filled'); return true; }
      setTimeout(() => {
        const button = form && [...form.querySelectorAll('button, input[type="submit"]')].find((b) => visible(b) && (!b.type || b.type === 'submit'));
        if (button) button.click();
        else if (form && form.requestSubmit) form.requestSubmit();
        else pw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        resolve('submitted');
      }, 350);
      return true;
    };
    if (attempt()) return;
    const observer = new MutationObserver(() => { if (attempt()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve('none'); }, 15000);
  });
}

function autofillFor(tab) {
  if (!settings.autoLogin || !tab.view || tab.view.webContents.isDestroyed()) return;
  const wc = tab.view.webContents;
  const origin = loginOrigin(wc.getURL());
  if (!origin) return;
  const login = vault.find((v) => v.enabled && v.origin === origin);
  if (!login) return;
  const last = lastAutoSubmit.get(origin) || 0;
  const submit = login.autoSubmit && Date.now() - last > AUTO_SUBMIT_COOLDOWN_MS;
  wc.executeJavaScript(`(${autofillInPage.toString()})(${JSON.stringify(login.username)}, ${JSON.stringify(login.password)}, ${submit})`)
    .then((result) => { if (result === 'submitted') lastAutoSubmit.set(origin, Date.now()); })
    .catch(() => {});
}

// ---------- Auto-update (from GitHub Releases) ----------

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours
const RELEASES_URL = 'https://github.com/THA-Production/Thanary/releases';

// What Settings > Updates shows.
// state: idle | checking | uptodate | downloading | ready | blocked | error | unavailable
let updateStatus = { state: 'idle', version: null, message: '' };
let updaterReady = false;
let winUpdateReady = false;

function setUpdate(state, extra = {}) {
  updateStatus = { state, version: null, message: '', ...extra };
  send('update', updateStatus);
}

// The spinner should never just flash: whatever the answer, the check shows for a moment first.
let checkStartedAt = 0;
const MIN_CHECK_MS = 1400;
function settleUpdate(state, extra) {
  const wait = Math.max(0, MIN_CHECK_MS - (Date.now() - checkStartedAt));
  setTimeout(() => setUpdate(state, extra), wait);
}

function setupAutoUpdate() {
  if (updaterReady) return;
  updaterReady = true;
  const autoUpdater = getUpdater();
  // Windows uses electron-updater's normal download and install. On macOS, Apple's updater
  // engine refuses to install over an app that has no Apple Developer ID signature, so Mac
  // downloads and swaps the app itself (see downloadMacUpdate below).
  autoUpdater.autoDownload = !isMac;
  autoUpdater.autoInstallOnAppQuit = !isMac; // installs the downloaded update when the app quits

  autoUpdater.on('error', (error) => {
    console.error('Update error:', error);
    const message = String((error && error.message) || error || 'Unknown error').split('\n')[0].slice(0, 200);
    settleUpdate('error', { message });
  });
  autoUpdater.on('update-not-available', () => settleUpdate('uptodate'));
  autoUpdater.on('download-progress', (p) => setUpdate('downloading', { version: updateStatus.version, progress: Math.round(p.percent) }));
  autoUpdater.on('update-available', (info) => {
    if (isMac) downloadMacUpdate(info);
    else setUpdate('downloading', { version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    winUpdateReady = true;
    setUpdate('ready', { version: info.version }); // the toolbar shows an "Update" button; nothing pops up
  });
}

// The first check waits a few seconds so it doesn't compete with the first page load.
function startAutoUpdate() {
  setTimeout(() => {
    const tick = () => { if (settings.autoUpdate) checkForUpdates(false); };
    tick();
    setInterval(tick, UPDATE_CHECK_INTERVAL_MS);
  }, 8000);
}

function checkForUpdates() {
  if (['ready', 'downloading', 'restarting'].includes(updateStatus.state)) return;
  checkStartedAt = Date.now();
  setUpdate('checking');
  if (!app.isPackaged) {
    // Updates only work in an installed build, not when running with `npm start`.
    settleUpdate('unavailable', { message: 'Updates only work in the installed app, not in a development run.' });
    return;
  }
  setupAutoUpdate();
  getUpdater().checkForUpdates().catch(() => {}); // errors are reported by the 'error' handler
}

// "Restart to Update": show the spinner for a moment before the window closes.
function restartToUpdate() {
  if (updateStatus.state !== 'ready') return;
  setUpdate('restarting', { version: updateStatus.version });
  setTimeout(installUpdate, 1300);
}

function installUpdate() {
  if (isMac) {
    if (!stagedMacUpdate) return;
    startMacInstaller(true);
    app.quit();
  } else if (winUpdateReady) {
    getUpdater().quitAndInstall();
  }
}

// ----- macOS self-updater -----
// Downloads the new version from our GitHub Release, checks it against the checksum that was
// published with it, unpacks it, then a small helper script swaps the app once Thanary quits.

const APP_BUNDLE_ID = 'com.thanary.browser';

// Runs after this process has exited: replace the app (rolling back if that fails), then reopen.
const MAC_INSTALL_SCRIPT = `#!/bin/sh
PID="$1"; NEW="$2"; TARGET="$3"; RELAUNCH="$4"
i=0
while kill -0 "$PID" 2>/dev/null && [ "$i" -lt 60 ]; do sleep 0.5; i=$((i+1)); done
BACKUP="$TARGET.old-$$"
if mv "$TARGET" "$BACKUP"; then
  if mv "$NEW" "$TARGET"; then
    rm -rf "$BACKUP"
  else
    rm -rf "$TARGET"
    mv "$BACKUP" "$TARGET"
  fi
fi
xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null
if [ "$RELAUNCH" = "1" ]; then open "$TARGET"; fi
rm -rf "$(dirname "$NEW")"
`;

let macUpdateBusy = false;
let stagedMacUpdate = null; // { newApp, target, version } once downloaded, checked and unpacked
let macInstallStarted = false;

class UpdateBlocked extends Error {}

// Where the running app lives, if we are allowed to replace it.
function macInstallTarget() {
  const target = path.resolve(process.execPath, '..', '..', '..'); // .../Thanary.app
  if (!target.endsWith('.app')) throw new UpdateBlocked('This copy of Thanary cannot update itself.');
  if (target.startsWith('/Volumes/') || target.includes('/AppTranslocation/')) {
    throw new UpdateBlocked('Move Thanary to your Applications folder and open it from there. It cannot update while running from a disk image.');
  }
  try {
    fs.accessSync(path.dirname(target), fs.constants.W_OK);
  } catch {
    throw new UpdateBlocked(`Thanary is not allowed to replace itself in ${path.dirname(target)}.`);
  }
  return target;
}

function pickMacZip(files) {
  const zips = files.filter((f) => /\.zip$/i.test(f.url));
  const wantArm = process.arch === 'arm64';
  return zips.find((f) => /arm64/i.test(f.url) === wantArm) || null;
}

async function downloadMacUpdate(info) {
  if (macUpdateBusy || stagedMacUpdate) return;
  macUpdateBusy = true;
  try {
    if (!/^[0-9A-Za-z.+-]+$/.test(String(info.version))) throw new Error('Unexpected version number.');
    const target = macInstallTarget();
    const file = pickMacZip(info.files || []);
    if (!file) throw new Error('This release has no macOS download.');
    setUpdate('downloading', { version: info.version });

    const dir = path.join(app.getPath('temp'), `thanary-update-${info.version}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const zipPath = path.join(dir, 'update.zip');

    // Only ever download from our own repo, using just the file name from the release info.
    const url = `${RELEASES_URL}/download/v${info.version}/${encodeURIComponent(path.basename(file.url))}`;
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);
    const hash = crypto.createHash('sha512');
    let received = 0;
    let lastReport = 0;
    await pipeline(
      Readable.fromWeb(res.body),
      async function* (source) {
        for await (const chunk of source) {
          hash.update(chunk);
          received += chunk.length;
          if (file.size && Date.now() - lastReport > 250) {
            lastReport = Date.now();
            setUpdate('downloading', { version: info.version, progress: Math.min(99, Math.round((received / file.size) * 100)) });
          }
          yield chunk;
        }
      },
      fs.createWriteStream(zipPath),
    );
    if (hash.digest('base64') !== file.sha512) throw new Error('The downloaded update did not match its checksum, so it was discarded.');

    await execFileAsync('/usr/bin/ditto', ['-x', '-k', zipPath, dir]);
    fs.rmSync(zipPath, { force: true });
    const appName = fs.readdirSync(dir).find((n) => n.endsWith('.app'));
    if (!appName) throw new Error('The update did not contain an app.');
    const newApp = path.join(dir, appName);

    await execFileAsync('/usr/bin/codesign', ['--verify', '--deep', '--strict', newApp]);
    const { stdout } = await execFileAsync('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(newApp, 'Contents', 'Info.plist')]);
    if (stdout.trim() !== APP_BUNDLE_ID) throw new Error('The update is not a Thanary build.');

    stagedMacUpdate = { newApp, target, version: info.version };
    setUpdate('ready', { version: info.version }); // the toolbar shows an "Update" button; nothing pops up
  } catch (error) {
    console.error('Mac update failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    setUpdate(error instanceof UpdateBlocked ? 'blocked' : 'error', { version: info ? info.version : null, message });
  } finally {
    macUpdateBusy = false;
  }
}

function startMacInstaller(relaunch) {
  if (!stagedMacUpdate || macInstallStarted) return;
  macInstallStarted = true;
  const { newApp, target } = stagedMacUpdate;
  const script = path.join(path.dirname(newApp), 'install.sh');
  fs.writeFileSync(script, MAC_INSTALL_SCRIPT, { mode: 0o700 });
  spawn('/bin/sh', [script, String(process.pid), newApp, target, relaunch ? '1' : '0'], { detached: true, stdio: 'ignore' }).unref();
}

// If the user chose "Later", the update is applied when they eventually quit.
app.on('quit', () => { if (isMac) startMacInstaller(false); });

// ---------- Menu and shortcuts ----------

function showPane(pane) {
  if (!win) return;
  settings.sidebar = true;
  push();
  save();
  send('cmd', 'pane', pane);
}

function buildMenu() {
  const needsWindow = (fn) => () => { if (win) fn(); };
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { label: 'Check for Updates…', click: needsWindow(showUpdates) },
            { type: 'separator' },
            { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: needsWindow(() => openSettings('general')) },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: needsWindow(actions['tab.new']) },
        { label: 'New Tab Group', accelerator: 'CmdOrCtrl+Alt+N', click: needsWindow(() => createGroup(false)) },
        { label: 'New Private Tab Group', accelerator: 'CmdOrCtrl+Shift+N', click: needsWindow(() => createGroup(true)) },
        { type: 'separator' },
        { label: 'Open Location', accelerator: 'CmdOrCtrl+L', click: focusAddress },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: needsWindow(() => closeTab(activeTabId())) },
        { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: needsWindow(reopenClosedTab) },
        { label: 'Pin or Unpin Tab', click: needsWindow(() => { const t = activeTab(); if (t) setPinned(t.id, !t.pinned); }) },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: needsWindow(printPage) },
        { label: 'Export as PDF…', click: needsWindow(() => { savePDF().catch(() => {}); }) },
        ...(isMac ? [] : [{ type: 'separator' }, { label: 'Settings…', accelerator: 'Ctrl+,', click: needsWindow(() => openSettings('general')) }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: needsWindow(() => { if (activeWC()) { ui.webContents.focus(); send('cmd', 'find'); } }) },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Show Sidebar', accelerator: 'CmdOrCtrl+Shift+L', click: needsWindow(() => setSetting('sidebar', !settings.sidebar)) },
        { label: 'Show Favorites Bar', accelerator: 'CmdOrCtrl+Shift+B', click: needsWindow(() => setSetting('favBar', !settings.favBar)) },
        { label: 'Show Tab Overview', accelerator: 'CmdOrCtrl+Shift+\\', click: needsWindow(() => { ui.webContents.focus(); send('cmd', 'overview'); }) },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click: needsWindow(() => { ui.webContents.focus(); send('cmd', 'palette'); }) },
        { label: 'Show Downloads', accelerator: 'CmdOrCtrl+Shift+J', click: needsWindow(() => { ui.webContents.focus(); send('cmd', 'downloads-open'); sendDownloads(); }) },
        { label: 'Ask AI…', accelerator: 'CmdOrCtrl+Shift+A', click: needsWindow(() => { ui.webContents.focus(); send('cmd', 'ai'); }) },
        { label: 'Block Ads and Trackers', type: 'checkbox', checked: !!settings.adblock, click: (item) => setSetting('adblock', item.checked) },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: reload },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Develop',
      submenu: [
        { label: 'Show Web Inspector', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: withWC((wc) => wc.toggleDevTools()) },
        { label: 'Show JavaScript Console', accelerator: isMac ? 'Alt+Cmd+C' : 'Ctrl+Shift+J', click: withWC((wc) => wc.openDevTools({ mode: 'detach' })) },
        { label: 'View Page Source', accelerator: isMac ? 'Alt+Cmd+U' : 'Ctrl+U', click: needsWindow(viewSource) },
        { type: 'separator' },
        { label: 'Inspect Thanary Itself', click: needsWindow(() => ui.webContents.openDevTools({ mode: 'detach' })) },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: goBack },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: goForward },
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: needsWindow(goHome) },
        { type: 'separator' },
        { label: 'Show All History', accelerator: 'CmdOrCtrl+Y', click: () => showPane('history') },
        { label: 'Clear History…', click: clearHistory },
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        { label: 'Show Bookmarks', accelerator: 'CmdOrCtrl+Alt+B', click: () => showPane('bookmarks') },
        { label: 'Show Reading List', click: () => showPane('reading') },
        { type: 'separator' },
        { label: 'Add Bookmark', accelerator: 'CmdOrCtrl+D', click: () => addBookmark(false) },
        { label: 'Add to Favorites', click: () => addBookmark(true) },
        { label: 'Add to Reading List', accelerator: 'CmdOrCtrl+Shift+D', click: () => addReadingList() },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { label: 'Show Next Tab', accelerator: 'Ctrl+Tab', click: () => stepTab(1) },
        { label: 'Show Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => stepTab(-1) },
        ...Array.from({ length: 9 }, (_unused, i) => ({
          label: `Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => {
            const list = tabs.filter((t) => t.groupId === activeGroupId);
            const tab = i === 8 ? list[list.length - 1] : list[i];
            if (tab) switchTab(tab.id);
          },
        })),
      ],
    },
    {
      role: 'help',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: 'What’s New…', click: needsWindow(() => actions['whatsnew.open']()) },
        { label: 'Check for Updates…', click: needsWindow(showUpdates) },
        { type: 'separator' },
        { label: 'THA Production Website', click: needsWindow(() => createTab('https://tha-production.com/')) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- App lifecycle ----------

// One Thanary at a time: opening a link while it is running hands the link to the running copy.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', (_event, argv) => {
  const urls = argv.filter((a) => isWebURL(a));
  if (urls.length) urls.forEach(openExternalURL);
  else if (win) { win.show(); win.focus(); }
});
app.on('open-url', (event, url) => { event.preventDefault(); openExternalURL(url); }); // a link clicked in another app
app.on('open-file', (event, filePath) => { event.preventDefault(); openLocalFile(filePath); });

app.whenReady().then(() => {
  if (!gotLock) return;
  // Installed builds get their icon from the app bundle; this is for `npm start`.
  if (isMac && !app.isPackaged) {
    app.dock.setIcon(path.join(__dirname, 'build', 'icon.png'));
  }

  configureSession(session.defaultSession);
  // Open the connection to Google now, so the first search doesn't pay for DNS and TLS.
  session.defaultSession.preconnect({ url: 'https://www.google.com', numSockets: 2 });

  loadStore();
  loadVault();
  if (settings.userName == null) settings.userName = systemFirstName();
  aiTokenSaved = fs.existsSync(tokenFile());
  initAdblock();
  buildMenu();
  createWindow();
  flushExternalURLs();
  for (const arg of process.argv.slice(1)) if (isWebURL(arg)) openExternalURL(arg); // Windows/Linux start-up links
  if (app.isPackaged) defaultBrowserCached = checkDefaultBrowser();
  setInterval(sleepTick, SLEEP_CHECK_MS);
  startAutoUpdate();

  nativeTheme.on('updated', () => {
    if (win && !isMac) win.setTitleBarOverlay(overlayColors());
    applyEffects();
  });

  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('before-quit', saveNow);

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

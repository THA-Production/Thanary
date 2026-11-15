const { app, BaseWindow, WebContentsView, Menu, ipcMain, session, dialog, clipboard, shell, nativeTheme, net } = require('electron');
// electron-updater is large, so it is only loaded when an update check actually runs.
let updater = null;
const getUpdater = () => updater || (updater = require('electron-updater').autoUpdater);
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const SEARCH_URL = 'https://www.google.com/search?q=';
// Searches made before Google became the default were saved as DuckDuckGo URLs.
const isSearchURL = (url) => url.startsWith(SEARCH_URL) || url.startsWith('https://duckduckgo.com/?q=');
const DEFAULT_GROUP = 'default';
const HISTORY_LIMIT = 3000;
const isMac = process.platform === 'darwin';

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
let settings = { sidebar: false, favBar: false };

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
    bookmarks = [
      { id: uid(), title: 'Google', url: 'https://www.google.com/', favicon: null, favorite: true },
      { id: uid(), title: 'Wikipedia', url: 'https://www.wikipedia.org/', favicon: null, favorite: true },
      { id: uid(), title: 'YouTube', url: 'https://www.youtube.com/', favicon: null, favorite: true },
      { id: uid(), title: 'GitHub', url: 'https://github.com/', favicon: null, favorite: true },
    ];
    return;
  }
  const list = (value) => (Array.isArray(value) ? value : []);
  bookmarks = list(data.bookmarks).filter((b) => b && isWebURL(b.url));
  readingList = list(data.readingList).filter((r) => r && isWebURL(r.url));
  history = list(data.history).filter((h) => h && isWebURL(h.url)).slice(0, HISTORY_LIMIT);
  settings = { ...settings, ...(data.settings || {}) };
  const savedGroups = list(data.groups).filter((g) => g && typeof g.id === 'string' && g.id !== DEFAULT_GROUP);
  groups = [{ id: DEFAULT_GROUP, name: '' }, ...savedGroups.map((g) => ({ id: g.id, name: String(g.name || 'Untitled') }))];
  for (const saved of list(data.tabs)) {
    if (!saved || !groups.some((g) => g.id === saved.groupId)) continue;
    const tab = makeTab(saved.groupId, isWebURL(saved.url) ? saved.url : '');
    tab.title = String(saved.title || '');
    tab.favicon = typeof saved.favicon === 'string' ? saved.favicon : null;
    if (saved.active) activeByGroup[saved.groupId] = tab.id;
  }
  if (groups.some((g) => g.id === data.activeGroupId)) activeGroupId = data.activeGroupId;
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
    groups: groups.filter((g) => g.id !== DEFAULT_GROUP),
    activeGroupId,
    tabs: tabs.map((t) => ({ groupId: t.groupId, url: t.url, title: t.title, favicon: slimIcon(t.favicon), active: activeByGroup[t.groupId] === t.id })),
    bookmarks,
    readingList,
    history: history.map((h) => ({ ...h, favicon: slimIcon(h.favicon) })),
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
  if (/\s/.test(text)) return SEARCH_URL + encodeURIComponent(text);
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/.*)?$/i.test(text)) return 'http://' + text;
  if (/^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(text)) return 'https://' + text;
  return SEARCH_URL + encodeURIComponent(text);
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
      .map(({ id, title, url, loading, favicon }) => ({ id, title, url, loading, favicon })),
    activeId: active ? active.id : null,
    groups: groups.map((g) => ({ id: g.id, name: g.name, count: tabs.filter((t) => t.groupId === g.id).length })),
    activeGroupId,
    canGoBack: !!(nav && nav.canGoBack()),
    canGoForward: !!(nav && nav.canGoForward()),
    settings,
    fullscreen: !!(win && win.isFullScreen()),
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
  if (!isWebURL(tab.url)) return;
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
  const tab = { id: nextId++, groupId, url: url || '', title: '', favicon: null, loading: false, view: null, thumb: null };
  tabs.push(tab);
  return tab;
}

function ensureView(tab) {
  if (tab.view) return tab.view;
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
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
      for (const item of [...bookmarks, ...readingList]) {
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
  activeGroupId = tab.groupId;
  activeByGroup[tab.groupId] = tab.id;
  if (tab.url && !tab.view) loadTab(tab, tab.url); // restored tabs load the first time they're shown
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
  push();
  save();
}

function moveTabToGroup(id, groupId) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.groupId === groupId || !groups.some((g) => g.id === groupId)) return;
  const from = tab.groupId;
  const siblings = tabs.filter((t) => t.groupId === from && t !== tab);
  tab.groupId = groupId;
  tabs = tabs.filter((t) => t !== tab);
  tabs.push(tab);
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

function createGroup() {
  const group = { id: uid(), name: 'Untitled' };
  groups.push(group);
  settings.sidebar = true;
  switchGroup(group.id);
  send('cmd', 'rename', { kind: 'group', id: group.id });
}

function deleteGroup(id) {
  if (id === DEFAULT_GROUP || !groups.some((g) => g.id === id)) return;
  for (const tab of tabs.filter((t) => t.groupId === id)) destroyTab(tab);
  groups = groups.filter((g) => g.id !== id);
  delete activeByGroup[id];
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
  const others = groups.filter((g) => g.id !== tab.groupId);
  popup([
    { label: 'Close Tab', click: () => closeTab(id) },
    {
      label: 'Close Other Tabs',
      enabled: tabs.some((t) => t.groupId === tab.groupId && t !== tab),
      click: () => {
        for (const t of tabs.filter((t) => t.groupId === tab.groupId && t !== tab)) destroyTab(t);
        switchTab(id);
      },
    },
    { type: 'separator' },
    { label: 'Duplicate Tab', enabled: isWebURL(tab.url), click: () => createTab(tab.url) },
    {
      label: 'Move to Tab Group',
      submenu: [
        ...others.map((g) => ({ label: g.name || 'Tabs', click: () => moveTabToGroup(id, g.id) })),
        ...(others.length ? [{ type: 'separator' }] : []),
        {
          label: 'New Tab Group',
          click: () => {
            const group = { id: uid(), name: 'Untitled' };
            groups.push(group);
            settings.sidebar = true;
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
  if (id === DEFAULT_GROUP) return;
  popup([
    { label: 'Rename', click: () => send('cmd', 'rename', { kind: 'group', id }) },
    { label: 'Delete Tab Group', click: () => deleteGroup(id) },
  ]);
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
      { label: `Search for “${text.length > 28 ? text.slice(0, 28) + '…' : text}”`, click: () => createTab(SEARCH_URL + encodeURIComponent(text)) },
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

function setSetting(key, value) {
  if (key !== 'sidebar' && key !== 'favBar') return;
  settings[key] = !!value;
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
  ui.webContents.on('did-finish-load', () => { push(); pushLibrary(); });
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

  if (!app.isPackaged && process.env.THANARY_DEV) require('./scripts/dev-hooks')({ win, ui, actions });
}

// ---------- Actions the chrome UI may ask for ----------

const withWC = (fn) => () => { const wc = activeWC(); if (wc) fn(wc); };
const goBack = withWC((wc) => { if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); });
const goForward = withWC((wc) => { if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); });
const reload = withWC((wc) => wc.reload());

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
  'group.new': () => createGroup(),
  'group.switch': (id) => switchGroup(id),
  'group.rename': (id, name) => {
    const group = groups.find((g) => g.id === id);
    const text = String(name || '').trim().slice(0, 60);
    if (!group || id === DEFAULT_GROUP || !text) return;
    group.name = text;
    push();
    save();
  },
  'group.menu': (id) => groupMenu(id),
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
  'ui.overlay': (on) => { overlay = !!on; applyZ(); if (overlay && ui) ui.webContents.focus(); },
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

// ---------- Auto-update (from GitHub Releases) ----------

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours
let manualUpdateCheck = false;

let updaterReady = false;

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
    console.error('Update error:', error == null ? 'unknown' : error.message);
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      dialog.showMessageBox({ type: 'error', message: 'Could not check for updates.', detail: String(error && error.message ? error.message : error) });
    }
  });
  autoUpdater.on('update-not-available', () => {
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      dialog.showMessageBox({ type: 'info', message: 'You are up to date.', detail: `Thanary ${app.getVersion()} is the latest version.` });
    }
  });
  autoUpdater.on('update-available', (info) => {
    if (isMac) downloadMacUpdate(info);
  });
  autoUpdater.on('update-downloaded', (info) => {
    manualUpdateCheck = false;
    dialog
      .showMessageBox({
        type: 'info',
        message: `Thanary ${info.version} is ready to install.`,
        detail: 'Restart now to update, or it will install the next time you quit.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall(); });
  });

}

// The first check waits a few seconds so it doesn't compete with the first page load.
function startAutoUpdate() {
  setTimeout(() => {
    checkForUpdates(false);
    setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
  }, 8000);
}

// ----- macOS self-updater -----
// Downloads the new version from our GitHub Release, checks it against the checksum that was
// published with it, unpacks it, then a small helper script swaps the app once Thanary quits.

const RELEASES_URL = 'https://github.com/THA-Production/Thanary/releases';
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
let blockedNoticeShown = false;

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
  const wasManual = manualUpdateCheck;
  try {
    if (!/^[0-9A-Za-z.+-]+$/.test(String(info.version))) throw new Error('Unexpected version number.');
    const target = macInstallTarget();
    const file = pickMacZip(info.files || []);
    if (!file) throw new Error('This release has no macOS download.');

    if (wasManual) {
      dialog.showMessageBox({ type: 'info', message: `Downloading Thanary ${info.version}…`, detail: 'It downloads in the background. You will be asked to restart when it is ready.' });
    }

    const dir = path.join(app.getPath('temp'), `thanary-update-${info.version}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const zipPath = path.join(dir, 'update.zip');

    // Only ever download from our own repo, using just the file name from the release info.
    const url = `${RELEASES_URL}/download/v${info.version}/${encodeURIComponent(path.basename(file.url))}`;
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);
    const hash = crypto.createHash('sha512');
    await pipeline(
      Readable.fromWeb(res.body),
      async function* (source) {
        for await (const chunk of source) { hash.update(chunk); yield chunk; }
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
    manualUpdateCheck = false;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      message: `Thanary ${info.version} is ready to install.`,
      detail: 'Restart now to update, or it will install the next time you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      startMacInstaller(true);
      app.quit();
    }
  } catch (error) {
    console.error('Mac update failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof UpdateBlocked) {
      if (wasManual || !blockedNoticeShown) {
        blockedNoticeShown = true;
        const { response } = await dialog.showMessageBox({
          type: 'info',
          message: 'A new version of Thanary is available.',
          detail: `${message}\n\nYou can download it from GitHub instead.`,
          buttons: ['Open download page', 'Not now'],
          defaultId: 0,
          cancelId: 1,
        });
        if (response === 0) shell.openExternal(`${RELEASES_URL}/latest`);
      }
    } else if (wasManual) {
      dialog.showMessageBox({ type: 'error', message: 'Could not install the update.', detail: message });
    }
  } finally {
    macUpdateBusy = false;
    manualUpdateCheck = false;
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

function checkForUpdates(manual) {
  if (!app.isPackaged) {
    // Updates only work in an installed build, not when running with `npm start`.
    if (manual) dialog.showMessageBox({ type: 'info', message: 'Updates only work in the installed app.', detail: 'You are running a development build.' });
    return;
  }
  setupAutoUpdate();
  manualUpdateCheck = manual;
  getUpdater().checkForUpdates().catch(() => {}); // errors are reported by the 'error' handler
}

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
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: needsWindow(actions['tab.new']) },
        { label: 'New Tab Group', accelerator: 'CmdOrCtrl+Alt+N', click: needsWindow(createGroup) },
        { type: 'separator' },
        { label: 'Open Location', accelerator: 'CmdOrCtrl+L', click: focusAddress },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: needsWindow(() => closeTab(activeTabId())) },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
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
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: reload },
        { label: 'Developer Tools', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: withWC((wc) => wc.toggleDevTools()) },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: goBack },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: goForward },
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
        { label: 'Check for Updates…', click: () => checkForUpdates(true) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  // Websites must not get camera, location, etc. without us adding a prompt later.
  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowed.has(permission));
  });

  // Installed builds get their icon from the app bundle; this is for `npm start`.
  if (isMac && !app.isPackaged) {
    app.dock.setIcon(path.join(__dirname, 'build', 'icon.png'));
  }

  // Sites such as Google and YouTube serve slower fallback pages, or refuse sign-in, when the
  // user agent says "Electron". Identify as plain Chrome instead.
  const ua = session.defaultSession.getUserAgent().replace(/\s(?:Electron|Thanary)\/\S+/gi, '');
  session.defaultSession.setUserAgent(ua);
  // Open the connection to Google now, so the first search doesn't pay for DNS and TLS.
  session.defaultSession.preconnect({ url: 'https://www.google.com', numSockets: 2 });

  loadStore();
  buildMenu();
  createWindow();
  startAutoUpdate();

  nativeTheme.on('updated', () => {
    if (win && !isMac) win.setTitleBarOverlay(overlayColors());
  });

  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('before-quit', saveNow);

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

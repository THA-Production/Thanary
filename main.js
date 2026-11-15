const { app, BaseWindow, WebContentsView, Menu, ipcMain, session, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const SEARCH_URL = 'https://duckduckgo.com/?q=';
const HOME_URL = 'https://duckduckgo.com/';
const TAB_STRIP_HEIGHT = 40;
const TOOLBAR_HEIGHT = 46;
const CHROME_HEIGHT = TAB_STRIP_HEIGHT + TOOLBAR_HEIGHT;

let win = null;
let ui = null; // the WebContentsView that draws tabs + address bar
let tabs = [];
let activeId = null;
let nextId = 1;

// ---------- URL handling ----------

function isWebURL(url) {
  return /^https?:\/\//i.test(url);
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

// ---------- Layout and state ----------

function layout() {
  if (!win) return;
  const { width, height } = win.getContentBounds();
  ui.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT });
  for (const t of tabs) {
    t.view.setBounds({ x: 0, y: CHROME_HEIGHT, width, height: Math.max(0, height - CHROME_HEIGHT) });
  }
}

function push() {
  if (!ui || ui.webContents.isDestroyed()) return;
  const active = tabs.find((t) => t.id === activeId);
  const history = active && active.view.webContents.navigationHistory;
  ui.webContents.send('state', {
    tabs: tabs.map(({ id, title, url, loading, favicon }) => ({ id, title, url, loading, favicon })),
    activeId,
    canGoBack: !!(history && history.canGoBack()),
    canGoForward: !!(history && history.canGoForward()),
  });
}

function focusAddress() {
  if (!ui) return;
  ui.webContents.focus();
  ui.webContents.send('focus-address');
}

// ---------- Tabs ----------

function switchTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  activeId = id;
  for (const t of tabs) t.view.setVisible(t.id === id);
  tab.view.webContents.focus();
  push();
}

function createTab(input) {
  if (!win) return null;
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const tab = { id: nextId++, view, title: '', url: '', loading: false, favicon: null };
  tabs.push(tab);
  win.contentView.addChildView(view);

  const wc = view.webContents;
  // Links that want a new window (target=_blank, window.open) open as a new tab.
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebURL(url)) createTab(url);
    return { action: 'deny' };
  });
  wc.on('page-title-updated', (_e, title) => { tab.title = title; push(); });
  wc.on('page-favicon-updated', (_e, icons) => { tab.favicon = icons[0] || null; push(); });
  wc.on('did-start-loading', () => { tab.loading = true; push(); });
  wc.on('did-stop-loading', () => { tab.loading = false; push(); });
  wc.on('did-navigate', (_e, url) => { tab.url = url; tab.favicon = null; push(); });
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (isMainFrame) { tab.url = url; push(); }
  });

  layout();
  switchTab(tab.id);
  wc.loadURL(toURL(input) || HOME_URL).catch(() => {});
  return tab;
}

function closeTab(id) {
  const index = tabs.findIndex((t) => t.id === id);
  if (index === -1) return;
  const [tab] = tabs.splice(index, 1);
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  if (tabs.length === 0) {
    win.close();
    return;
  }
  if (activeId === id) switchTab(tabs[Math.min(index, tabs.length - 1)].id);
  else push();
}

function activeWC() {
  const tab = tabs.find((t) => t.id === activeId);
  return tab ? tab.view.webContents : null;
}

// ---------- Window ----------

function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BaseWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 14, y: 13 } }
      : { titleBarOverlay: { color: '#dfe1e5', symbolColor: '#333333', height: TAB_STRIP_HEIGHT } }),
  });

  ui = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.contentView.addChildView(ui);
  ui.webContents.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  ui.webContents.on('did-finish-load', push);

  win.on('resize', layout);
  win.on('closed', () => {
    for (const t of tabs) {
      if (!t.view.webContents.isDestroyed()) t.view.webContents.close();
    }
    tabs = [];
    activeId = null;
    win = null;
    ui = null;
  });

  layout();
  createTab(HOME_URL);
}

// ---------- IPC (only accepted from our own toolbar UI) ----------

function fromUI(handler) {
  return (event, ...args) => {
    if (!ui || event.sender !== ui.webContents) return;
    handler(...args);
  };
}

ipcMain.on('tab:new', fromUI(() => { createTab(HOME_URL); focusAddress(); }));
ipcMain.on('tab:close', fromUI((id) => closeTab(id)));
ipcMain.on('tab:switch', fromUI((id) => switchTab(id)));
ipcMain.on('nav:go', fromUI((text) => {
  const url = toURL(text);
  const wc = activeWC();
  if (url && wc) wc.loadURL(url).catch(() => {});
}));
ipcMain.on('nav:back', fromUI(() => { const wc = activeWC(); if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); }));
ipcMain.on('nav:forward', fromUI(() => { const wc = activeWC(); if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); }));
ipcMain.on('nav:reload', fromUI(() => { const wc = activeWC(); if (wc) wc.reload(); }));

// ---------- Auto-update (from GitHub Releases) ----------

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours
let manualUpdateCheck = false;

function setupAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // installs the downloaded update when the app quits

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

  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
}

function checkForUpdates(manual) {
  if (!app.isPackaged) {
    // Updates only work in an installed build, not when running with `npm start`.
    if (manual) dialog.showMessageBox({ type: 'info', message: 'Updates only work in the installed app.', detail: 'You are running a development build.' });
    return;
  }
  manualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch(() => {}); // errors are reported by the 'error' handler
}

// ---------- Menu and shortcuts ----------

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => { if (win) { createTab(HOME_URL); focusAddress(); } } },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => closeTab(activeId) },
        { label: 'Open Location', accelerator: 'CmdOrCtrl+L', click: focusAddress },
        ...(isMac ? [] : [{ role: 'quit' }]),
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => { const wc = activeWC(); if (wc) wc.reload(); } },
        { label: 'Developer Tools', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => { const wc = activeWC(); if (wc) wc.toggleDevTools(); } },
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
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => { const wc = activeWC(); if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); } },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => { const wc = activeWC(); if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); } },
      ],
    },
    { role: 'windowMenu' },
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
  if (process.platform === 'darwin' && !app.isPackaged) {
    app.dock.setIcon(path.join(__dirname, 'build', 'icon.png'));
  }

  buildMenu();
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

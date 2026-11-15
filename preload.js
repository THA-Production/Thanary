const { contextBridge, ipcRenderer } = require('electron');

// The only things the toolbar page is allowed to ask the main process to do.
contextBridge.exposeInMainWorld('browser', {
  platform: process.platform,
  newTab: () => ipcRenderer.send('tab:new'),
  closeTab: (id) => ipcRenderer.send('tab:close', id),
  switchTab: (id) => ipcRenderer.send('tab:switch', id),
  go: (text) => ipcRenderer.send('nav:go', text),
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  onState: (callback) => ipcRenderer.on('state', (_event, state) => callback(state)),
  onFocusAddress: (callback) => ipcRenderer.on('focus-address', () => callback()),
});

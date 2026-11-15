const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = ['state', 'library', 'cmd', 'update', 'adblock', 'ai'];

// The only things the chrome page can do: ask the main process for a named
// action (main.js checks the name against its own list) and listen for updates.
contextBridge.exposeInMainWorld('browser', {
  platform: process.platform,
  act: (name, ...args) => ipcRenderer.send('act', name, ...args),
  on: (channel, callback) => {
    if (CHANNELS.includes(channel)) ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
});

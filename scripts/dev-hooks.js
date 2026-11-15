// Development only (never packaged: package.json "files" leaves scripts/ out).
// Run with THANARY_DEV=<folder> to drive the app from a script and save
// screenshots of the browser chrome:
//
//   THANARY_DEV=/tmp/shots THANARY_STEPS='[["wait",1500],["shot","start"]]' electron .
//
// Steps: ["wait", ms], ["shot", name], ["screen", name], ["act", actionName, ...args],
//        ["js", "code run in the chrome page"], ["quit"]
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

module.exports = function devHooks({ win, ui, actions }) {
  const dir = process.env.THANARY_DEV;
  let steps = [];
  try {
    steps = JSON.parse(process.env.THANARY_STEPS || '[]');
  } catch (error) {
    console.error('Bad THANARY_STEPS:', error.message);
  }
  fs.mkdirSync(dir, { recursive: true });
  console.log('window-id', win.getMediaSourceId());

  ui.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') console.log('[chrome]', event.level, event.message);
  });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  ui.webContents.once('did-finish-load', async () => {
    for (const [kind, ...args] of steps) {
      try {
        if (kind === 'wait') await wait(args[0]);
        else if (kind === 'shot') {
          const image = await ui.webContents.capturePage();
          fs.writeFileSync(path.join(dir, args[0] + '.png'), image.toPNG());
        } else if (kind === 'screen') {
          // The real window, including web pages and translucency (macOS only).
          const id = win.getMediaSourceId().split(':')[1];
          require('child_process').execFileSync('screencapture', ['-x', '-o', '-l', id, path.join(dir, args[0] + '.png')]);
        } else if (kind === 'act') await actions[args[0]](...args.slice(1));
        else if (kind === 'js') console.log('js>', JSON.stringify(await ui.webContents.executeJavaScript(args[0])));
        else if (kind === 'quit') app.quit();
      } catch (error) {
        console.log('step failed', kind, error.message);
      }
    }
  });
};

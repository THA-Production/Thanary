// Generates build/icon.png (1024x1024). Run with:  npx electron scripts/make-icon.js
// electron-builder turns that one PNG into the .icns (Mac) and .ico (Windows) icons.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d5dfc"/>
      <stop offset="1" stop-color="#19b5fe"/>
    </linearGradient>
  </defs>
  <!-- macOS-style rounded square with the usual transparent margin -->
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
  <!-- globe ring -->
  <circle cx="512" cy="512" r="290" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="26"/>
  <!-- bold T -->
  <path d="M312 342 H712 V430 H556 V706 H468 V430 H312 Z" fill="#ffffff"/>
</svg>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024, height: 1024, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: false },
  });
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${SVG}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((resolve) => setTimeout(resolve, 500));
  let image = await win.webContents.capturePage();
  const { width } = image.getSize();
  if (width !== 1024) image = image.resize({ width: 1024, height: 1024, quality: 'best' });
  const out = path.join(__dirname, '..', 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.toPNG());
  console.log('Wrote', out);
  app.quit();
});

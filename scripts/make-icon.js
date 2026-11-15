// Generates build/icon.png (1024x1024). Run with:  npx electron scripts/make-icon.js
// electron-builder turns that one PNG into the .icns (Mac) and .ico (Windows) icons.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// The THA Production logo (white lettering with a soft glow on black) on a macOS-style
// rounded square with the usual transparent margin.
const logo = fs.readFileSync(path.join(__dirname, '..', 'build', 'source', 'tha-logo-glow.png')).toString('base64');

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="squircle"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#000"/>
  <image x="100" y="100" width="824" height="824" clip-path="url(#squircle)" xlink:href="data:image/png;base64,${logo}"/>
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

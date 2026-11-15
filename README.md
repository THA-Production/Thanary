# Thanary

A simple desktop web browser for macOS and Windows, built on Electron (Chromium).
Updates are delivered through GitHub Releases.

## Run it

```bash
npm install
npm start
```

## Ship a new version

1. Commit your changes and push them to `main`.
2. Run:

   ```bash
   npm run release
   ```

   This bumps the patch version (0.1.0 -> 0.1.1), creates the git tag `v0.1.1`, and pushes both.
3. GitHub Actions (`.github/workflows/release.yml`) builds the Mac and Windows installers and
   attaches them to a GitHub Release. Watch progress in the repo's **Actions** tab.
4. Installed copies of the app check for updates on launch and every 4 hours, download the new
   version, and offer to restart. There is also **Help > Check for Updates...**.

For a bigger version bump use `npm version minor` or `npm version major` instead, then
`git push --follow-tags`.

## Known limits

- **Mac updates need code signing.** macOS only auto-updates apps signed with an Apple Developer ID
  and notarized. Until that is set up (Apple Developer account, $99/year, plus certificate secrets
  in GitHub), the Mac app installs and runs, but you must update it by downloading the new DMG.
  Windows auto-update works unsigned (users see a SmartScreen warning on first install).
- **Auto-update only works in installed builds**, not when running `npm start`.
- **The first release has nothing to update from.** Install version 0.1.0 from the Release, then
  publish 0.1.1 to see an update arrive.
- **Local builds** (`npm run dist`) fail if the project path contains special characters such as `|`.
  GitHub's build machines are not affected.
- The app uses the default Electron icon. Add `build/icon.icns` (Mac) and `build/icon.ico` (Windows)
  to brand it.

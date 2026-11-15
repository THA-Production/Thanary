// What's New: shown the first time each version runs. Newest first. When you release a new
// version, add an entry on top (version must match package.json) with an icon name from
// ICONS in renderer.js.
window.CHANGELOG = [
  {
    version: '0.5.1',
    items: [
      { icon: 'tabs', title: 'Smooth tab dragging', text: 'Drag a tab and it lifts off the bar while the others glide out of the way. Let go and it springs into place. Drop it on a group to move it there, or press Escape to put it back.' },
    ],
  },
  {
    version: '0.5.0',
    items: [
      { icon: 'sparkle', title: 'Liquid Glass design', text: 'Frosted, softly lit surfaces and springy motion across the app. Settings, the palette and other sheets glass over a blurred view of your page. Prefer it lighter? Settings > General > Glass effects > Reduced.' },
      { icon: 'tabs', title: 'Pinned tabs', text: 'Right-click a tab and choose Pin Tab. Pinned tabs shrink to just their icon, always sit first in their group, and survive restarts and “Close Other Tabs”.' },
      { icon: 'shield', title: 'Friendly error pages', text: 'If a page can’t load (offline, wrong address, an untrusted certificate) you now get a clear message and a Try Again button, and it retries by itself when you’re back online.' },
      { icon: 'bolt', title: 'Crash recovery', text: 'If a page crashes, Thanary reloads it automatically. If it keeps crashing, it stops and tells you instead of looping.' },
      { icon: 'bolt', title: 'Command palette', text: 'Press ⌘K to jump to any tab, link, bookmark or page in your history, or run a command such as New Private Group, Settings or Ask AI.' },
      { icon: 'download', title: 'Downloads', text: 'Files now save to your Downloads folder with a progress panel in the toolbar. Open them, show them in Finder, or clear the list.' },
      { icon: 'shield', title: 'Permission prompts', text: 'Websites now ask before using your camera, microphone, location or notifications. Remember a choice per site, and revoke it in Settings > Privacy.' },
      { icon: 'tabs', title: 'Reopen closed tab, Print, PDF', text: '⇧⌘T brings back the last tab you closed. ⌘P prints, and File > Export as PDF saves the page as a PDF.' },
    ],
  },
  {
    version: '0.4.0',
    items: [
      { icon: 'home', title: 'A new start page', text: 'A black, portal-style home with your THA links, colorful tiles, a search box with often-visited sites, and a feed of recent pages, favorites and your reading list.' },
      { icon: 'users', title: 'MyClient built in', text: 'MyClient opens in its own group in the top bar and always jumps back to the same tab. The left rail and the start page link straight to it.' },
      { icon: 'key', title: 'Auto-Login', text: 'Save a username or email and password per website in Settings. Thanary fills them in when the login page opens, and can sign you in too. Switch single sites or everything off.' },
      { icon: 'sparkle', title: 'Ask AI from a right-click', text: 'Select text on any page, right-click and choose Explain, Solve, Summarize, Translate or Fix and Improve Writing.' },
      { icon: 'folder', title: 'Link groups', text: 'Group your start page links (Work, MyClient, Dev & Cloud …) in Settings > Start Page.' },
    ],
  },
  {
    version: '0.3.0',
    items: [
      { icon: 'tabs', title: 'Tab groups in the top bar', text: 'Your groups now sit next to your tabs, like a real tab bar. Click to switch, double-click to rename, drag a tab onto a group to move it.' },
      { icon: 'home', title: 'A start page for THA Production', text: 'A personal greeting, the THA logo, and quick links to your website, projects, GitHub and dashboards. Edit the links in Settings.' },
      { icon: 'shield', title: 'Built-in ad and tracker blocker', text: 'Blocks ads and trackers with community filter lists. Switch it on or off any time with the shield in the toolbar.' },
      { icon: 'lock', title: 'Private tab groups', text: 'Press ⇧⌘N for a group that saves no history, cookies or logins, and wipes everything when you close it.' },
      { icon: 'sparkle', title: 'Ask AI', text: 'Summarize a page or ask anything with GitHub Models. Add your GitHub token in Settings to turn it on.' },
      { icon: 'gear', title: 'Settings and updates', text: 'One place for search engine, privacy, the AI assistant and updates, with a Check for Updates button and a What’s New screen after every update.' },
      { icon: 'bolt', title: 'Faster and smoother', text: 'Google is the default search, pages load with less work in the background, and animations are lighter.' },
    ],
  },
];

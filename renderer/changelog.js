// What's New: shown the first time each version runs. Newest first. When you release a new
// version, add an entry on top (version must match package.json) with an icon name from
// ICONS in renderer.js.
window.CHANGELOG = [
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

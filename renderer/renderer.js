'use strict';

const B = window.browser;
const $ = (id) => document.getElementById(id);
const act = (...args) => B.act(...args);

// ---------- Icons ----------

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  sidebar: svg('<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><path d="M9.25 4.5v15"/>'),
  chevL: svg('<path d="M14.5 5 8 12l6.5 7"/>'),
  chevR: svg('<path d="M9.5 5 16 12l-6.5 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
  reload: svg('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4v4.5H15"/>'),
  share: svg('<path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16"/><path d="M12 14V3M8.5 6.5 12 3l3.5 3.5"/>'),
  grid: svg('<rect x="4" y="8" width="12" height="12" rx="2.5"/><path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4h7A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H16"/>'),
  lock: svg('<rect x="6" y="11" width="12" height="9" rx="2.5" fill="currentColor"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  book: svg('<path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z"/><path d="M12 6.5v13"/>'),
  glasses: svg('<circle cx="7" cy="14.5" r="3.5"/><circle cx="17" cy="14.5" r="3.5"/><path d="M10.5 14.5a1.5 1.5 0 0 1 3 0M3.6 13.5l2-7M20.4 13.5l-2-7"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  tabs: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M3.5 10h17"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.8" ry="8.5"/><path d="M3.5 12h17"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>'),
  home: svg('<path d="M4.5 11 12 4.5 19.5 11v8a1 1 0 0 1-1 1h-4v-5.5h-5V20h-4a1 1 0 0 1-1-1z"/>'),
  shield: svg('<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.3 7 9 4.1-1.7 7-4.8 7-9V6l-7-2.5z"/><path d="m9 12 2.3 2.3L15.5 10"/>'),
  sparkle: svg('<path d="M11 4.5 12.8 9.2 17.5 11l-4.7 1.8L11 17.5l-1.8-4.7L4.5 11l4.7-1.8L11 4.5z"/><path d="M18.5 15.5v4M16.5 17.5h4"/>'),
  refresh: svg('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4v4.5H15"/>'),
  bolt: svg('<path d="M13 3.5 6 13h5l-1 7.5L18 11h-5.2L13 3.5z"/>'),
  folder: svg('<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2.5h6.5A1.5 1.5 0 0 1 20 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/>'),
  tag: svg('<path d="M4.5 11.2V5.5a1 1 0 0 1 1-1h5.7l8 8a1.4 1.4 0 0 1 0 2l-4.7 4.7a1.4 1.4 0 0 1-2 0z"/><circle cx="8.5" cy="8.5" r="1.2"/>'),
  users: svg('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17 14.2a5.5 5.5 0 0 1 3.5 4.8"/>'),
  key: svg('<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M15.5 7.5l2.5 2.5M13 10l2 2"/>'),
  image: svg('<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/>'),
  calendar: svg('<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
  code: svg('<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 6l-3 12"/>'),
  cloud: svg('<path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5z"/>'),
  play: svg('<rect x="3.5" y="6" width="17" height="12" rx="3.5"/><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor"/>'),
  star: svg('<path d="m12 4.5 2.3 4.8 5.2.7-3.8 3.7.9 5.2L12 16.3 7.4 18.9l.9-5.2L4.5 10l5.2-.7z"/>'),
  arrowR: svg('<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>'),
  grid4: svg('<path d="M5 5h4.5v4.5H5zM14.5 5H19v4.5h-4.5zM5 14.5h4.5V19H5zM14.5 14.5H19V19h-4.5z"/>'),
  list: svg('<path d="M8.5 6.5H19M8.5 12H19M8.5 17.5H19M4.8 6.5h.01M4.8 12h.01M4.8 17.5h.01"/>'),
};

for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';

// ---------- Small helpers ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function icon(name, className) {
  const node = el('i', className);
  node.innerHTML = ICONS[name];
  return node;
}

// The Thanary favicon, used wherever a tab has no page loaded (the start page).
function brandFavicon(className) {
  const img = el('img', className);
  img.alt = '';
  img.draggable = false;
  img.src = 'assets/favicon-64.png';
  return img;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hueOf(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
}

// A site icon: the favicon when there is one, otherwise a coloured letter.
function siteIcon(favicon, url, className) {
  const wrap = el('span', 'site-icon ' + (className || ''));
  const host = hostOf(url);
  if (!favicon && /(^|\.)tha-production\.com$/.test(host)) {
    const logo = el('img');
    logo.alt = '';
    logo.draggable = false;
    logo.src = 'assets/tha-logo.png';
    wrap.classList.add('brand');
    wrap.append(logo);
    return wrap;
  }
  const letter = () => {
    wrap.textContent = (host[0] || '?').toUpperCase();
    wrap.classList.add('letter');
    wrap.style.background = `hsl(${hueOf(host)} 52% 50%)`;
  };
  if (favicon) {
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.addEventListener('error', () => { img.remove(); letter(); });
    img.src = favicon;
    wrap.append(img);
  } else {
    letter();
  }
  return wrap;
}

// ---------- State ----------

let state = null;
let lib = { bookmarks: [], readingList: [], history: [], topSites: [] };
let pane = 'root';
let renaming = false;
let overviewOpen = false;
let suggestOpen = false;
let findOpen = false;
let thumbs = {};
let overlaySent = false;
let lastActiveId = null;
let wasLoading = false;
let wasStart = null;
let modal = null; // which sheet is open: settings | ai | whatsnew
let lastStartSig = '';

const body = document.body;
body.classList.add(B.platform === 'darwin' ? 'mac' : 'win');

const address = $('address');
const field = $('address-field');
const progress = $('progress');
const suggest = $('suggest');
const tabsEl = $('tabs');
const page = $('page');

const activeTab = () => (state ? state.tabs.find((t) => t.id === state.activeId) : null) || null;

function syncOverlay() {
  const want = overviewOpen || suggestOpen || !!modal;
  if (want === overlaySent) return;
  overlaySent = want;
  act('ui.overlay', want);
}

// Tell the main process where the web page area starts. Resizing a live web page on every
// animation frame is what made the sidebar and bars janky, so the page moves just once:
// straight away when it is about to shrink (so it doesn't cover the sliding sidebar), or when
// the animation has finished when it is about to grow.
const FAVBAR_H = 28; // keep in sync with styles.css
const FINDBAR_H = 41;
const FINDBAR_CLOSED_H = 1;
const INSET_ANIMATION_MS = 300;
let lastInsets = { left: -1, top: -1 };
let insetsTimer = null;
let settleTimer = null;

function sendInsets(left, top) {
  if (left === lastInsets.left && top === lastInsets.top) return;
  lastInsets = { left, top };
  act('ui.insets', lastInsets);
}

function wantedInsets() {
  const sidebarWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 264;
  return {
    left: body.classList.contains('sidebar-open') ? sidebarWidth : 0,
    top: $('toolbar').offsetHeight + $('tabbar').offsetHeight
      + (body.classList.contains('favbar-open') ? FAVBAR_H : 0)
      + (body.classList.contains('finding') ? FINDBAR_H : FINDBAR_CLOSED_H),
  };
}

function reportInsets() {
  const want = wantedInsets();
  clearTimeout(insetsTimer);
  const shrinking = lastInsets.left < 0 || want.left > lastInsets.left || want.top > lastInsets.top;
  if (shrinking) sendInsets(want.left, want.top);
  else insetsTimer = setTimeout(() => sendInsets(want.left, want.top), INSET_ANIMATION_MS);
  // Whatever was predicted, finish by matching what is really on screen.
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    const rect = page.getBoundingClientRect();
    sendInsets(rect.left, rect.top);
  }, INSET_ANIMATION_MS + 150);
}

// ---------- Tabs ----------

const tabEls = new Map();
let firstTabRender = true;

function makeTabEl(id) {
  const tab = el('div', 'tab');
  tab.setAttribute('role', 'tab');
  tab.draggable = true;
  const close = el('button', 'tab-close');
  close.innerHTML = ICONS.close;
  close.title = 'Close Tab';
  close.setAttribute('aria-label', 'Close Tab');
  const inner = el('div', 'tab-inner');
  inner.append(el('span', 'tab-icon'), el('span', 'tab-title'));
  tab.append(close, inner);

  tab.addEventListener('click', (event) => {
    if (event.target.closest('.tab-close')) act('tab.close', id);
    else act('tab.switch', id);
  });
  tab.addEventListener('auxclick', (event) => { if (event.button === 1) act('tab.close', id); });
  tab.addEventListener('contextmenu', (event) => { event.preventDefault(); act('tab.menu', id); });

  tab.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/x-thanary-tab', String(id));
    event.dataTransfer.effectAllowed = 'move';
    tab.classList.add('dragging');
  });
  tab.addEventListener('dragend', () => { tab.classList.remove('dragging'); clearDropMarks(); });
  tab.addEventListener('dragover', (event) => {
    if (!event.dataTransfer.types.includes('text/x-thanary-tab')) return;
    event.preventDefault();
    const rect = tab.getBoundingClientRect();
    clearDropMarks();
    tab.classList.add(event.clientX < rect.left + rect.width / 2 ? 'drop-before' : 'drop-after');
  });
  tab.addEventListener('drop', (event) => {
    const dragged = Number(event.dataTransfer.getData('text/x-thanary-tab'));
    if (!dragged) return;
    event.preventDefault();
    const before = tab.classList.contains('drop-before');
    clearDropMarks();
    const order = state.tabs.map((t) => t.id);
    const index = order.indexOf(id);
    const beforeId = before ? id : order[index + 1] ?? null;
    if (dragged !== beforeId) act('tab.move', dragged, beforeId);
  });
  return tab;
}

function clearDropMarks() {
  for (const node of tabsEl.querySelectorAll('.drop-before, .drop-after')) node.classList.remove('drop-before', 'drop-after');
}

function updateTabEl(node, tab) {
  node.classList.toggle('active', tab.id === state.activeId);
  node.setAttribute('aria-selected', String(tab.id === state.activeId));
  const title = tab.title || (tab.url ? hostOf(tab.url) || tab.url : 'Start Page');
  const titleEl = node.querySelector('.tab-title');
  if (titleEl.textContent !== title) titleEl.textContent = title;
  node.title = title;

  const key = tab.loading ? 'loading' : tab.favicon || (tab.url ? 'globe' : 'start');
  const iconEl = node.querySelector('.tab-icon');
  if (iconEl.dataset.key === key) return;
  iconEl.dataset.key = key;
  iconEl.textContent = '';
  if (tab.loading) {
    iconEl.append(el('span', 'spinner'));
  } else if (tab.favicon) {
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.addEventListener('error', () => { iconEl.innerHTML = ICONS.globe; });
    img.src = tab.favicon;
    iconEl.append(img);
  } else if (tab.url) {
    iconEl.innerHTML = ICONS.globe;
  } else {
    iconEl.append(brandFavicon());
  }
}

function renderTabs() {
  const ids = new Set(state.tabs.map((t) => t.id));
  for (const [id, node] of tabEls) {
    if (ids.has(id)) continue;
    tabEls.delete(id);
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 320);
  }
  let previous = null;
  for (const tab of state.tabs) {
    let node = tabEls.get(tab.id);
    if (!node) {
      node = makeTabEl(tab.id);
      tabEls.set(tab.id, node);
      if (!firstTabRender) node.classList.add('entering');
    }
    updateTabEl(node, tab);
    const reference = previous ? previous.nextSibling : tabsEl.firstChild;
    if (reference !== node) tabsEl.insertBefore(node, reference);
    if (node.classList.contains('entering')) {
      void node.offsetWidth; // let the collapsed state apply, then grow from it
      node.classList.remove('entering');
    }
    previous = node;
  }
  firstTabRender = false;
}

// ---------- Address field ----------

function renderAddress() {
  const tab = activeTab();
  const url = tab ? tab.url : '';
  $('address-host').textContent = hostOf(url) || url;
  $('lock').hidden = !url.startsWith('https://');
  field.classList.toggle('empty', !url);
  if (document.activeElement !== address) address.value = '';

  const loading = !!(tab && tab.loading);
  const reload = $('reload');
  const mode = loading ? 'stop' : 'reload';
  if (reload.dataset.mode !== mode) {
    reload.dataset.mode = mode;
    reload.innerHTML = loading ? ICONS.close : ICONS.reload;
    reload.title = loading ? 'Stop' : 'Reload';
  }
  reload.hidden = !url;

  if (state.activeId !== lastActiveId) {
    progress.className = '';
    wasLoading = false;
  }
  if (loading && !wasLoading) {
    progress.className = '';
    void progress.offsetWidth; // restart the animation
    progress.classList.add('run');
  } else if (!loading && wasLoading) {
    progress.classList.add('done');
    setTimeout(() => { if (!wasLoading) progress.className = ''; }, 520);
  }
  wasLoading = loading;
}

address.addEventListener('focus', () => {
  closeSuggest();
  const tab = activeTab();
  address.value = tab ? tab.url : '';
  field.classList.add('focused');
  address.select();
});

address.addEventListener('blur', () => {
  field.classList.remove('focused');
  address.value = '';
  closeSuggest();
});

address.addEventListener('input', updateSuggest);

address.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const picked = suggestOpen ? suggestItems[suggestIndex] : null;
    const text = picked ? picked.value : address.value;
    if (text.trim()) act('nav.go', text);
    address.blur();
  } else if (event.key === 'Escape') {
    address.blur();
    act('focus.page');
  } else if (suggestOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    suggestIndex = (suggestIndex + step + suggestItems.length) % suggestItems.length;
    paintSuggestSelection();
  }
});

// Clicking the field anywhere (including the centred host name) starts editing.
field.addEventListener('mousedown', (event) => {
  if (event.target.closest('#reload') || document.activeElement === address) return;
  event.preventDefault();
  address.focus();
});

$('reload').addEventListener('click', () => {
  const tab = activeTab();
  act(tab && tab.loading ? 'nav.stop' : 'nav.reload');
});

// ---------- Suggestions ----------

let suggestItems = [];
let suggestIndex = 0;

function looksLikeURL(text) {
  return !/\s/.test(text) && (/^https?:\/\//i.test(text) || /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(text) || /^localhost(:\d+)?/i.test(text));
}

function updateSuggest() {
  const text = address.value.trim();
  const query = text.toLowerCase();
  if (!query || document.activeElement !== address) { closeSuggest(); return; }

  const items = [
    looksLikeURL(text)
      ? { kind: 'go', title: text, sub: 'Open website', value: text }
      : { kind: 'search', title: text, sub: `Search ${state ? state.searchName : 'the web'}`, value: text },
  ];
  const seen = new Set();
  const pool = [...lib.bookmarks, ...lib.history];
  for (const entry of pool) {
    if (items.length >= 7) break;
    if (seen.has(entry.url)) continue;
    const title = entry.title || '';
    if (!title.toLowerCase().includes(query) && !entry.url.toLowerCase().includes(query)) continue;
    seen.add(entry.url);
    items.push({ kind: 'page', title: title || hostOf(entry.url), sub: hostOf(entry.url), value: entry.url, favicon: entry.favicon });
  }
  suggestItems = items;
  suggestIndex = 0;
  suggest.textContent = '';
  items.forEach((item, index) => {
    const row = el('div', 'sg-row');
    row.setAttribute('role', 'option');
    if (item.kind === 'page') row.append(siteIcon(item.favicon, item.value, 'small'));
    else row.append(icon(item.kind === 'search' ? 'search' : 'globe', 'sg-icon'));
    row.append(el('span', 'sg-title', item.title), el('span', 'sg-sub', item.sub));
    // mousedown, so the field doesn't lose focus (and close the list) first
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      act('nav.go', item.value);
      address.blur();
    });
    row.addEventListener('mousemove', () => { if (suggestIndex !== index) { suggestIndex = index; paintSuggestSelection(); } });
    suggest.append(row);
  });
  paintSuggestSelection();

  const rect = field.getBoundingClientRect();
  suggest.style.left = rect.left + 'px';
  suggest.style.top = rect.bottom + 6 + 'px';
  suggest.style.width = rect.width + 'px';
  if (!suggestOpen) {
    suggestOpen = true;
    body.classList.add('suggesting');
    syncOverlay();
  }
}

function paintSuggestSelection() {
  [...suggest.children].forEach((row, index) => row.classList.toggle('selected', index === suggestIndex));
}

function closeSuggest() {
  if (!suggestOpen) return;
  suggestOpen = false;
  body.classList.remove('suggesting');
  syncOverlay();
}

// ---------- Sidebar ----------

function setPane(name) {
  pane = name;
  for (const section of document.querySelectorAll('.pane')) {
    section.classList.toggle('active', section.dataset.pane === name);
    section.classList.toggle('behind', section.dataset.pane === 'root' && name !== 'root');
  }
  flushLibrary(); // draws the list that just became visible
}

for (const button of document.querySelectorAll('[data-open]')) {
  button.addEventListener('click', () => setPane(button.dataset.open));
}

let groupsSig = '';

// Tab groups are chips to the left of the tabs, like a tab bar.
function renderGroups() {
  if (renaming) return;
  // Titles and icons change constantly while pages load; the group list rarely does.
  const sig = JSON.stringify([state.groups, state.activeGroupId]);
  if (sig === groupsSig) return;
  groupsSig = sig;
  const bar = $('groupbar');
  bar.textContent = '';
  for (const group of state.groups) {
    const chip = el('button', 'chip');
    chip.dataset.id = group.id;
    chip.classList.toggle('active', group.id === state.activeGroupId);
    chip.classList.toggle('private', !!group.private);
    chip.title = `${group.name} · ${group.count} ${group.count === 1 ? 'tab' : 'tabs'}`;
    if (group.private) chip.append(icon('lock', 'chip-icon'));
    chip.append(el('span', 'name', group.name));

    chip.addEventListener('click', () => act('group.switch', group.id));
    chip.addEventListener('contextmenu', (event) => { event.preventDefault(); act('group.menu', group.id); });
    chip.addEventListener('dblclick', () => startRename(chip, group.name, (value) => act('group.rename', group.id, value)));
    // Tabs can be dropped on a group to move them there.
    chip.addEventListener('dragover', (event) => {
      if (!event.dataTransfer.types.includes('text/x-thanary-tab')) return;
      event.preventDefault();
      chip.classList.add('drop');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drop'));
    chip.addEventListener('drop', (event) => {
      chip.classList.remove('drop');
      const dragged = Number(event.dataTransfer.getData('text/x-thanary-tab'));
      if (dragged) { event.preventDefault(); act('tab.toGroup', dragged, group.id); }
    });
    bar.append(chip);
  }
  const add = el('button', 'chip add');
  add.append(icon('plus'));
  add.title = 'New Tab Group';
  add.setAttribute('aria-label', 'New Tab Group');
  add.addEventListener('click', () => act('group.newMenu'));
  bar.append(add);
  const active = bar.querySelector('.chip.active');
  if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

function startRename(row, current, commit) {
  const label = row.querySelector('.name');
  if (!label || renaming) return;
  renaming = true;
  const input = el('input', 'rename');
  input.type = 'text';
  input.value = current;
  input.spellcheck = false;
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    renaming = false;
    const value = input.value.trim();
    if (save && value && value !== current) commit(value);
    groupsSig = '';
    renderGroups();
    renderLibrary();
  };
  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('dblclick', (event) => event.stopPropagation());
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') finish(true);
    else if (event.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function linkRow(entry, onMenu) {
  const row = el('button', 'row link');
  row.append(siteIcon(entry.favicon, entry.url, 'small'));
  const text = el('span', 'name');
  text.textContent = entry.title || hostOf(entry.url) || entry.url;
  row.append(text);
  row.title = entry.url;
  row.addEventListener('click', (event) => act('nav.open', entry.url, event.metaKey || event.ctrlKey));
  row.addEventListener('auxclick', (event) => { if (event.button === 1) act('nav.open', entry.url, true); });
  row.addEventListener('contextmenu', (event) => { event.preventDefault(); onMenu(); });
  return row;
}

function emptyNote(text) {
  return el('p', 'empty', text);
}

function dayLabel(ts) {
  const day = new Date(ts);
  const today = new Date();
  const start = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((start(today) - start(day)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// The library (bookmarks, reading list, history) is large, and rebuilding every list on every
// page load made navigation stutter. So each part is drawn only while it is on screen, and
// drawn again when it next becomes visible if the data changed in the meantime.
const dirty = { bookmarks: true, reading: true, history: true, favs: true, start: true };

function renderLibrary() {
  for (const key of Object.keys(dirty)) dirty[key] = true;
  flushLibrary();
}

function flushLibrary() {
  if (renaming) return;
  if (dirty.favs && state && state.settings.favBar) { dirty.favs = false; drawFavs(); }
  if (dirty.start && body.classList.contains('start')) { dirty.start = false; renderStart(); }
  if (dirty.bookmarks && pane === 'bookmarks') { dirty.bookmarks = false; drawBookmarks(); }
  if (dirty.reading && pane === 'reading') { dirty.reading = false; drawReading(); }
  if (dirty.history && pane === 'history') { dirty.history = false; drawHistory(); }
}

function drawBookmarks() {
  const bookmarksEl = $('bookmarks');
  bookmarksEl.textContent = '';
  const favorites = lib.bookmarks.filter((b) => b.favorite);
  const others = lib.bookmarks.filter((b) => !b.favorite);
  const addSection = (title, list) => {
    if (!list.length) return;
    bookmarksEl.append(el('h3', 'sb-label', title));
    for (const bookmark of list) {
      const row = linkRow(bookmark, () => act('bookmark.menu', bookmark.id));
      row.dataset.id = bookmark.id;
      bookmarksEl.append(row);
    }
  };
  addSection('Favorites', favorites);
  addSection('Bookmarks', others);
  if (!lib.bookmarks.length) bookmarksEl.append(emptyNote('No bookmarks yet. Press ⌘D on a page to add one.'));
}

function drawReading() {
  const readingEl = $('reading');
  readingEl.textContent = '';
  for (const item of lib.readingList) {
    const row = linkRow(item, () => act('reading.menu', item.id));
    row.classList.add('two-line');
    row.querySelector('.name').after(el('span', 'sub', hostOf(item.url)));
    readingEl.append(row);
  }
  if (!lib.readingList.length) readingEl.append(emptyNote('Pages you save to read later appear here.'));
}

function drawHistory() {
  const historyEl = $('history');
  historyEl.textContent = '';
  let label = null;
  for (const entry of lib.history) {
    const next = dayLabel(entry.ts);
    if (next !== label) { label = next; historyEl.append(el('h3', 'sb-label', label)); }
    historyEl.append(linkRow(entry, () => act('history.menu', entry.url, entry.ts)));
  }
  if (!lib.history.length) historyEl.append(emptyNote('Pages you visit appear here.'));
  $('clear-history').hidden = !lib.history.length;
}

function drawFavs() {
  const favs = $('favs');
  favs.textContent = '';
  for (const bookmark of lib.bookmarks.filter((b) => b.favorite)) {
    const button = el('button', 'fav', bookmark.title);
    button.title = bookmark.url;
    button.addEventListener('click', (event) => act('nav.open', bookmark.url, event.metaKey || event.ctrlKey));
    button.addEventListener('contextmenu', (event) => { event.preventDefault(); act('bookmark.menu', bookmark.id); });
    favs.append(button);
  }
}

// ---------- Start page ----------

function tile(entry, onMenu) {
  const node = el('button', 'tile reveal');
  node.append(siteIcon(entry.favicon, entry.url, 'large'), el('span', 'tile-label', entry.title || hostOf(entry.url)));
  node.title = entry.url;
  node.addEventListener('click', (event) => act('nav.open', entry.url, event.metaKey || event.ctrlKey));
  if (onMenu) node.addEventListener('contextmenu', (event) => { event.preventDefault(); onMenu(); });
  return node;
}

// ---- Portal start page: top links, group tabs, search, link card, tiles and a feed ----

const PALETTE = ['#1d4ed8', '#ea580c', '#0891b2', '#dc2626', '#7c3aed', '#059669', '#be185d', '#ca8a04'];
let linkFilter = 'all';
let feedTab = 'recent';
let feedView = 'tiles';
try {
  feedView = localStorage.getItem('thanary-feed-view') === 'list' ? 'list' : 'tiles';
} catch {
  // storage can be unavailable; the default view is fine
}

function linkIcon(link) {
  const t = `${link.title} ${link.url}`.toLowerCase();
  if (/github/.test(t)) return 'code';
  if (/cloudflare/.test(t)) return 'cloud';
  if (/youtube/.test(t)) return 'play';
  if (/gallery|galerie/.test(t)) return 'image';
  if (/calendar|kalender/.test(t)) return 'calendar';
  if (/login|anmelden/.test(t)) return 'key';
  if (/team|myclient/.test(t)) return 'users';
  if (/projekt/.test(t)) return 'folder';
  if (/angebot/.test(t)) return 'tag';
  return 'globe';
}

const isBrandHome = (link) => {
  try {
    const u = new URL(link.url);
    return /(^|\.)tha-production\.com$/.test(u.hostname) && u.pathname === '/';
  } catch {
    return false;
  }
};

// MyClient pages open as one "app" tab: clicking again jumps back to it instead of piling up tabs.
function openLink(link, event) {
  const newTab = !!(event && (event.metaKey || event.ctrlKey));
  if (link.group === 'MyClient' && !newTab) act('app.open', link.url, 'MyClient');
  else act('nav.open', link.url, newTab);
}

function ago(ts) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function renderStart() {
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = state && state.settings.userName;
  $('greeting').textContent = name ? `${hello}, ${name}` : 'Hello there';
  $('subgreeting').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('who').textContent = name || 'THA';
  $('avatar').textContent = (name || 'THA').trim()[0].toUpperCase();
  $('start-input').placeholder = `Search ${state ? state.searchName : 'the web'} or enter a website name`;

  const links = (state && state.settings.workLinks) || [];
  const groups = [...new Set(links.map((l) => l.group))];
  if (linkFilter !== 'all' && !groups.includes(linkFilter)) linkFilter = 'all';

  // small links across the top
  const top = $('top-links');
  top.textContent = '';
  for (const link of links.filter((l) => l.group === groups[0]).slice(0, 5)) {
    const a = el('button', 'top-link', link.title);
    a.addEventListener('click', (event) => openLink(link, event));
    top.append(a);
  }

  // big group tabs
  const nav = $('portal-nav');
  nav.textContent = '';
  for (const key of ['all', ...groups]) {
    const tab = el('button', 'pnav' + (key === linkFilter ? ' active' : ''), key === 'all' ? 'Home' : key);
    tab.addEventListener('click', () => { linkFilter = key; renderStart(); });
    nav.append(tab);
  }

  // link card: one column per group, or one group spread over several columns
  const box = $('portal-links');
  box.textContent = '';
  $('links-title').textContent = linkFilter === 'all' ? 'THA Production' : linkFilter;
  const shown = linkFilter === 'all' ? groups : [linkFilter];
  const cols = el('div', 'link-cols' + (linkFilter === 'all' ? ' by-group' : ' single'));
  for (const group of shown) {
    const col = el('div', 'link-col');
    if (linkFilter === 'all') col.append(el('h3', 'link-head', group));
    for (const link of links.filter((l) => l.group === group)) {
      const row = el('button', 'link-row2');
      row.append(el('span', '', link.title));
      const arrow = icon('arrowR', 'arrow');
      row.append(arrow);
      row.title = link.url;
      row.addEventListener('click', (event) => openLink(link, event));
      col.append(row);
    }
    cols.append(col);
  }
  if (!links.length) cols.append(el('p', 'empty', 'Add links in Settings > Start Page.'));
  box.append(cols);

  // colourful tiles
  const tiles = $('portal-tiles');
  tiles.textContent = '';
  for (const link of links) {
    const sq = el('button', 'sq');
    const brand = isBrandHome(link);
    sq.style.background = brand ? '#000' : PALETTE[hueOf(link.title) % PALETTE.length];
    if (brand) {
      const logo = el('img', 'sq-logo');
      logo.src = 'assets/tha-logo.png';
      logo.alt = '';
      logo.draggable = false;
      sq.append(logo);
    } else {
      sq.append(icon(linkIcon(link), 'sq-icon'));
    }
    sq.append(el('span', 'sq-label', link.title));
    sq.title = link.url;
    sq.addEventListener('click', (event) => openLink(link, event));
    tiles.append(sq);
  }

  renderFeed();
  if (body.classList.contains('start')) revealStart(false);
}

function feedItems() {
  if (feedTab === 'favorites') return lib.bookmarks.filter((b) => b.favorite).map((b) => ({ ...b, kind: 'Favorite' }));
  if (feedTab === 'reading') return lib.readingList.map((r) => ({ ...r, kind: 'Reading list', ts: r.added }));
  const seen = new Set();
  const out = [];
  for (const h of lib.history) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push({ ...h, kind: 'Visited' });
    if (out.length >= 9) break;
  }
  return out;
}

function renderFeed() {
  for (const chip of document.querySelectorAll('#feed-chips .fchip')) chip.classList.toggle('active', chip.dataset.feed === feedTab);
  $('view-tiles').classList.toggle('active', feedView === 'tiles');
  $('view-list').classList.toggle('active', feedView === 'list');
  const box = $('feed-items');
  box.className = 'feed-items ' + feedView;
  box.textContent = '';
  const items = feedItems();
  if (!items.length) {
    box.append(el('p', 'empty', feedTab === 'recent' ? 'Pages you visit show up here.' : feedTab === 'favorites' ? 'Add favorites with the bookmark menu (⌘D).' : 'Pages you save to read later show up here.'));
    return;
  }
  for (const item of items) {
    const card = el('button', 'news ' + feedView);
    const hue = hueOf(hostOf(item.url));
    const top = el('div', 'news-top');
    top.style.background = `linear-gradient(135deg, hsl(${hue} 45% 22%), hsl(${(hue + 40) % 360} 50% 12%))`;
    top.append(siteIcon(item.favicon, item.url, 'large'));
    if (feedView === 'tiles') top.append(el('span', 'news-kind', item.kind));
    const text = el('div', 'news-body');
    if (feedView === 'list') text.append(el('span', 'news-kind inline', item.kind));
    text.append(el('strong', 'news-title', item.title || hostOf(item.url)));
    const meta = el('div', 'news-meta');
    meta.append(icon('clock', 'news-clock'), el('span', '', item.ts ? ago(item.ts) : hostOf(item.url)));
    if (item.ts) meta.append(el('span', 'news-host', hostOf(item.url)));
    text.append(meta);
    card.append(top, text);
    card.title = item.url;
    card.addEventListener('click', (event) => act('nav.open', item.url, event.metaKey || event.ctrlKey));
    box.append(card);
  }
}

for (const chip of document.querySelectorAll('#feed-chips .fchip')) {
  chip.addEventListener('click', () => { feedTab = chip.dataset.feed; renderFeed(); });
}
for (const [id, view] of [['view-tiles', 'tiles'], ['view-list', 'list']]) {
  $(id).addEventListener('click', () => {
    feedView = view;
    try { localStorage.setItem('thanary-feed-view', view); } catch { /* optional */ }
    renderFeed();
  });
}

// ---- search box with "Often visited" suggestions ----

const startInput = $('start-input');
const searchDrop = $('search-drop');

function renderSearchDrop() {
  const query = startInput.value.trim().toLowerCase();
  let label = 'Often visited';
  let items = lib.topSites.slice(0, 6);
  if (query) {
    label = 'Matches';
    items = [];
    const seen = new Set();
    for (const entry of [...lib.bookmarks, ...lib.history]) {
      if (items.length >= 6) break;
      if (seen.has(entry.url)) continue;
      if (!(entry.title || '').toLowerCase().includes(query) && !entry.url.toLowerCase().includes(query)) continue;
      seen.add(entry.url);
      items.push(entry);
    }
  }
  searchDrop.textContent = '';
  if (!items.length) { searchDrop.hidden = true; return; }
  searchDrop.append(el('div', 'drop-label', label));
  for (const entry of items) {
    const row = el('button', 'drop-row');
    row.append(siteIcon(entry.favicon, entry.url, 'small'), el('span', 'drop-title', entry.title || hostOf(entry.url)), el('span', 'drop-host', hostOf(entry.url)));
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      act('nav.open', entry.url, false);
      startInput.blur();
    });
    searchDrop.append(row);
  }
  searchDrop.hidden = false;
}

startInput.addEventListener('focus', renderSearchDrop);
startInput.addEventListener('input', renderSearchDrop);
startInput.addEventListener('blur', () => { searchDrop.hidden = true; });
startInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && startInput.value.trim()) {
    act('nav.go', startInput.value);
    startInput.value = '';
    startInput.blur();
  } else if (event.key === 'Escape') {
    startInput.blur();
  }
});
$('start-go').addEventListener('click', () => {
  if (startInput.value.trim()) { act('nav.go', startInput.value); startInput.value = ''; }
  else startInput.focus();
});

// ---- left rail ----

for (const button of document.querySelectorAll('.rail-btn')) {
  button.addEventListener('click', () => {
    if (button.dataset.app) { act('app.open', button.dataset.app, 'MyClient'); return; }
    if (button.dataset.settings !== undefined) { openSettings(); return; }
    if (button.dataset.pane) { act('set', 'sidebar', true); setPane(button.dataset.pane); return; }
    if (button.dataset.feed) { feedTab = button.dataset.feed; renderFeed(); }
    const target = button.dataset.go === 'top' ? $('portal') : $(button.dataset.go);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    for (const other of document.querySelectorAll('.rail-btn')) other.classList.toggle('active', other === button);
  });
}


// Fades the start page in, one element after another.
function revealStart(replay) {
  const items = [...$('start').querySelectorAll('.reveal')].filter((node) => node.offsetParent !== null);
  if (replay) {
    for (const node of items) { node.classList.remove('in'); node.style.transitionDelay = '0ms'; }
    void $('start').offsetWidth;
  }
  items.forEach((node, index) => {
    if (node.classList.contains('in')) return;
    const delay = Math.min(index * 24, 360);
    node.style.transitionDelay = delay + 'ms';
    node.classList.add('in');
    // Drop the stagger once it has played, so hover effects respond at once.
    setTimeout(() => { node.style.transitionDelay = ''; }, delay + 700);
  });
}

// ---------- Tab overview ----------

function openOverview() {
  if (overviewOpen) return;
  address.blur();
  overviewOpen = true;
  body.classList.add('overview');
  renderOverview(true);
  syncOverlay();
  act('overview.request');
}

function closeOverview() {
  if (!overviewOpen) return;
  overviewOpen = false;
  body.classList.remove('overview');
  syncOverlay();
}

function renderOverview(animate) {
  const group = state.groups.find((g) => g.id === state.activeGroupId);
  const count = state.tabs.length;
  $('overview-title').textContent = group && group.id !== 'default' ? group.name : `${count} ${count === 1 ? 'Tab' : 'Tabs'}`;

  const grid = $('overview-grid');
  grid.textContent = '';
  grid.classList.toggle('animate', animate);
  state.tabs.forEach((tab, index) => {
    const card = el('div', 'ov-card');
    card.classList.toggle('active', tab.id === state.activeId);
    card.style.animationDelay = Math.min(index * 32, 420) + 'ms';
    const thumb = el('div', 'ov-thumb');
    if (thumbs[tab.id] && tab.url) {
      const img = el('img');
      img.alt = '';
      img.draggable = false;
      img.src = thumbs[tab.id];
      thumb.append(img);
    } else {
      thumb.append(tab.url ? siteIcon(tab.favicon, tab.url, 'large') : brandFavicon('ov-brand'));
    }
    const close = el('button', 'ov-close');
    close.innerHTML = ICONS.close;
    close.setAttribute('aria-label', 'Close Tab');
    const meta = el('div', 'ov-meta');
    meta.append(el('span', 'ov-title', tab.title || (tab.url ? hostOf(tab.url) : 'Start Page')));
    card.append(thumb, close, meta);
    card.addEventListener('click', (event) => {
      if (event.target.closest('.ov-close')) { act('tab.close', tab.id); return; }
      act('tab.switch', tab.id);
      closeOverview();
    });
    grid.append(card);
  });

  const add = el('button', 'ov-card ov-add');
  add.style.animationDelay = Math.min(state.tabs.length * 32, 420) + 'ms';
  add.innerHTML = ICONS.plus;
  add.setAttribute('aria-label', 'New Tab');
  add.addEventListener('click', () => { closeOverview(); act('tab.new'); });
  grid.append(add);
}

$('overview').addEventListener('click', (event) => {
  if (event.target === $('overview') || event.target === $('overview-grid')) closeOverview();
});

// ---------- Find on page ----------

const findInput = $('find-input');

function openFind() {
  findOpen = true;
  body.classList.add('finding');
  reportInsets();
  findInput.focus();
  findInput.select();
  if (findInput.value) act('find.query', findInput.value, true);
}

function closeFind() {
  if (!findOpen) return;
  findOpen = false;
  body.classList.remove('finding');
  reportInsets();
  $('find-count').textContent = '';
  act('find.stop');
}

findInput.addEventListener('input', () => act('find.query', findInput.value, true));
findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') act('find.query', findInput.value, !event.shiftKey);
  else if (event.key === 'Escape') closeFind();
});
$('find-next').addEventListener('click', () => act('find.query', findInput.value, true));
$('find-prev').addEventListener('click', () => act('find.query', findInput.value, false));
$('find-done').addEventListener('click', closeFind);

// ---------- Toolbar buttons ----------

$('toggle-sidebar').addEventListener('click', () => act('set', 'sidebar', !state.settings.sidebar));
$('back').addEventListener('click', () => act('nav.back'));
$('forward').addEventListener('click', () => act('nav.forward'));
$('page-menu').addEventListener('click', () => act('page.menu'));
$('new-tab').addEventListener('click', () => { closeOverview(); act('tab.new'); });
$('overview-btn').addEventListener('click', () => (overviewOpen ? closeOverview() : openOverview()));
$('clear-history').addEventListener('click', () => act('history.clear'));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (modal) closeModal();
  else if (overviewOpen) closeOverview();
});

// ---------- Modal sheets (Settings, Ask AI, What's New) ----------

const modalEl = $('modal');
let modalClass = '';

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function openModal(name) {
  if (modal === name) return;
  address.blur();
  closeSuggest();
  closeOverview();
  if (modalClass) body.classList.remove(modalClass);
  modal = name;
  modalClass = 'modal-' + name;
  body.classList.add('modal-open', modalClass);
  syncOverlay();
}

function closeModal() {
  if (!modal) return;
  body.classList.remove('modal-open', modalClass);
  modal = null;
  modalClass = '';
  syncOverlay();
  act('focus.page');
}

modalEl.addEventListener('mousedown', (event) => { if (event.target === modalEl) closeModal(); });
for (const button of modalEl.querySelectorAll('[data-close]')) button.addEventListener('click', closeModal);

// ---------- Settings ----------

let settingsPane = 'general';
let tokenNote = '';
let upd = { state: 'idle', version: null, message: '' };
let adInfo = { enabled: true, state: 'loading', blocked: 0 };
let linkDraft = null;
let linksSig = '';

const setEngine = $('set-engine');
const setName = $('set-name');
const setModel = $('set-model');

function openSettings(target) {
  const pane = target && typeof target === 'object' ? target.pane : target;
  openModal('settings');
  setSettingsPane(pane || settingsPane);
  renderSettings();
  if (target && typeof target === 'object' && target.prefillUrl) {
    $('login-url').value = target.prefillUrl;
    $('login-user').focus();
  }
}

function setSettingsPane(name) {
  if (!document.querySelector(`.set-pane[data-spane="${name}"]`)) name = 'general';
  settingsPane = name;
  for (const node of document.querySelectorAll('[data-spane]')) node.classList.toggle('active', node.dataset.spane === name);
}

for (const button of document.querySelectorAll('.set-nav [data-spane]')) {
  button.addEventListener('click', () => setSettingsPane(button.dataset.spane));
}

function renderSettings() {
  if (!state) return;
  const s = state.settings;
  setEngine.value = s.searchEngine;
  $('set-sidebar').checked = !!s.sidebar;
  $('set-favbar').checked = !!s.favBar;
  $('set-adblock').checked = !!s.adblock;
  $('set-autoupdate').checked = !!s.autoUpdate;
  if (document.activeElement !== setName) setName.value = s.userName || '';
  if (document.activeElement !== setModel) setModel.value = s.aiModel || '';
  $('ai-token-status').textContent = tokenNote || (state.aiTokenSaved ? 'Token saved and encrypted on this Mac.' : 'No token saved.');
  $('ai-token-remove').hidden = !state.aiTokenSaved;
  $('about-version').textContent = `Version ${state.version}`;
  $('about-engine').textContent = `Chromium ${state.versions.chrome} · Electron ${state.versions.electron}`;
  renderLinksEditor();
  renderLogins();
  renderAdblock();
  renderUpdate();
}

setEngine.addEventListener('change', () => act('set', 'searchEngine', setEngine.value));
$('set-sidebar').addEventListener('change', (event) => act('set', 'sidebar', event.target.checked));
$('set-favbar').addEventListener('change', (event) => act('set', 'favBar', event.target.checked));
$('set-adblock').addEventListener('change', (event) => act('set', 'adblock', event.target.checked));
$('set-autoupdate').addEventListener('change', (event) => act('set', 'autoUpdate', event.target.checked));
setName.addEventListener('input', debounce(() => act('set', 'userName', setName.value), 400));
setModel.addEventListener('input', debounce(() => act('set', 'aiModel', setModel.value), 400));
$('set-clear-history').addEventListener('click', () => act('history.clear'));
$('set-clear-data').addEventListener('click', () => act('privacy.clear'));
$('set-new-private').addEventListener('click', () => { closeModal(); act('group.newPrivate'); });
$('open-settings').addEventListener('click', () => openSettings());

// The links shown on the start page. Edits are saved as you type (valid web addresses only).
const saveLinks = debounce(() => act('work.save', linkDraft.filter((l) => /^https?:\/\//i.test(l.url))), 500);

function renderLinksEditor() {
  const list = $('links-list');
  if (list.contains(document.activeElement)) return; // never rebuild while the user is typing
  const sig = JSON.stringify(state.settings.workLinks);
  if (linkDraft && sig === linksSig) return;
  linksSig = sig;
  linkDraft = state.settings.workLinks.map((l) => ({ ...l }));
  drawLinks();
}

function drawLinks() {
  const list = $('links-list');
  list.textContent = '';
  linkDraft.forEach((link, index) => {
    const row = el('div', 'link-row');
    const title = el('input');
    title.type = 'text';
    title.value = link.title;
    title.placeholder = 'Name';
    title.maxLength = 40;
    title.spellcheck = false;
    const url = el('input');
    url.type = 'text';
    url.value = link.url;
    url.placeholder = 'https://…';
    url.spellcheck = false;
    const group = el('input');
    group.type = 'text';
    group.value = link.group || '';
    group.placeholder = 'Group';
    group.maxLength = 30;
    group.spellcheck = false;
    const remove = el('button', 'tb small');
    remove.innerHTML = ICONS.close;
    remove.title = 'Remove link';
    title.addEventListener('input', () => { link.title = title.value; saveLinks(); });
    url.addEventListener('input', () => { link.url = url.value.trim(); saveLinks(); });
    group.addEventListener('input', () => { link.group = group.value; saveLinks(); });
    remove.addEventListener('click', () => { linkDraft.splice(index, 1); drawLinks(); saveLinks(); });
    row.append(title, url, group, remove);
    list.append(row);
  });
}

$('add-link').addEventListener('click', () => {
  if (!linkDraft) linkDraft = [];
  linkDraft.push({ title: '', url: 'https://', group: 'Links', favicon: null });
  drawLinks();
  const rows = $('links-list').querySelectorAll('.link-row');
  rows[rows.length - 1].querySelector('input').focus();
});

// ----- ad blocker -----

function renderAdblock() {
  const on = !!(state ? state.settings.adblock : adInfo.enabled);
  const shield = $('shield');
  shield.classList.toggle('on', on);
  shield.title = on ? `Ad blocker on · ${adInfo.blocked.toLocaleString()} blocked` : 'Ad blocker off';
  let text;
  if (!on) text = 'Off. Turn it on to block ads and trackers.';
  else if (adInfo.state === 'loading') text = 'Loading filter lists…';
  else if (adInfo.state === 'failed') text = 'The filter lists could not be loaded. Check your connection; it tries again next launch.';
  else text = `On · ${adInfo.blocked.toLocaleString()} blocked this session`;
  $('adblock-status').textContent = text;
}

$('shield').addEventListener('click', () => { if (state) act('set', 'adblock', !state.settings.adblock); });

// ----- updates -----

function renderUpdate() {
  const version = upd.version || '';
  const lines = {
    idle: ['Check whether a newer version is available.', ''],
    checking: ['Checking for updates…', ''],
    uptodate: ['Thanary is up to date.', state ? `Version ${state.version} is the latest.` : ''],
    downloading: [`Downloading Thanary ${version}…`, 'You can keep browsing.'],
    ready: [`Thanary ${version} is ready.`, 'Restart to finish updating.'],
    blocked: [`Thanary ${version} is available.`, upd.message],
    error: ['Could not check for updates.', upd.message],
    unavailable: ['Updates only work in the installed app.', 'You are running a development build.'],
  };
  const [line, sub] = lines[upd.state] || lines.idle;
  $('update-line').textContent = line;
  $('update-sub').textContent = sub;
  $('update-restart').hidden = upd.state !== 'ready';
  $('update-download').hidden = upd.state !== 'blocked';
  $('update-check').disabled = upd.state === 'checking' || upd.state === 'downloading';
}

$('update-check').addEventListener('click', () => act('update.check'));
$('update-restart').addEventListener('click', () => act('update.restart'));
$('update-download').addEventListener('click', () => act('update.download'));
$('open-whatsnew').addEventListener('click', () => showWhatsNew({ version: state ? state.version : '', fresh: false }));

// ----- AI token -----

$('ai-token-save').addEventListener('click', () => {
  const field = $('ai-token');
  const value = field.value.trim();
  if (!value) return;
  tokenNote = '';
  act('ai.setToken', value);
  field.value = '';
});

$('ai-token-remove').addEventListener('click', () => { tokenNote = ''; act('ai.removeToken'); });
$('ai-token-create').addEventListener('click', () => {
  closeModal();
  act('nav.open', 'https://github.com/settings/personal-access-tokens/new', true);
});

function onTokenResult(result) {
  tokenNote = result && result.ok ? '' : 'That does not look like a valid token, or secure storage is unavailable on this Mac.';
  if (modal === 'settings') renderSettings();
}

// ---------- Ask AI ----------

let aiHistory = [];
let aiBusy = false;
let aiSeq = 0;

function openAI() {
  openModal('ai');
  renderAI();
  setTimeout(() => $('ai-input').focus(), 60);
}

function renderAI() {
  const log = $('ai-log');
  log.textContent = '';
  const ready = !!(state && state.aiTokenSaved);
  if (!aiHistory.length) {
    const hint = el('div', 'ai-empty');
    hint.append(icon('sparkle', 'ai-empty-icon'));
    hint.append(el('p', '', ready ? 'Ask a question, or keep “Include this page” ticked and ask for a summary.' : 'Add your GitHub token to use the assistant.'));
    if (!ready) {
      const open = el('button', 'btn', 'Open AI Settings');
      open.addEventListener('click', () => openSettings('ai'));
      hint.append(open);
    }
    log.append(hint);
  }
  for (const message of aiHistory) {
    const bubble = el('div', 'ai-msg ' + (message.error ? 'error' : message.role));
    bubble.textContent = message.display || message.content;
    log.append(bubble);
  }
  if (aiBusy) log.append(el('div', 'ai-msg assistant thinking', 'Thinking…'));
  log.scrollTop = log.scrollHeight;
  $('ai-send').disabled = aiBusy;
}

function sendAI() {
  const input = $('ai-input');
  const text = input.value.trim();
  if (!text || aiBusy) return;
  aiHistory.push({ role: 'user', content: text });
  input.value = '';
  aiBusy = true;
  aiSeq += 1;
  renderAI();
  const history = aiHistory.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
  act('ai.ask', aiSeq, history, $('ai-include').checked);
}

$('ai-btn').addEventListener('click', openAI);
$('ai-send').addEventListener('click', sendAI);
$('ai-clear').addEventListener('click', () => { aiHistory = []; aiBusy = false; aiSeq += 1; renderAI(); });
$('ai-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendAI();
  }
});

// ---------- What's New ----------

function showWhatsNew(info) {
  const entries = window.CHANGELOG || [];
  const version = (info && info.version) || (state && state.version) || '';
  const entry = entries.find((e) => e.version === version) || entries[0];
  if (!entry) return;
  $('wn-title').textContent = info && info.fresh ? 'Welcome to Thanary' : 'What’s new in Thanary';
  $('wn-version').textContent = `Version ${version}`;
  const list = $('wn-list');
  list.textContent = '';
  entry.items.forEach((item, index) => {
    const row = el('div', 'wn-item');
    row.style.animationDelay = 120 + index * 70 + 'ms';
    row.append(icon(item.icon, 'wn-icon'));
    const text = el('div');
    text.append(el('strong', '', item.title), el('span', '', item.text));
    row.append(text);
    list.append(row);
  });
  openModal('whatsnew');
}

$('wn-done').addEventListener('click', closeModal);

// ---------- Auto-Login settings ----------

let loginEditId = null;
let loginsSig = '';

function hostOfOrigin(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

function miniSwitch(label, checked, onChange) {
  const wrap = el('label', 'mini');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  const sw = el('span', 'switch');
  sw.append(input, el('span'));
  wrap.append(el('em', '', label), sw);
  return wrap;
}

function renderLogins() {
  $('set-autologin').checked = !!state.settings.autoLogin;
  const sig = JSON.stringify(state.logins);
  if (sig === loginsSig) return;
  loginsSig = sig;
  const list = $('logins-list');
  list.textContent = '';
  if (!state.logins.length) {
    list.append(el('p', 'empty', 'No saved logins yet.'));
    return;
  }
  for (const login of state.logins) {
    const row = el('div', 'login-row');
    const info = el('div', 'login-info');
    info.append(el('strong', '', hostOfOrigin(login.origin)), el('span', '', login.username));
    const edit = el('button', 'btn', 'Edit');
    edit.addEventListener('click', () => startLoginEdit(login));
    const remove = el('button', 'tb small');
    remove.innerHTML = ICONS.close;
    remove.title = 'Remove login';
    remove.addEventListener('click', () => act('login.remove', login.id));
    row.append(
      info,
      miniSwitch('On', login.enabled, (value) => act('login.update', login.id, { enabled: value })),
      miniSwitch('Sign in', login.autoSubmit, (value) => act('login.update', login.id, { autoSubmit: value })),
      edit,
      remove,
    );
    list.append(row);
  }
}

function resetLoginForm() {
  loginEditId = null;
  $('login-url').value = '';
  $('login-user').value = '';
  $('login-pass').value = '';
  $('login-pass').placeholder = 'Password';
  $('login-auto').checked = false;
  $('login-form-title').textContent = 'Add a login';
  $('login-save').textContent = 'Save Login';
  $('login-cancel').hidden = true;
}

function startLoginEdit(login) {
  loginEditId = login.id;
  $('login-url').value = login.origin;
  $('login-user').value = login.username;
  $('login-pass').value = '';
  $('login-pass').placeholder = 'Leave blank to keep the saved password';
  $('login-auto').checked = !!login.autoSubmit;
  $('login-form-title').textContent = 'Edit login';
  $('login-save').textContent = 'Save Changes';
  $('login-cancel').hidden = false;
  $('login-note').textContent = '';
  $('login-user').focus();
}

$('set-autologin').addEventListener('change', (event) => act('set', 'autoLogin', event.target.checked));
$('login-cancel').addEventListener('click', () => { resetLoginForm(); $('login-note').textContent = ''; });
$('login-current').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab || !/^https?:\/\//i.test(tab.url)) { $('login-note').textContent = 'Open the website in a tab first.'; return; }
  try {
    $('login-url').value = new URL(tab.url).origin;
  } catch {
    // keep what was typed
  }
});
$('login-save').addEventListener('click', () => {
  $('login-note').textContent = '';
  act('login.save', {
    id: loginEditId,
    url: $('login-url').value.trim(),
    username: $('login-user').value.trim(),
    password: $('login-pass').value,
    autoSubmit: $('login-auto').checked,
  });
});

function onLoginResult(result) {
  if (result && result.ok) {
    resetLoginForm();
    $('login-note').textContent = 'Saved.';
    loginsSig = '';
  } else {
    $('login-note').textContent = (result && result.error) || 'Could not save the login.';
  }
}

// ---------- Right-click "Ask AI" on selected text ----------

function runAIOnSelection(payload) {
  if (!payload || !payload.selection) return;
  openModal('ai');
  aiHistory = [];
  aiBusy = true;
  aiSeq += 1;
  const content = `${payload.instruction}\n\n"""\n${payload.selection}\n"""`;
  const short = payload.selection.length > 160 ? payload.selection.slice(0, 160) + '…' : payload.selection;
  aiHistory.push({ role: 'user', content, display: `${payload.instruction}\n“${short}”` });
  renderAI();
  act('ai.ask', aiSeq, [{ role: 'user', content }], false);
}

// ---------- Updates from the main process ----------

let lastLayoutKey = '';

function render() {
  const settings = state.settings;
  body.classList.toggle('sidebar-open', !!settings.sidebar);
  body.classList.toggle('favbar-open', !!settings.favBar);
  body.classList.toggle('fullscreen', !!state.fullscreen);
  $('toggle-sidebar').title = settings.sidebar ? 'Hide Sidebar' : 'Show Sidebar';
  $('back').disabled = !state.canGoBack;
  $('forward').disabled = !state.canGoForward;

  const tab = activeTab();
  const isStart = !tab || !tab.url;
  body.classList.toggle('start', isStart);
  $('page-menu').disabled = isStart;
  const startSig = JSON.stringify([settings.userName, settings.workLinks, state.searchName]);
  if (startSig !== lastStartSig) { lastStartSig = startSig; dirty.start = true; }
  flushLibrary(); // draws the start page / favorites bar if they just became visible
  if (isStart && (wasStart !== true || state.activeId !== lastActiveId)) revealStart(true);
  wasStart = isStart;

  if (state.activeId !== lastActiveId && findOpen) closeFind();
  if (isStart && findOpen) closeFind();

  renderTabs();
  renderAddress();
  renderGroups();
  renderAdblock();
  if (modal === 'settings') renderSettings();
  if (overviewOpen) renderOverview(false);
  lastActiveId = state.activeId;
  // Measuring forces a layout, so only do it when the sidebar or favorites bar actually changed.
  const layoutKey = `${!!settings.sidebar}|${!!settings.favBar}`;
  if (layoutKey !== lastLayoutKey) {
    lastLayoutKey = layoutKey;
    reportInsets();
  }
}

B.on('state', (next) => {
  state = next;
  render();
});

B.on('library', (next) => {
  lib = next;
  renderLibrary();
});

B.on('update', (next) => {
  upd = next;
  if (modal === 'settings') renderUpdate();
});

B.on('adblock', (next) => {
  adInfo = next;
  renderAdblock();
});

B.on('ai', (reply) => {
  if (!reply || reply.id !== aiSeq) return; // an answer to a chat that was cleared
  aiBusy = false;
  if (reply.error) aiHistory.push({ role: 'assistant', content: reply.error, error: true });
  else aiHistory.push({ role: 'assistant', content: reply.text });
  if (modal === 'ai') renderAI();
});

B.on('cmd', (name, payload) => {
  if (!state) return;
  if (name === 'focus-address') {
    closeOverview();
    closeModal();
    address.focus();
  } else if (name === 'find') {
    openFind();
  } else if (name === 'found') {
    $('find-count').textContent = !findInput.value ? '' : payload.total ? `${payload.active} of ${payload.total}` : 'Not found';
  } else if (name === 'overview') {
    if (overviewOpen) closeOverview(); else openOverview();
  } else if (name === 'thumbs') {
    thumbs = payload || {};
    if (overviewOpen) renderOverview(false);
  } else if (name === 'settings') {
    openSettings(payload);
  } else if (name === 'whatsnew') {
    showWhatsNew(payload);
  } else if (name === 'ai-run') {
    runAIOnSelection(payload);
  } else if (name === 'login-result') {
    onLoginResult(payload);
  } else if (name === 'ai') {
    openAI();
  } else if (name === 'ai-token') {
    onTokenResult(payload);
  } else if (name === 'pane') {
    closeModal();
    setPane(payload);
  } else if (name === 'rename') {
    if (payload.kind === 'group') {
      const row = document.querySelector(`#groupbar .chip[data-id="${CSS.escape(payload.id)}"]`);
      const group = state.groups.find((g) => g.id === payload.id);
      if (row && group) startRename(row, group.name, (value) => act('group.rename', group.id, value));
    } else if (payload.kind === 'bookmark') {
      setPane('bookmarks');
      const row = document.querySelector(`#bookmarks .row[data-id="${CSS.escape(payload.id)}"]`);
      const bookmark = lib.bookmarks.find((b) => b.id === payload.id);
      if (row && bookmark) startRename(row, bookmark.title, (value) => act('bookmark.rename', bookmark.id, value));
    }
  }
});

setPane('root');

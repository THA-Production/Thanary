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
  const want = overviewOpen || suggestOpen;
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
      : { kind: 'search', title: text, sub: 'Search Google', value: text },
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

function renderGroups() {
  if (renaming) return;
  // Titles and icons change constantly while pages load; the group list rarely does.
  const sig = JSON.stringify([state.groups, state.activeGroupId]);
  if (sig === groupsSig) return;
  groupsSig = sig;
  const list = $('groups');
  list.textContent = '';
  for (const group of state.groups) {
    const isDefault = group.id === 'default';
    const row = el('button', 'row group');
    row.dataset.id = group.id;
    row.classList.toggle('active', group.id === state.activeGroupId);
    const name = isDefault ? `${group.count} ${group.count === 1 ? 'Tab' : 'Tabs'}` : group.name;
    row.append(icon(isDefault ? 'tabs' : 'grid'), el('span', 'name', name));
    if (!isDefault) row.append(el('span', 'count', String(group.count)));

    row.addEventListener('click', () => act('group.switch', group.id));
    if (!isDefault) {
      row.addEventListener('contextmenu', (event) => { event.preventDefault(); act('group.menu', group.id); });
      row.addEventListener('dblclick', () => startRename(row, group.name, (value) => act('group.rename', group.id, value)));
    }
    // Tabs can be dropped on a group to move them there.
    row.addEventListener('dragover', (event) => {
      if (!event.dataTransfer.types.includes('text/x-thanary-tab')) return;
      event.preventDefault();
      row.classList.add('drop');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', (event) => {
      row.classList.remove('drop');
      const dragged = Number(event.dataTransfer.getData('text/x-thanary-tab'));
      if (dragged) { event.preventDefault(); act('tab.toGroup', dragged, group.id); }
    });
    list.append(row);
  }
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

function renderStart() {
  const hour = new Date().getHours();
  $('greeting').textContent = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('subgreeting').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const favorites = lib.bookmarks.filter((b) => b.favorite);
  const favEl = $('start-favs');
  favEl.textContent = '';
  for (const bookmark of favorites) favEl.append(tile(bookmark, () => act('bookmark.menu', bookmark.id)));
  $('sec-favorites').hidden = !favorites.length;

  const frequent = lib.topSites.filter((site) => !favorites.some((b) => b.url === site.url));
  const freqEl = $('start-frequent');
  freqEl.textContent = '';
  for (const site of frequent) freqEl.append(tile(site));
  $('sec-frequent').hidden = !frequent.length;

  const readingEl = $('start-reading');
  readingEl.textContent = '';
  for (const item of lib.readingList.slice(0, 6)) {
    const card = el('button', 'card reveal');
    card.append(siteIcon(item.favicon, item.url, 'small'));
    const text = el('span', 'card-text');
    text.append(el('span', 'card-title', item.title || hostOf(item.url)), el('span', 'card-sub', hostOf(item.url)));
    card.append(text);
    card.addEventListener('click', (event) => act('nav.open', item.url, event.metaKey || event.ctrlKey));
    card.addEventListener('contextmenu', (event) => { event.preventDefault(); act('reading.menu', item.id); });
    readingEl.append(card);
  }
  $('sec-reading').hidden = !lib.readingList.length;

  if (body.classList.contains('start')) revealStart(false);
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
      thumb.append(tab.url ? siteIcon(tab.favicon, tab.url, 'large') : icon('grid', 'ov-start'));
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
$('new-group').addEventListener('click', () => act('group.new'));
$('clear-history').addEventListener('click', () => act('history.clear'));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (overviewOpen) closeOverview();
});

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
  flushLibrary(); // draws the start page / favorites bar if they just became visible
  if (isStart && (wasStart !== true || state.activeId !== lastActiveId)) revealStart(true);
  wasStart = isStart;

  if (state.activeId !== lastActiveId && findOpen) closeFind();
  if (isStart && findOpen) closeFind();

  renderTabs();
  renderAddress();
  renderGroups();
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

B.on('cmd', (name, payload) => {
  if (!state) return;
  if (name === 'focus-address') {
    closeOverview();
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
  } else if (name === 'pane') {
    setPane(payload);
  } else if (name === 'rename') {
    if (payload.kind === 'group') {
      setPane('root');
      const row = document.querySelector(`#groups .row[data-id="${CSS.escape(payload.id)}"]`);
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

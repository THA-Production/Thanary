const tabsEl = document.getElementById('tabs');
const addressEl = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');

document.body.classList.add(window.browser.platform);

document.getElementById('new-tab').addEventListener('click', () => window.browser.newTab());
backBtn.addEventListener('click', () => window.browser.back());
forwardBtn.addEventListener('click', () => window.browser.forward());
reloadBtn.addEventListener('click', () => window.browser.reload());

addressEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    window.browser.go(addressEl.value);
    addressEl.blur();
  } else if (event.key === 'Escape') {
    addressEl.blur();
    render(lastState);
  }
});
addressEl.addEventListener('focus', () => addressEl.select());
addressEl.addEventListener('blur', () => render(lastState));

let lastState = null;

// Tab titles come from websites, so they are only ever set as text, never as HTML.
function buildTab(tab, isActive) {
  const el = document.createElement('div');
  el.className = 'tab' + (isActive ? ' active' : '') + (tab.loading ? ' loading' : '');
  el.addEventListener('mousedown', (event) => {
    if (event.button === 1) window.browser.closeTab(tab.id); // middle-click closes
    else if (event.button === 0) window.browser.switchTab(tab.id);
  });

  let icon;
  if (tab.favicon && /^https?:|^data:image\//i.test(tab.favicon)) {
    icon = document.createElement('img');
    icon.src = tab.favicon;
    icon.addEventListener('error', () => { icon.className = 'icon placeholder'; icon.removeAttribute('src'); });
  } else {
    icon = document.createElement('div');
  }
  icon.className = 'icon' + (icon.tagName === 'DIV' ? ' placeholder' : '');
  el.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = tab.title || tab.url || 'New Tab';
  el.appendChild(title);

  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '×';
  close.title = 'Close tab';
  close.addEventListener('mousedown', (event) => event.stopPropagation());
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    window.browser.closeTab(tab.id);
  });
  el.appendChild(close);
  return el;
}

function render(state) {
  if (!state) return;
  lastState = state;
  tabsEl.replaceChildren(...state.tabs.map((tab) => buildTab(tab, tab.id === state.activeId)));
  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;
  const active = state.tabs.find((tab) => tab.id === state.activeId);
  // Don't overwrite what the user is typing.
  if (document.activeElement !== addressEl) addressEl.value = active ? active.url : '';
}

window.browser.onState(render);
window.browser.onFocusAddress(() => { addressEl.focus(); addressEl.select(); });

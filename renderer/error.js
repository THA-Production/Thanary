'use strict';

// The main process opens this page with ?kind=…&url=…&code=…&detail=… when a page can't be shown.
const params = new URLSearchParams(location.search);
const kind = params.get('kind') || 'generic';
const url = params.get('url') || '';
const isWeb = /^https?:\/\//i.test(url);

const MESSAGES = {
  offline: ['You’re offline', 'Thanary can’t reach the internet. Check your Wi-Fi or network cable. This page tries again by itself when you’re back online.'],
  dns: ['Can’t find that website', 'The address could not be found. Check it for typing mistakes, or try again if your connection dropped.'],
  server: ['The website isn’t responding', 'The server refused the connection, hung up, or took too long to answer. It may be down for a moment.'],
  cert: ['The connection isn’t private', 'This website’s security certificate can’t be trusted, so Thanary stopped loading it to protect your information.'],
  redirects: ['Too many redirects', 'This website keeps sending you around in circles. Clearing its cookies in Settings > Privacy sometimes helps.'],
  crashed: ['This page keeps crashing', 'The page stopped working more than once in a row, so Thanary stopped reloading it.'],
  generic: ['Can’t open this page', 'Something went wrong while loading it. Try again in a moment.'],
};

const [title, message] = MESSAGES[kind] || MESSAGES.generic;
document.title = title;
document.getElementById('title').textContent = title;
document.getElementById('message').textContent = message;
document.getElementById('url').textContent = url;
document.getElementById('url').hidden = !url;
const code = params.get('code');
const detail = params.get('detail');
document.getElementById('detail').textContent = [detail, code ? `(error ${code})` : ''].filter(Boolean).join(' ') || 'No further details.';

const retry = () => { if (isWeb) location.replace(url); };
document.getElementById('retry').addEventListener('click', retry);
document.getElementById('retry').hidden = !isWeb;
document.getElementById('back').addEventListener('click', () => history.back());
document.getElementById('back').hidden = history.length < 2;

// When the connection comes back, try the page once more.
if (kind === 'offline' || kind === 'dns' || kind === 'server') {
  window.addEventListener('online', () => setTimeout(retry, 600), { once: true });
}

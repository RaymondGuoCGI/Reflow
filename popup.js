const toggle = document.getElementById('toggle');
const hostSpan = document.getElementById('host');
const whitelistBtn = document.getElementById('whitelist');
const status = document.getElementById('status');

async function getActiveHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return null;
  return new URL(tab.url).hostname;
}

async function loadSettings() {
  const { enabled = true, whitelist = [] } = await chrome.storage.sync.get({
    enabled: true,
    whitelist: []
  });
  return { enabled, whitelist };
}

function updateStatus(text) {
  status.textContent = text;
}

async function refreshUI() {
  const host = await getActiveHost();
  hostSpan.textContent = host || '-';

  const { enabled, whitelist } = await loadSettings();
  toggle.checked = enabled;

  const isWhitelisted = host && whitelist.includes(host);
  whitelistBtn.textContent = isWhitelisted ? 'Remove from whitelist' : 'Add to whitelist';
}

toggle.addEventListener('change', async () => {
  await chrome.storage.sync.set({ enabled: toggle.checked });
  chrome.runtime.sendMessage({ type: 'reflow-settings-changed' });
  updateStatus('Updated');
});

whitelistBtn.addEventListener('click', async () => {
  const host = await getActiveHost();
  if (!host) return;

  const { whitelist } = await loadSettings();
  const next = new Set(whitelist);
  if (next.has(host)) {
    next.delete(host);
  } else {
    next.add(host);
  }

  await chrome.storage.sync.set({ whitelist: Array.from(next) });
  chrome.runtime.sendMessage({ type: 'reflow-settings-changed' });
  await refreshUI();
  updateStatus('Updated');
});

refreshUI();

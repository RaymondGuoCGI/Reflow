# Reflow Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome MV3 extension that removes Pinterest promoted cards and keeps the grid layout filled, with a popup toggle and domain whitelist.

**Architecture:** Content script scans/removes promoted cards and observes DOM changes. Popup and service worker manage settings via chrome.storage and runtime messaging.

**Tech Stack:** Chrome MV3 (manifest v3), plain JS/HTML/CSS, Node test runner + jsdom for DOM tests.

### Task 0: Commit the design and plan docs

**Files:**
- Add: `docs/plans/2026-01-18-reflow-design.md`
- Add: `docs/plans/2026-01-18-reflow-implementation-plan.md`

**Step 1: Stage the documents**

```bash
git add docs/plans/2026-01-18-reflow-design.md docs/plans/2026-01-18-reflow-implementation-plan.md
```

**Step 2: Commit**

```bash
git commit -m "docs: add reflow design and implementation plan"
```


### Task 1: Add a minimal test harness and fixtures

**Files:**
- Create: `package.json`
- Create: `tests/fixtures/pinterest-basic.html`
- Create: `tests/content.spec.js`

**Step 1: Write the failing test**

Create `tests/content.spec.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

function loadContentScript(dom) {
  global.document = dom.window.document;
  global.window = dom.window;
  global.MutationObserver = dom.window.MutationObserver;
  global.requestAnimationFrame = (cb) => cb();
  global.chrome = undefined;
  delete require.cache[require.resolve('../content.js')];
  require('../content.js');
  return global.Reflow;
}

test('removes promoted cards based on structural badge', () => {
  const dom = new JSDOM(require('node:fs').readFileSync(
    require('node:path').join(__dirname, 'fixtures', 'pinterest-basic.html'),
    'utf8'
  ));
  const Reflow = loadContentScript(dom);

  const root = dom.window.document;
  const removed = Reflow.removePromotedCards(root);
  const remaining = root.querySelectorAll('[data-test-id="pin-card"]');

  assert.equal(removed, 1);
  assert.equal(remaining.length, 1);
});
```

Create `tests/fixtures/pinterest-basic.html`:
```html
<!doctype html>
<html>
  <body>
    <div id="grid">
      <div data-test-id="pin-card">
        <div data-test-id="promoted-badge"></div>
      </div>
      <div data-test-id="pin-card">
        <div data-test-id="regular-badge"></div>
      </div>
    </div>
  </body>
</html>
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/content.spec.js`
Expected: FAIL with "Cannot find module '../content.js'" or "Reflow is undefined".

**Step 3: Create `package.json` for jsdom**

Create `package.json`:
```json
{
  "name": "reflow",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test tests/content.spec.js"
  },
  "devDependencies": {
    "jsdom": "^24.0.0"
  }
}
```

**Step 4: Run test to verify it still fails**

Run: `npm install`
Expected: packages installed.

Run: `npm test`
Expected: FAIL because `content.js` does not exist yet.

**Step 5: Commit**

```bash
git add package.json tests/fixtures/pinterest-basic.html tests/content.spec.js
git commit -m "test: add jsdom harness for promoted card detection"
```

### Task 2: Implement core promoted-card detection in content script

**Files:**
- Create: `content.js`

**Step 1: Write the failing test**

Update `tests/content.spec.js` to assert that only cards with a promoted badge are removed (already written). The test is still failing because `content.js` is missing.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../content.js'".

**Step 3: Write minimal implementation**

Create `content.js`:
```js
(() => {
  const CARD_SELECTORS = ['[data-test-id="pin-card"]'];
  const PROMOTED_BADGE_SELECTORS = [
    '[data-test-id="promoted-badge"]',
    '[data-test-id="ad-badge"]',
    '[data-test-id="sponsored-badge"]'
  ];

  function findPromotedCards(root) {
    const cards = root.querySelectorAll(CARD_SELECTORS.join(','));
    const promoted = [];
    for (const card of cards) {
      if (card.querySelector(PROMOTED_BADGE_SELECTORS.join(','))) {
        promoted.push(card);
      }
    }
    return promoted;
  }

  function removePromotedCards(root) {
    const cards = findPromotedCards(root);
    for (const card of cards) {
      card.remove();
    }
    return cards.length;
  }

  const Reflow = { findPromotedCards, removePromotedCards };
  globalThis.Reflow = Reflow;
  if (typeof module !== 'undefined') {
    module.exports = Reflow;
  }
})();
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 passing).

**Step 5: Commit**

```bash
git add content.js
git commit -m "feat: add promoted card detection and removal"
```

### Task 3: Add settings gate and DOM reflow observer

**Files:**
- Modify: `content.js`
- Modify: `tests/content.spec.js`

**Step 1: Write the failing test**

Add a test to `tests/content.spec.js`:
```js
test('shouldRunForPage respects enabled and whitelist', () => {
  const { shouldRunForPage } = require('../content.js');

  assert.equal(
    shouldRunForPage({ enabled: false, whitelist: [], hostname: 'www.pinterest.com' }),
    false
  );
  assert.equal(
    shouldRunForPage({ enabled: true, whitelist: ['www.pinterest.com'], hostname: 'www.pinterest.com' }),
    false
  );
  assert.equal(
    shouldRunForPage({ enabled: true, whitelist: [], hostname: 'www.pinterest.com' }),
    true
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "shouldRunForPage is not a function".

**Step 3: Write minimal implementation**

Update `content.js` to:
- Read settings via `chrome.storage.sync.get({ enabled: true, whitelist: [] })`.
- Exit early if `enabled` is false or hostname is in whitelist.
- Add a helper:
```js
function shouldRunForPage({ enabled, whitelist, hostname }) {
  if (!enabled) return false;
  if (!hostname) return false;
  return !whitelist.includes(hostname);
}
```
- Add a helper:
```js
function shouldRunForPage({ enabled, whitelist, hostname }) {
  if (!enabled) return false;
  if (!hostname) return false;
  return !whitelist.includes(hostname);
}
```
- Set up `MutationObserver` with a debounced scan:
```js
let scheduled = false;
function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    removePromotedCards(document);
  });
}
```
- Observe `document.body` for childList/subtree.
- Listen for runtime messages `{ type: 'reflow-settings-changed' }` and re-run the gating check.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (same as before; behavior gating is not covered by unit tests).

**Step 5: Commit**

```bash
git add content.js tests/content.spec.js
git commit -m "feat: gate removal by settings and observe DOM changes"
```

### Task 4: Implement popup UI and service worker

**Files:**
- Create: `popup.html`
- Create: `popup.js`
- Create: `popup.css`
- Create: `background.js`

**Step 1: Write the failing test**

Manual test checklist (initially failing):
- Popup shows enabled state.
- Toggle flips enabled state and persists.
- Whitelist button adds/removes current hostname.
- Active Pinterest tabs update behavior without reload.

**Step 2: Run test to verify it fails**

Open extension popup (after loading the unpacked extension) and verify that controls are missing.

**Step 3: Write minimal implementation**

Create `popup.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div class="card">
      <h1>Reflow</h1>
      <label class="row">
        <input id="toggle" type="checkbox" />
        <span>Enable</span>
      </label>
      <div class="row">
        <span id="host">-</span>
        <button id="whitelist">Add to whitelist</button>
      </div>
      <p id="status"></p>
    </div>
    <script src="popup.js"></script>
  </body>
</html>
```

Create `popup.css`:
```css
body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; }
.card { min-width: 240px; }
.row { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
button { padding: 6px 10px; }
```

Create `popup.js`:
```js
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
```

Create `background.js`:
```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'reflow-settings-changed') {
    chrome.tabs.query({
      url: [
        '*://*.pinterest.com/*',
        '*://*.pinterest.co.uk/*',
        '*://*.pinterest.de/*',
        '*://*.pinterest.jp/*',
        '*://*.pinterest.fr/*',
        '*://*.pinterest.es/*',
        '*://*.pinterest.it/*',
        '*://*.pinterest.ca/*',
        '*://*.pinterest.com.mx/*',
        '*://*.pinterest.co/*',
        '*://*.pinterest.com.br/*',
        '*://*.pinterest.co.kr/*',
        '*://*.pinterest.com.au/*',
        '*://*.pinterest.co.in/*'
      ]
    }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'reflow-settings-changed' });
      }
    });
  }
});
```

**Step 4: Run test to verify it passes**

Manual checklist: open popup, toggle settings, and confirm updates.

**Step 5: Commit**

```bash
git add popup.html popup.js popup.css background.js
git commit -m "feat: add popup toggle and whitelist controls"
```

### Task 5: Wire up manifest and permissions

**Files:**
- Create: `manifest.json`

**Step 1: Write the failing test**

Manual checklist: extension loads and content script runs on Pinterest pages.

**Step 2: Run test to verify it fails**

Load as unpacked extension and verify Chrome shows missing manifest.

**Step 3: Write minimal implementation**

Create `manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Reflow",
  "version": "0.1.0",
  "description": "Remove promoted cards on Pinterest and keep the grid reflowed.",
  "permissions": ["storage"],
  "host_permissions": [
    "*://*.pinterest.com/*",
    "*://*.pinterest.co.uk/*",
    "*://*.pinterest.de/*",
    "*://*.pinterest.jp/*",
    "*://*.pinterest.fr/*",
    "*://*.pinterest.es/*",
    "*://*.pinterest.it/*",
    "*://*.pinterest.ca/*",
    "*://*.pinterest.com.mx/*",
    "*://*.pinterest.co/*",
    "*://*.pinterest.com.br/*",
    "*://*.pinterest.co.kr/*",
    "*://*.pinterest.com.au/*",
    "*://*.pinterest.co.in/*"
  ],
  "action": {
    "default_title": "Reflow",
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.pinterest.com/*",
        "*://*.pinterest.co.uk/*",
        "*://*.pinterest.de/*",
        "*://*.pinterest.jp/*",
        "*://*.pinterest.fr/*",
        "*://*.pinterest.es/*",
        "*://*.pinterest.it/*",
        "*://*.pinterest.ca/*",
        "*://*.pinterest.com.mx/*",
        "*://*.pinterest.co/*",
        "*://*.pinterest.com.br/*",
        "*://*.pinterest.co.kr/*",
        "*://*.pinterest.com.au/*",
        "*://*.pinterest.co.in/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

**Step 4: Run test to verify it passes**

Load unpacked extension, open Pinterest, and confirm ads are removed and layout fills.

**Step 5: Commit**

```bash
git add manifest.json
git commit -m "feat: add MV3 manifest and wire content script"
```

### Task 6: Manual verification checklist

**Files:**
- Create: `docs/TESTING.md`

**Step 1: Write the failing test**

Create `docs/TESTING.md` with the manual checklist.

**Step 2: Run test to verify it fails**

Follow the checklist and note any issues.

**Step 3: Write minimal implementation**

Create `docs/TESTING.md`:
```md
# Reflow Manual Testing

- Pinterest home feed: promoted cards removed, grid has no gaps
- Pinterest search: promoted cards removed, grid has no gaps
- Pinterest detail page: promoted cards removed, grid has no gaps
- Toggle OFF: no removals occur
- Toggle ON: removals occur
- Whitelist current host: no removals
- Remove from whitelist: removals resume
```

**Step 4: Run test to verify it passes**

Run through the checklist after loading the extension.

**Step 5: Commit**

```bash
git add docs/TESTING.md
git commit -m "docs: add manual test checklist"
```




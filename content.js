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

  function shouldRunForPage({ enabled, whitelist, hostname }) {
    if (!enabled) return false;
    if (!hostname) return false;
    return !whitelist.includes(hostname);
  }

  async function loadSettings() {
    if (!globalThis.chrome || !chrome.storage || !chrome.storage.sync) {
      return { enabled: true, whitelist: [] };
    }
    return chrome.storage.sync.get({ enabled: true, whitelist: [] });
  }

  function scheduleScan() {
    if (scheduleScan.scheduled) return;
    scheduleScan.scheduled = true;
    requestAnimationFrame(() => {
      scheduleScan.scheduled = false;
      removePromotedCards(document);
    });
  }

  async function start() {
    const { enabled, whitelist } = await loadSettings();
    const hostname = globalThis.location ? location.hostname : '';
    if (!shouldRunForPage({ enabled, whitelist, hostname })) return;

    removePromotedCards(document);

    const observer = new MutationObserver(() => {
      scheduleScan();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'reflow-settings-changed') {
          removePromotedCards(document);
        }
      });
    }
  }

  const Reflow = { findPromotedCards, removePromotedCards, shouldRunForPage };
  globalThis.Reflow = Reflow;
  if (typeof module !== 'undefined') {
    module.exports = Reflow;
  }

  if (typeof window !== 'undefined' && window.document) {
    start();
  }
})();

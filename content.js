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

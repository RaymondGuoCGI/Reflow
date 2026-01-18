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

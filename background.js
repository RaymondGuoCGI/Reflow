chrome.runtime.onMessage.addListener((msg) => {
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

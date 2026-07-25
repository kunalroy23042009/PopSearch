// Inject "Radar" button next to YouTube channel names
(function () {
  'use strict';

  const API_BASE = 'https://creator-content-radar.onrender.com';

  function injectButton() {
    // Look for channel link/name elements on YouTube
    const selectors = [
      '#owner #owner-name a',           // Watch page channel name
      'ytd-channel-name a',              // Watch page
      '#channel-header-container #channel-name', // Channel page
      'yt-formatted-string.ytd-channel-name a',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.dataset.ccrInjected) continue;
        el.dataset.ccrInjected = 'true';

        const channelUrl = el.href || '';
        const channelHandle = channelUrl.split('/').pop() || '';

        const btn = document.createElement('button');
        btn.textContent = '\u26A1 Radar';
        btn.style.cssText = `
          margin-left: 8px;
          padding: 2px 10px;
          background: #ff4444;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          vertical-align: middle;
        `;
        btn.title = 'Analyze with Creator Content Radar';
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          chrome.runtime.sendMessage({
            action: 'analyzeChannel',
            channelUrl: channelUrl || channelHandle,
          });
        };
        el.parentNode.appendChild(btn);
      }
    }
  }

  // Run on page load and observe for dynamic content
  injectButton();
  const observer = new MutationObserver(() => injectButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();

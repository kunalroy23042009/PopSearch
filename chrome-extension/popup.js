document.addEventListener('DOMContentLoaded', function () {
  const urlInput = document.getElementById('channelUrl');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const result = document.getElementById('result');
  const rTitle = document.getElementById('rTitle');
  const rSubs = document.getElementById('rSubs');
  const rNiche = document.getElementById('rNiche');
  const rSummary = document.getElementById('rSummary');
  const fullReport = document.getElementById('fullReport');

  // Check for URL passed from content script
  chrome.storage.local.get(['pendingChannelUrl'], function (data) {
    if (data.pendingChannelUrl) {
      urlInput.value = data.pendingChannelUrl;
      chrome.storage.local.remove('pendingChannelUrl');
      analyze(data.pendingChannelUrl);
    }
  });

  analyzeBtn.addEventListener('click', function () {
    const url = urlInput.value.trim();
    if (!url) return;
    analyze(url);
  });

  urlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const url = urlInput.value.trim();
      if (url) analyze(url);
    }
  });

  async function analyze(channelUrl) {
    showLoading(true);
    hideError();
    hideResult();

    try {
      // Get token from storage
      const data = await chrome.storage.local.get(['ccr_token']);
      const token = data.ccr_token || '';

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const res = await fetch('https://creator-content-radar.onrender.com/analyze-channel', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ channel_url: channelUrl }),
      });

      if (!res.ok) {
        const d = await res.json();
        showError(d.detail || 'Analysis failed (' + res.status + ')');
        return;
      }

      const d = await res.json();
      if (d.job_id) {
        // Poll for completion
        pollJob(d.job_id, token);
      } else {
        showResult(d);
      }
    } catch (ex) {
      showError('Network error: ' + ex.message);
    }
  }

  async function pollJob(jobId, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let attempts = 0;
    const maxAttempts = 60;

    const poll = setInterval(async function () {
      attempts++;
      try {
        const res = await fetch('https://creator-content-radar.onrender.com/api/jobs/' + jobId, {
          headers: headers,
        });
        if (!res.ok) { clearInterval(poll); showError('Job not found'); return; }
        const j = await res.json();

        if (j.status === 'completed') {
          clearInterval(poll);
          // Load the report
          const reportRes = await fetch('https://creator-content-radar.onrender.com/api/reports/' + jobId, {
            headers: headers,
          });
          if (reportRes.ok) {
            const report = await reportRes.json();
            showResult(report.data?.profile || report);
          } else {
            showLoading(false);
            showResult({ title: 'Analysis complete', status: 'completed' });
          }
        } else if (j.status === 'failed') {
          clearInterval(poll);
          showError(j.error || 'Analysis failed');
        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          showError('Timed out waiting for analysis');
        }
      } catch { clearInterval(poll); showError('Polling error'); }
    }, 2000);
  }

  function showResult(data) {
    showLoading(false);
    result.style.display = 'block';
    rTitle.textContent = data.title || data.channel_title || data.channel_id || 'Channel';
    rSubs.textContent = data.subscriber_count ? fmtNum(data.subscriber_count) + ' subscribers' : 'N/A';
    rNiche.textContent = data.niche || 'Not classified';
    rSummary.textContent = data.ai_summary || data.description || 'Analysis complete';
    fullReport.href = 'https://creator-content-radar.onrender.com/app#dashboard';
  }

  function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    analyzeBtn.disabled = show;
  }

  function showError(msg) {
    showLoading(false);
    error.style.display = 'block';
    error.textContent = msg;
  }

  function hideError() { error.style.display = 'none'; }
  function hideResult() { result.style.display = 'none'; }

  function fmtNum(n) {
    if (n == null) return '\u2014';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }
});

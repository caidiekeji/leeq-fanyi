const state = {
  sourceLang: 'auto',
  targetLang: 'zh',
  status: 'idle',
  theme: loadLocal('theme', 'dark')
};

function initApp() {
  applyTheme(state.theme);
  populateLangSelectors();
  loadSettings();
  bindEvents();
  updateTranslateBtn();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = theme === 'light'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
}

function populateLangSelectors() {
  const srcSel = document.getElementById('sourceLang');
  const tgtSel = document.getElementById('targetLang');
  srcSel.innerHTML = '<option value="auto">自动检测</option>';
  Object.entries(LANG_MAP).forEach(([code, { name }]) => {
    srcSel.innerHTML += `<option value="${code}">${name}</option>`;
    tgtSel.innerHTML += `<option value="${code}">${name}</option>`;
  });
  srcSel.value = state.sourceLang;
  tgtSel.value = state.targetLang;
}

function loadSettings() {
  const displayText = document.getElementById('modelDisplayText');
  if (displayText) displayText.textContent = 'Cloudflare AI · m2m100';
}

function bindEvents() {
  document.getElementById('sourceLang').addEventListener('change', e => {
    state.sourceLang = e.target.value;
  });
  document.getElementById('targetLang').addEventListener('change', e => {
    state.targetLang = e.target.value;
  });
  document.getElementById('sourceText').addEventListener('input', e => {
    updateCharCount('source');
    updateTranslateBtn();
  });
  document.getElementById('translateBtn').addEventListener('click', handleTranslate);
  document.getElementById('swapBtn').addEventListener('click', handleSwap);
  document.getElementById('copyBtn').addEventListener('click', handleCopy);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('settingsBtn').addEventListener('click', () => toggleModal(true));
  document.getElementById('modalClose').addEventListener('click', () => toggleModal(false));
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) toggleModal(false);
  });
  document.getElementById('apiKeyProvider').addEventListener('change', e => {
    const custom = document.getElementById('customEndpointGroup');
    custom.style.display = e.target.value === 'custom' ? 'block' : 'none';
  });
  document.getElementById('saveApiKeyBtn').addEventListener('click', handleSaveApiKey);
  document.getElementById('testConnBtn').addEventListener('click', handleTestConnection);
}

function updateCharCount(panel) {
  const text = document.getElementById(panel === 'source' ? 'sourceText' : 'resultText');
  const count = document.getElementById(panel === 'source' ? 'sourceCount' : 'resultCount');
  const len = (text.value || text.textContent || '').length;
  count.textContent = `${len} / 5000`;
  count.classList.toggle('over', len > 5000);
}

function updateTranslateBtn() {
  const btn = document.getElementById('translateBtn');
  const text = document.getElementById('sourceText').value.trim();
  btn.disabled = !text || state.status === 'translating';
}

async function handleTranslate() {
  const text = document.getElementById('sourceText').value.trim();
  if (!text) return;

  setState('translating');
  try {
    const result = await api('/api/translate', {
      method: 'POST',
      body: { text, sourceLang: state.sourceLang, targetLang: state.targetLang }
    });
    document.getElementById('resultText').textContent = result.translatedText;
    document.getElementById('resultText').classList.remove('empty');
    updateCharCount('result');
    if (result.sourceLang && state.sourceLang === 'auto') {
      const detected = LANG_MAP[result.sourceLang]?.name || result.sourceLang;
      document.getElementById('sourceLang').querySelector('option[value="auto"]').textContent = `自动检测 (${detected})`;
    }
    saveHistory(text, result.translatedText, result.sourceLang || state.sourceLang, state.targetLang);
    setState('success');
  } catch (err) {
    const resultEl = document.getElementById('resultText');
    resultEl.classList.add('empty');
    resultEl.innerHTML = `<div style="text-align:center;color:var(--error)"><p>翻译失败</p><p style="font-size:13px;margin-top:4px;opacity:0.8">${err.message}</p></div>`;
    setState('error');
  }
}

function setState(s) {
  state.status = s;
  const btn = document.getElementById('translateBtn');
  const result = document.getElementById('resultText');
  if (s === 'translating') {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>翻译中...</span>';
    result.classList.remove('empty');
    result.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l4.5-12z"/></svg><span>翻译</span>';
    updateTranslateBtn();
  }
}

function handleSwap() {
  const srcText = document.getElementById('sourceText');
  const resText = document.getElementById('resultText');
  const srcLang = document.getElementById('sourceLang');
  const tgtLang = document.getElementById('targetLang');

  const tmpText = srcText.value;
  const tmpResult = resText.textContent || '';
  const tmpSrcLang = srcLang.value === 'auto' ? state.targetLang : srcLang.value;

  srcText.value = tmpResult;
  resText.textContent = '';
  resText.classList.add('empty');
  srcLang.value = tmpSrcLang;
  tgtLang.value = tmpSrcLang;
  state.sourceLang = tmpSrcLang;
  state.targetLang = tmpSrcLang;
  updateCharCount('source');
  updateTranslateBtn();
}

async function handleCopy() {
  const text = document.getElementById('resultText').textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  } catch {
    showToast('复制失败', 'error');
  }
}

function handleClear() {
  document.getElementById('sourceText').value = '';
  const resText = document.getElementById('resultText');
  resText.classList.add('empty');
  resText.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l4.5-12z"/></svg>翻译结果将显示在这里';
  document.getElementById('sourceLang').querySelector('option[value="auto"]').textContent = '自动检测';
  updateCharCount('source');
  updateTranslateBtn();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveLocal('theme', state.theme);
}

function toggleModal(show) {
  const overlay = document.getElementById('modalOverlay');
  if (show) {
    renderApiKeysList();
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

function renderApiKeysList() {
  const list = document.getElementById('apiKeysList');
  list.innerHTML = '';
  Object.entries(state.apiKeys).forEach(([prov, keyData]) => {
    const provName = PROVIDERS[prov]?.name || prov;
    list.innerHTML += `<div class="api-key-item">
      <div class="api-key-info">
        <span class="api-key-provider">${provName}</span>
        <span class="api-key-masked">${maskKey(keyData.apiKey)}</span>
      </div>
      <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;color:var(--error);border-color:var(--error)" onclick="deleteApiKey('${prov}')">删除</button>
    </div>`;
  });
  if (!Object.keys(state.apiKeys).length) {
    list.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;text-align:center;padding:16px 0">暂未配置 API Key</p>';
  }
}

async function handleSaveApiKey() {
  const provider = document.getElementById('apiKeyProvider').value;
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const customEndpoint = document.getElementById('customEndpoint').value.trim();
  if (!apiKey) { showToast('请输入 API Key', 'error'); return; }

  try {
    const result = await api('/api/settings/apiKey', {
      method: 'POST',
      body: { provider, apiKey, customEndpoint: customEndpoint || null }
    });
    state.apiKeys[provider] = { apiKey, customEndpoint, keyMasked: result.keyMasked };
    saveLocal('apiKeys', state.apiKeys);
    document.getElementById('apiKeyInput').value = '';
    document.getElementById('customEndpoint').value = '';
    renderApiKeysList();
    showToast(`${PROVIDERS[provider]?.name || provider} Key 已保存`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteApiKey(provider) {
  delete state.apiKeys[provider];
  saveLocal('apiKeys', state.apiKeys);
  renderApiKeysList();
  populateModelSelector();
  showToast('已删除', 'info');
}

async function handleTestConnection() {
  showToast('测试中...', 'info');
  try {
    const result = await api('/api/settings/testConnection', {
      method: 'POST',
      body: { provider: state.provider, model: state.model }
    });
    showToast(result.success ? `连接成功 (${result.latency}ms)` : `连接失败: ${result.message}`, result.success ? 'success' : 'error');
  } catch (err) {
    showToast(`测试失败: ${err.message}`, 'error');
  }
}

function saveHistory(source, result, sourceLang, targetLang) {
  const history = loadLocal('history', []);
  history.unshift({ source, result, sourceLang, targetLang, time: Date.now() });
  if (history.length > 50) history.length = 50;
  saveLocal('history', history);
}

document.addEventListener('DOMContentLoaded', initApp);

const state = {
  sourceLang: 'auto',
  targetLang: 'zh',
  status: 'idle',
  theme: loadLocal('theme', 'light'),
  realtimeMode: loadLocal('realtimeMode', false),
  maxCharLimit: 5000,
  defaultProvider: null,
  defaultModel: null
};

const EMPTY_RESULT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l4.5-12z"/></svg><p>翻译结果将显示在这里</p>';

async function initApp() {
  applyTheme(state.theme);
  populateLangSelectors();
  await loadSystemConfig();
  loadSharedContent();
  bindEvents();
  bindShortcuts();
  bindDragDrop();
  updateTranslateBtn();
  bindNavbarScroll();
}

function bindNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.scrollY > 0);
  }, { passive: true });
}

function loadSharedContent() {
  const params = new URLSearchParams(window.location.search);
  const sharedText = params.get('text');
  if (!sharedText) return;
  const source = params.get('source') || 'auto';
  const target = params.get('target') || 'zh';
  document.getElementById('sourceLang').value = source;
  document.getElementById('targetLang').value = target;
  state.sourceLang = source;
  state.targetLang = target;
  document.getElementById('sourceText').value = decodeURIComponent(sharedText);
  updateTranslateBtn();
  updateCharCount('source');
}

async function loadSystemConfig() {
  try {
    // 加载系统配置和翻译配置（公开接口，无需认证）
    const res = await fetch('/api/translateConfig');
    if (res.ok) {
      const data = await res.json();
      if (data.code === 200 && data.data) {
        const config = data.data;
        
        // 系统配置
        state.maxCharLimit = config.maxCharLimit || 5000;
        state.sourceLang = config.defaultSourceLang || 'auto';
        state.targetLang = config.defaultTargetLang || 'zh';
        document.getElementById('sourceLang').value = state.sourceLang;
        document.getElementById('targetLang').value = state.targetLang;
        if (config.siteName) {
          document.getElementById('siteName').textContent = config.siteName;
        }
        if (config.announcement) {
          document.getElementById('announcementBar').style.display = 'block';
          document.getElementById('announcementText').textContent = config.announcement;
        }
        if (config.footer) {
          document.getElementById('footerText').textContent = config.footer;
        }
        updateCharCount('source');
        
        // 翻译配置
        state.defaultProvider = config.defaultProvider;
        state.defaultModel = config.defaultModel;
        console.log('配置加载成功:', config.defaultProvider, config.defaultModel);
      }
    }
  } catch(e) { console.error('加载配置失败:', e); }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
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

function bindEvents() {
  document.getElementById('sourceLang').addEventListener('change', e => {
    state.sourceLang = e.target.value;
    if (state.realtimeMode && document.getElementById('sourceText').value.trim()) {
      debouncedTranslate();
    }
  });
  document.getElementById('targetLang').addEventListener('change', e => {
    state.targetLang = e.target.value;
    if (state.realtimeMode && document.getElementById('sourceText').value.trim()) {
      debouncedTranslate();
    }
  });
  const sourceText = document.getElementById('sourceText');
  sourceText.addEventListener('input', e => {
    updateCharCount('source');
    updateTranslateBtn();
    if (state.realtimeMode) debouncedTranslate();
  });

  document.getElementById('translateBtn').addEventListener('click', e => {
    const forceRefresh = e.ctrlKey || e.metaKey;
    if (forceRefresh) {
      showToast('强制重新翻译（跳过缓存）', 'info');
    }
    handleTranslate(forceRefresh);
  });
  document.getElementById('swapLangBtn').addEventListener('click', handleSwap);
  document.getElementById('copyBtn').addEventListener('click', handleCopy);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('realtimeBtn').addEventListener('click', toggleRealtimeMode);
  document.getElementById('exportBtn').addEventListener('click', showExportMenu);
  
}

function bindShortcuts() {
  document.addEventListener('keydown', e => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
    if (isCtrl && e.key === 'k') {
      e.preventDefault();
      document.getElementById('sourceText').focus();
    }
    if (isCtrl && e.key === 'd') {
      e.preventDefault();
      handleClear();
    }
  });
}

function bindDragDrop() {
  const sourcePanel = document.querySelector('.tw-uni-source');
  if (!sourcePanel) return;
  sourcePanel.addEventListener('dragover', e => {
    e.preventDefault();
    sourcePanel.classList.add('drag-over');
  });
  sourcePanel.addEventListener('dragleave', () => {
    sourcePanel.classList.remove('drag-over');
  });
  sourcePanel.addEventListener('drop', async e => {
    e.preventDefault();
    sourcePanel.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const allowedExts = ['.txt', '.md', '.srt', '.json'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      showToast('仅支持 .txt / .md / .srt / .json 文件', 'error');
      return;
    }
    try {
      const text = await file.text();
      document.getElementById('sourceText').value = text;
      updateCharCount('source');
      updateTranslateBtn();
      if (state.realtimeMode) debouncedTranslate();
      showToast(`已加载 ${file.name}`, 'success');
    } catch (err) {
      showToast('文件读取失败: ' + err.message, 'error');
    }
  });
}

const debouncedTranslate = debounce(handleTranslate, 500);

function updateCharCount(panel) {
  const text = document.getElementById(panel === 'source' ? 'sourceText' : 'resultText');
  const count = document.getElementById(panel === 'source' ? 'sourceCount' : 'resultCount');
  const len = (text.value || text.textContent || '').length;
  count.textContent = `输入 ${len} / ${state.maxCharLimit}`;
  count.classList.toggle('over', len > state.maxCharLimit);
}

function updateTranslateBtn() {
  const btn = document.getElementById('translateBtn');
  const text = document.getElementById('sourceText').value.trim();
  btn.disabled = !text || state.status === 'translating';
}

async function handleTranslate(forceRefresh = false) {
  const text = document.getElementById('sourceText').value.trim();
  if (!text) return;
  if (text.length > state.maxCharLimit) {
    showToast(`文本超过${state.maxCharLimit}字符限制`, 'error');
    return;
  }

  setState('translating');
  const startTime = Date.now();
  try {
    const result = await api('/api/translate', {
      method: 'POST',
      body: { 
        text, 
        sourceLang: state.sourceLang, 
        targetLang: state.targetLang, 
        provider: state.defaultProvider,
        model: state.defaultModel,
        nocache: forceRefresh
      }
    });
    const resultEl = document.getElementById('resultText');
    resultEl.textContent = result.translatedText;
    resultEl.classList.remove('empty');
    updateCharCount('result');
    if (result.sourceLang && state.sourceLang === 'auto') {
      const detected = LANG_MAP[result.sourceLang]?.name || result.sourceLang;
      document.getElementById('sourceLang').querySelector('option[value="auto"]').textContent = `自动检测 (${detected})`;
    }
    const latency = Date.now() - startTime;
    setState('success');
    if (result.fromCache) {
      document.getElementById('resultCount').textContent += ' · 缓存';
    }
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

  srcText.value = '';
  resText.classList.add('empty');
  resText.innerHTML = EMPTY_RESULT;
  srcLang.value = state.targetLang;
  tgtLang.value = tmpSrcLang;
  state.sourceLang = state.targetLang;
  state.targetLang = tmpSrcLang;

  if (tmpResult) {
    srcText.value = tmpResult;
    if (state.realtimeMode) debouncedTranslate();
  }
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
  resText.innerHTML = EMPTY_RESULT;
  document.getElementById('sourceLang').querySelector('option[value="auto"]').textContent = '自动检测';
  updateCharCount('source');
  updateTranslateBtn();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveLocal('theme', state.theme);
}

function toggleRealtimeMode() {
  state.realtimeMode = !state.realtimeMode;
  saveLocal('realtimeMode', state.realtimeMode);
  const btn = document.getElementById('realtimeBtn');
  btn.classList.toggle('active', state.realtimeMode);
  if (state.realtimeMode) {
    showToast('实时翻译已开启', 'info');
    const text = document.getElementById('sourceText').value.trim();
    if (text) debouncedTranslate();
  } else {
    showToast('实时翻译已关闭', 'info');
  }
}

function showExportMenu() {
  const result = document.getElementById('resultText').textContent;
  if (!result) { showToast('没有可导出的内容', 'warning'); return; }
  const source = document.getElementById('sourceText').value.trim();

  const menu = document.createElement('div');
  menu.className = 'export-menu';
  menu.innerHTML = `
    <button class="export-item" data-type="txt">导出 TXT</button>
    <button class="export-item" data-type="md">导出 Markdown (.md)</button>
    <button class="export-item" data-type="csv">导出双语对照 (.csv)</button>
  `;
  document.body.appendChild(menu);

  const rect = document.getElementById('exportBtn').getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = (rect.left - 80) + 'px';

  menu.querySelectorAll('.export-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      let content, filename, mime;
      if (type === 'txt') {
        content = result;
        filename = 'translation.txt';
        mime = 'text/plain';
      } else if (type === 'md') {
        content = `${result}\n`;
        filename = 'translation.md';
        mime = 'text/markdown';
      } else {
        content = `原文,译文\n"${source.replace(/"/g, '""')}","${result.replace(/"/g, '""')}"`;
        filename = 'translation.csv';
        mime = 'text/csv';
      }
      downloadFile(content, filename, mime);
      menu.remove();
    });
  });

  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
  }, { once: true });
}

function downloadFile(content, filename, mime) {
  const blob = new Blob(['\ufeff' + content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`已导出 ${filename}`, 'success');
}



document.addEventListener('DOMContentLoaded', () => {
  initApp();
  // 初始化按钮状态
  if (state.realtimeMode) document.getElementById('realtimeBtn').classList.add('active');
});

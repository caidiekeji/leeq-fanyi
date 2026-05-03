const state = {
  sourceLang: 'auto',
  targetLang: 'zh',
  status: 'idle',
  theme: loadLocal('theme', 'dark'),
  realtimeMode: loadLocal('realtimeMode', false),
  preserveMarkdown: loadLocal('preserveMarkdown', false),
  preserveHtml: loadLocal('preserveHtml', false),
  codeCommentMode: loadLocal('codeCommentMode', false),
  historyPanel: false,
  favoritesPanel: false,
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

  document.getElementById('translateBtn').addEventListener('click', handleTranslate);
  document.getElementById('swapBtn').addEventListener('click', handleSwap);
  document.getElementById('copyBtn').addEventListener('click', handleCopy);
  document.getElementById('clearBtn').addEventListener('click', handleClear);
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('realtimeBtn').addEventListener('click', toggleRealtimeMode);
  document.getElementById('mdToggleBtn').addEventListener('click', toggleMarkdownMode);
  document.getElementById('htmlToggleBtn').addEventListener('click', toggleHtmlMode);
  document.getElementById('codeToggleBtn').addEventListener('click', toggleCodeCommentMode);
  document.getElementById('batchBtn').addEventListener('click', handleBatchTranslate);
  document.getElementById('favoriteBtn').addEventListener('click', handleFavorite);
  document.getElementById('exportBtn').addEventListener('click', showExportMenu);
  document.getElementById('shareBtn').addEventListener('click', handleShare);
  document.getElementById('ttsBtn').addEventListener('click', handleTTS);
  document.getElementById('historyBtn').addEventListener('click', toggleHistoryPanel);
  document.getElementById('favoritesBtn').addEventListener('click', toggleFavoritesPanel);
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
  const sourcePanel = document.querySelector('.panel-source .panel-body');
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

async function handleTranslate() {
  const text = document.getElementById('sourceText').value.trim();
  if (!text) return;
  if (text.length > state.maxCharLimit) {
    showToast(`文本超过${state.maxCharLimit}字符限制`, 'error');
    return;
  }

  setState('translating');
  const startTime = Date.now();
  try {
    const translatorMode = state.preserveMarkdown ? 'markdown'
      : state.preserveHtml ? 'html'
      : state.codeCommentMode ? 'code' : '';
    const result = await api('/api/translate', {
      method: 'POST',
      body: { 
        text, 
        sourceLang: state.sourceLang, 
        targetLang: state.targetLang, 
        mode: translatorMode,
        provider: state.defaultProvider,
        model: state.defaultModel
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
    saveHistory(text, result.translatedText, result.sourceLang || state.sourceLang, state.targetLang);
    document.getElementById('favoriteBtn').disabled = false;
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

async function handleBatchTranslate() {
  const text = document.getElementById('sourceText').value.trim();
  if (!text) return;
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    showToast('批量翻译需要至少2行文本', 'warning');
    return;
  }
  if (lines.length > 20) {
    showToast('最多支持20行批量翻译', 'error');
    return;
  }

  setState('translating');
  const results = [];
  let errors = 0;

  for (let i = 0; i < lines.length; i++) {
    try {
      const translatorMode = state.preserveMarkdown ? 'markdown'
        : state.preserveHtml ? 'html'
        : state.codeCommentMode ? 'code' : '';
      const result = await api('/api/translate', {
        method: 'POST',
        body: { 
          text: lines[i], 
          sourceLang: state.sourceLang, 
          targetLang: state.targetLang, 
          mode: translatorMode,
          provider: state.defaultProvider,
          model: state.defaultModel
        }
      });
      results.push(result.translatedText);
    } catch (err) {
      results.push(`[翻译失败: ${err.message}]`);
      errors++;
    }
    if (i < lines.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  const resultEl = document.getElementById('resultText');
  resultEl.textContent = results.join('\n');
  resultEl.classList.remove('empty');
  updateCharCount('result');
  setState('success');
  if (errors > 0) showToast(`批量翻译完成，${errors}行失败`, 'warning');
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
  document.getElementById('favoriteBtn').disabled = true;
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

function toggleMarkdownMode() {
  // 切换Markdown模式时关闭其他格式保留模式
  if (!state.preserveMarkdown) {
    state.preserveHtml = false;
    state.codeCommentMode = false;
    document.getElementById('htmlToggleBtn').classList.remove('active');
    document.getElementById('codeToggleBtn').classList.remove('active');
  }
  state.preserveMarkdown = !state.preserveMarkdown;
  saveLocal('preserveMarkdown', state.preserveMarkdown);
  const btn = document.getElementById('mdToggleBtn');
  btn.classList.toggle('active', state.preserveMarkdown);
  showToast(state.preserveMarkdown ? 'Markdown格式保留已开启' : 'Markdown格式保留已关闭', 'info');
}

function toggleHtmlMode() {
  if (!state.preserveHtml) {
    state.preserveMarkdown = false;
    state.codeCommentMode = false;
    document.getElementById('mdToggleBtn').classList.remove('active');
    document.getElementById('codeToggleBtn').classList.remove('active');
  }
  state.preserveHtml = !state.preserveHtml;
  saveLocal('preserveHtml', state.preserveHtml);
  const btn = document.getElementById('htmlToggleBtn');
  btn.classList.toggle('active', state.preserveHtml);
  showToast(state.preserveHtml ? 'HTML格式保留已开启' : 'HTML格式保留已关闭', 'info');
}

function toggleCodeCommentMode() {
  if (!state.codeCommentMode) {
    state.preserveMarkdown = false;
    state.preserveHtml = false;
    document.getElementById('mdToggleBtn').classList.remove('active');
    document.getElementById('htmlToggleBtn').classList.remove('active');
  }
  state.codeCommentMode = !state.codeCommentMode;
  saveLocal('codeCommentMode', state.codeCommentMode);
  const btn = document.getElementById('codeToggleBtn');
  btn.classList.toggle('active', state.codeCommentMode);
  showToast(state.codeCommentMode ? '代码注释翻译已开启' : '代码注释翻译已关闭', 'info');
}

async function handleFavorite() {
  const source = document.getElementById('sourceText').value.trim();
  const result = document.getElementById('resultText').textContent;
  if (!source || !result) {
    showToast('请先完成翻译后再收藏', 'warning');
    return;
  }
  await saveFavorite(source, result, state.sourceLang, state.targetLang, '');
  showToast('已收藏', 'success');
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

function handleShare() {
  const source = document.getElementById('sourceText').value.trim();
  const result = document.getElementById('resultText').textContent;
  if (!result) { showToast('没有可分享的内容', 'warning'); return; }

  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}?text=${encodeURIComponent(result)}&source=${state.sourceLang}&target=${state.targetLang}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('分享链接已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('复制失败', 'error');
  });
}

function handleTTS() {
  const result = document.getElementById('resultText').textContent;
  if (!result) { showToast('没有可朗读的内容', 'warning'); return; }
  if (!('speechSynthesis' in window)) {
    showToast('浏览器不支持语音朗读', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(result);
  const langMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', ru: 'ru-RU', pt: 'pt-BR', it: 'it-IT', ar: 'ar-SA', hi: 'hi-IN', th: 'th-TH', vi: 'vi-VN', id: 'id-ID', nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR', sv: 'sv-SE', da: 'da-DK', fi: 'fi-FI', el: 'el-GR', cs: 'cs-CZ', ro: 'ro-RO', hu: 'hu-HU', uk: 'uk-UA', bg: 'bg-BG' };
  utterance.lang = langMap[state.targetLang] || 'zh-CN';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  showToast('正在朗读...', 'info');
}

async function toggleHistoryPanel() {
  state.historyPanel = !state.historyPanel;
  const panel = document.getElementById('historyPanel');
  panel.classList.toggle('open', state.historyPanel);
  if (state.favoritesPanel) toggleFavoritesPanel();
  if (state.historyPanel) await renderHistory();
}

async function renderHistory() {
  const list = document.getElementById('historyList');
  const history = await getHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="side-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>暂无翻译历史</p></div>';
    return;
  }
  list.innerHTML = history.slice(0, 50).map((h, i) => `
    <div class="side-item" data-id="${h.id}">
      <div class="side-item-main" onclick="historyReuse(${h.id})">
        <div class="side-item-text">${truncate(h.source, 40)}</div>
        <div class="side-item-meta">${LANG_MAP[h.sourceLang]?.name||h.sourceLang} → ${LANG_MAP[h.targetLang]?.name||h.targetLang} · ${formatDate(h.time)}</div>
      </div>
      <button class="side-item-del" onclick="event.stopPropagation();historyDelete(${h.id})" title="删除">×</button>
    </div>
  `).join('');
}

async function historyReuse(id) {
  const history = await getHistory();
  const item = history.find(h => h.id === id);
  if (!item) return;
  document.getElementById('sourceText').value = item.source;
  state.sourceLang = item.sourceLang;
  state.targetLang = item.targetLang;
  document.getElementById('sourceLang').value = item.sourceLang;
  document.getElementById('targetLang').value = item.targetLang;
  updateCharCount('source');
  updateTranslateBtn();
  toggleHistoryPanel();
  handleTranslate();
}

async function historyDelete(id) {
  await dbDelete('history', id);
  renderHistory();
}

async function toggleFavoritesPanel() {
  state.favoritesPanel = !state.favoritesPanel;
  const panel = document.getElementById('favoritesPanel');
  panel.classList.toggle('open', state.favoritesPanel);
  if (state.historyPanel) toggleHistoryPanel();
  if (state.favoritesPanel) await renderFavorites();
}

async function renderFavorites() {
  const list = document.getElementById('favoritesList');
  const favs = await getFavorites();
  if (favs.length === 0) {
    list.innerHTML = '<div class="side-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><p>暂无收藏</p></div>';
    return;
  }
  list.innerHTML = favs.map(f => `
    <div class="side-item" data-id="${f.id}">
      <div class="side-item-main" onclick="favoriteReuse(${f.id})">
        <div class="side-item-text">${truncate(f.source, 40)}</div>
        <div class="side-item-meta">${LANG_MAP[f.sourceLang]?.name||f.sourceLang} → ${LANG_MAP[f.targetLang]?.name||f.targetLang}</div>
      </div>
      <button class="side-item-del" onclick="event.stopPropagation();favoriteDelete(${f.id})" title="取消收藏">×</button>
    </div>
  `).join('');
}

async function favoriteReuse(id) {
  const favs = await getFavorites();
  const item = favs.find(f => f.id === id);
  if (!item) return;
  document.getElementById('sourceText').value = item.source;
  state.sourceLang = item.sourceLang;
  state.targetLang = item.targetLang;
  document.getElementById('sourceLang').value = item.sourceLang;
  document.getElementById('targetLang').value = item.targetLang;
  document.getElementById('resultText').textContent = item.result;
  document.getElementById('resultText').classList.remove('empty');
  updateCharCount('source');
  updateCharCount('result');
  updateTranslateBtn();
  toggleFavoritesPanel();
}

async function favoriteDelete(id) {
  await dbDelete('favorites', id);
  renderFavorites();
}

// 从URL参数加载分享内容
function loadShareContent() {
  const params = new URLSearchParams(window.location.search);
  const text = params.get('text');
  if (text) {
    document.getElementById('sourceText').value = decodeURIComponent(text);
    const source = params.get('source');
    const target = params.get('target');
    if (source) { state.sourceLang = source; document.getElementById('sourceLang').value = source; }
    if (target) { state.targetLang = target; document.getElementById('targetLang').value = target; }
    updateCharCount('source');
    updateTranslateBtn();
    setTimeout(handleTranslate, 300);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  loadShareContent();
  // 初始化按钮状态
  if (state.realtimeMode) document.getElementById('realtimeBtn').classList.add('active');
  if (state.preserveMarkdown) document.getElementById('mdToggleBtn').classList.add('active');
  if (state.preserveHtml) document.getElementById('htmlToggleBtn').classList.add('active');
  if (state.codeCommentMode) document.getElementById('codeToggleBtn').classList.add('active');
});

/**
 * 文字转语音（TTS）页面 JS
 * 调用 TTS API 将文本转换为语音，支持多种音色、语速和音频格式
 */
(function () {
  const textEl = document.getElementById('ttsText');
  const ttsBtn = document.getElementById('ttsBtn');
  const voiceSelect = document.getElementById('voiceSelect');
  const formatSelect = document.getElementById('formatSelect');
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');
  const charCount = document.getElementById('ttsCharCount');
  const placeholder = document.getElementById('ttsPlaceholder');
  const loadingEl = document.getElementById('ttsLoading');
  const playerEl = document.getElementById('ttsPlayer');
  const audioEl = document.getElementById('ttsAudio');
  const downloadBtn = document.getElementById('ttsDownload');
  const resultHint = document.getElementById('ttsResultHint');

  // TTS API 配置
  var TTS_API_URL = 'http://192.168.31.18:5050/v1/audio/speech';
  var TTS_API_KEY = 'Bearer leeq-12311';

  var isGenerating = false;
  var currentBlob = null;

  // 导航栏滚动阴影
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 0);
    }, { passive: true });
  }

  // 主题管理
  var theme = localStorage.getItem('theme') || 'light';
  applyTheme(theme);

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = t === 'light'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    }
  }

  document.getElementById('themeBtn').addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });

  // 语速滑块实时显示
  speedSlider.addEventListener('input', function () {
    var val = parseFloat(speedSlider.value);
    speedValue.textContent = val.toFixed(1) + 'x';
  });

  // 字符计数 & 按钮状态
  textEl.addEventListener('input', function () {
    var len = textEl.value.length;
    charCount.textContent = '输入 ' + len + ' / 5000';
    ttsBtn.disabled = len === 0 || isGenerating;
  });

  // 点击生成按钮
  ttsBtn.addEventListener('click', startTTS);

  // Ctrl+Enter 快捷键
  textEl.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'Enter' && !ttsBtn.disabled) {
      e.preventDefault();
      startTTS();
    }
  });

  // 下载按钮
  downloadBtn.addEventListener('click', function () {
    if (!currentBlob) return;
    var url = URL.createObjectURL(currentBlob);
    var ext = formatSelect.value;
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tts_' + Date.now() + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /**
   * 开始语音合成
   */
  async function startTTS() {
    var text = textEl.value.trim();
    if (!text || isGenerating) return;

    isGenerating = true;
    ttsBtn.disabled = true;
    placeholder.style.display = 'none';
    playerEl.classList.add('hidden');
    resultHint.classList.add('hidden');
    loadingEl.classList.remove('hidden');

    try {
      var res = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': TTS_API_KEY
        },
        body: JSON.stringify({
          input: text,
          voice: voiceSelect.value,
          response_format: formatSelect.value,
          speed: parseFloat(speedSlider.value)
        })
      });

      if (!res.ok) {
        var errText = '';
        try { var errData = await res.json(); errText = errData.message || JSON.stringify(errData); } catch (e) {}
        throw new Error(errText || '语音合成失败 (' + res.status + ')');
      }

      // 获取音频二进制数据
      currentBlob = await res.blob();
      var audioUrl = URL.createObjectURL(currentBlob);

      // 释放之前的 URL（如果存在）
      if (audioEl.dataset.prevUrl) {
        URL.revokeObjectURL(audioEl.dataset.prevUrl);
      }
      audioEl.dataset.prevUrl = audioUrl;

      // 设置音频源并显示播放器
      audioEl.src = audioUrl;
      playerEl.classList.remove('hidden');
      resultHint.classList.remove('hidden');
      resultHint.textContent = '生成完成';

      // 播放音频
      audioEl.play().catch(function () {});
    } catch (err) {
      showToast(err.message || '语音合成失败，请重试', 'error');
      placeholder.style.display = '';
    } finally {
      loadingEl.classList.add('hidden');
      isGenerating = false;
      ttsBtn.disabled = textEl.value.length === 0;
    }
  }
})();
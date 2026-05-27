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
  const previewBtn = document.getElementById('voicePreviewBtn');

  // TTS API 配置 - 通过同源代理避免 Mixed Content 问题
  var TTS_API_URL = '/api/tts';

  var isGenerating = false;
  var currentBlob = null;

  /**
   * 将 base64 字符串解码为 Blob 对象
   */
  function base64ToBlob(base64, contentType) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
  }

  /**
   * 调用 TTS API 并处理 base64 响应，返回 { blob, contentType }
   */
  async function callTTSAPI(body) {
    var res = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      var errText = '';
      try { var errData = await res.json(); errText = errData.message || JSON.stringify(errData); } catch (e) {}
      throw new Error(errText || '请求失败 (' + res.status + ')');
    }

    var json = await res.json();
    if (json.code !== 200) {
      throw new Error(json.message || '语音合成失败');
    }

    return {
      blob: base64ToBlob(json.data.audio, json.data.contentType),
      contentType: json.data.contentType
    };
  }

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

  // 音色试听按钮
  previewBtn.addEventListener('click', previewVoice);

  /**
   * 音色试听 - 用一段示例文字生成语音并播放
   */
  async function previewVoice() {
    var voice = voiceSelect.value;
    var voiceName = voiceSelect.options[voiceSelect.selectedIndex].text;
    var previewText = '你好，我是' + voiceName.split('（')[0] + '，这是我的声音示例。今天天气真好，非常适合出去走走。';

    var isDisabled = previewBtn.disabled;
    if (isDisabled) return;

    previewBtn.disabled = true;
    previewBtn.classList.add('loading');

    try {
      var result = await callTTSAPI({
        input: previewText,
        voice: voice,
        response_format: 'mp3',
        speed: 1
      });

      var audioUrl = URL.createObjectURL(result.blob);

      // 释放之前试听的 URL
      if (audioEl.dataset.prevPreviewUrl) {
        URL.revokeObjectURL(audioEl.dataset.prevPreviewUrl);
      }
      audioEl.dataset.prevPreviewUrl = audioUrl;

      // 显示播放器并播放
      audioEl.src = audioUrl;
      placeholder.style.display = 'none';
      playerEl.classList.remove('hidden');
      resultHint.classList.remove('hidden');
      resultHint.textContent = '音色试听：' + voiceName + '（示例语音，非正式生成结果）';
      audioEl.play().catch(function () {});

    } catch (err) {
      showToast(err.message || '试听失败，请重试', 'error');
    } finally {
      previewBtn.disabled = false;
      previewBtn.classList.remove('loading');
    }
  }

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
      var result = await callTTSAPI({
        input: text,
        voice: voiceSelect.value,
        response_format: formatSelect.value,
        speed: parseFloat(speedSlider.value)
      });

      currentBlob = result.blob;
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
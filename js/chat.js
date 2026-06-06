/**
 * Chat 聊天前端逻辑
 * 侧边栏 + 聊天区布局，支持多轮对话、联网搜索、技能加载、文件上传
 */

// 聊天状态
const chatState = {
  messages: [],           // 当前对话消息列表 [{role, content}]
  isSending: false,       // 是否正在发送消息
  theme: loadLocal('theme', 'light'),
  hasMessages: false,     // 是否已有消息（控制输入框显示模式）
  searchMode: false,      // 是否开启联网搜索
  searchEngine: 'bing',   // 当前搜索引擎
  activeSkill: null,      // 当前选中的技能 {name, prompt}
  skills: [],             // 可用技能列表
  uploadedFileContent: null, // 上传的文件内容
  uploadedFileName: null, // 上传的文件名
  typewriterTimer: null   // 打字机定时器引用（用于中断）
};

// DOM 元素引用
const els = {
  sidebar: document.getElementById('chatSidebar'),
  messages: document.getElementById('chatMessages'),
  welcome: document.getElementById('chatWelcome'),
  loading: document.getElementById('chatLoading'),
  inputLarge: document.getElementById('chatInput'),
  sendBtnLg: document.getElementById('sendBtn'),
  inputBottom: document.getElementById('chatInputBottomEl'),
  inputBottomArea: document.getElementById('chatInputBottom'),
  sendBtnSm: document.getElementById('sendBtnBottom'),
  clearBtn: document.getElementById('clearChatBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  createSkillBtn: document.getElementById('createSkillBtn'),
  themeBtn: document.getElementById('themeBtn'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  historyList: document.getElementById('historyList'),
  toast: document.getElementById('toast'),
  // 欢迎区输入框工具栏
  searchModeBtn: document.getElementById('searchModeBtn'),
  searchEngineSelect: document.getElementById('searchEngineSelect'),
  skillBtn: document.getElementById('skillBtn'),
  skillPanel: document.getElementById('skillPanel'),
  skillPanelList: document.getElementById('skillPanelList'),
  uploadBtn: document.getElementById('uploadBtn'),
  fileInput: document.getElementById('fileInput'),
  uploadFilename: document.getElementById('uploadFilename'),
  charCount: document.getElementById('charCount'),
  // 底部输入框工具栏
  searchModeBtn2: document.getElementById('searchModeBtn2'),
  searchEngineSelect2: document.getElementById('searchEngineSelect2'),
  skillBtn2: document.getElementById('skillBtn2'),
  uploadBtn2: document.getElementById('uploadBtn2'),
  uploadFilename2: document.getElementById('uploadFilename2')
};

/**
 * 初始化聊天页面
 */
function initChat() {
  applyTheme(chatState.theme);
  loadChatHistory();
  loadSkills();
  loadSearchEngines();
  bindEvents();
  updateSendButtons();
}

/**
 * 应用主题
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (els.themeBtn) {
    els.themeBtn.innerHTML = theme === 'light'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.64"/></svg>';
  }
}

/**
 * 加载聊天历史
 */
function loadChatHistory() {
  const saved = loadLocal('chatHistory', []);
  if (saved && saved.length > 0) {
    chatState.messages = saved;
    renderAllMessages();
    switchToMessageMode();
  }
}

/**
 * 保存聊天历史
 */
function saveChatHistory() {
  saveLocal('chatHistory', chatState.messages);
}

/**
 * 加载可用技能列表
 */
async function loadSkills() {
  try {
    const res = await fetch('/api/skill');
    const data = await res.json();
    if (data.code === 200 && Array.isArray(data.data)) {
      chatState.skills = data.data;
      renderSkillPanel();
    }
  } catch (err) {
    console.error('加载技能列表失败:', err);
  }
}

/**
 * 加载已启用的搜索引擎列表（从后台配置获取）
 */
async function loadSearchEngines() {
  try {
    const res = await fetch('/api/admin/search-config');
    const data = await res.json();
    if (data.code === 200 && data.data.enabled) {
      const enabledEngines = data.data.enabled;
      // 同时更新两个搜索引擎选择器
      const selects = [els.searchEngineSelect, els.searchEngineSelect2].filter(Boolean);
      selects.forEach(select => {
        select.innerHTML = '';
        if (enabledEngines.length === 0) {
          select.innerHTML = '<option value="">无可用引擎</option>';
          select.disabled = true;
        } else {
          select.disabled = false;
          enabledEngines.forEach(engine => {
            const option = document.createElement('option');
            option.value = engine.key;
            option.textContent = engine.name;
            select.appendChild(option);
          });
        }
      });
      if (enabledEngines.length > 0) {
        chatState.searchEngine = enabledEngines[0].key;
        selects.forEach(s => { s.value = chatState.searchEngine; });
      }
    }
  } catch (err) {
    console.error('加载搜索引擎配置失败:', err);
  }
}

/**
 * 渲染技能面板
 */
function renderSkillPanel() {
  if (!els.skillPanelList) return;
  if (chatState.skills.length === 0) {
    els.skillPanelList.innerHTML = '<div class="ds-skill-empty">暂无可用技能，请在管理后台添加</div>';
    return;
  }
  els.skillPanelList.innerHTML = chatState.skills.map(skill => `
    <button class="skill-item${chatState.activeSkill?.name === skill.name ? ' selected' : ''}" data-skill-name="${skill.name}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span class="skill-item-name">${skill.name}</span>
      ${skill.description ? `<span class="skill-item-desc">${skill.description}</span>` : ''}
    </button>
  `).join('');

  // 绑定技能点击事件
  els.skillPanelList.querySelectorAll('.skill-item').forEach(item => {
    item.addEventListener('click', () => {
      const skillName = item.dataset.skillName;
      const skill = chatState.skills.find(s => s.name === skillName);
      if (skill) {
        if (chatState.activeSkill?.name === skill.name) {
          // 取消选择
          chatState.activeSkill = null;
        } else {
          // 选择技能
          chatState.activeSkill = skill;
        }
        renderSkillPanel();
        updatePlaceholder();
        showToast(chatState.activeSkill ? `已选择技能: ${skill.name}` : '已取消技能选择', 'info');
      }
    });
  });
}

/**
 * 更新输入框占位符
 */
function updatePlaceholder() {
  const placeholder = chatState.activeSkill
    ? `使用技能「${chatState.activeSkill.name}」- 输入你的问题...`
    : chatState.searchMode
      ? `联网搜索 - 输入搜索关键词...`
      : '输入你的问题...';
  els.inputLarge.placeholder = placeholder;
  els.inputBottom.placeholder = placeholder + ' (Enter 发送)';
}

/**
 * 绑定事件
 */
function bindEvents() {
  // --- 发送按钮 ---
  els.sendBtnLg.addEventListener('click', () => handleSend());
  els.sendBtnSm.addEventListener('click', () => handleSend());

  // --- 居中输入框 ---
  els.inputLarge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  els.inputLarge.addEventListener('input', () => {
    updateSendButtons();
    autoResizeInput(els.inputLarge, 220);
    updateCharCount();
  });

  // --- 底部输入框 ---
  els.inputBottom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  els.inputBottom.addEventListener('input', () => {
    updateSendButtons();
    autoResizeInput(els.inputBottom, 120);
  });

  // --- 搜索模式切换（欢迎区和底部区同步） ---
  els.searchModeBtn.addEventListener('click', toggleSearchMode);
  if (els.searchModeBtn2) els.searchModeBtn2.addEventListener('click', toggleSearchMode);
  els.searchEngineSelect.addEventListener('change', (e) => {
    chatState.searchEngine = e.target.value;
    if (els.searchEngineSelect2) els.searchEngineSelect2.value = e.target.value;
    updatePlaceholder();
  });
  if (els.searchEngineSelect2) {
    els.searchEngineSelect2.addEventListener('change', (e) => {
      chatState.searchEngine = e.target.value;
      els.searchEngineSelect.value = e.target.value;
      updatePlaceholder();
    });
  }

  // --- 技能面板（欢迎区和底部区同步） ---
  els.skillBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.skillPanel.style.display = els.skillPanel.style.display === 'none' ? 'block' : 'none';
  });
  if (els.skillBtn2) {
    els.skillBtn2.addEventListener('click', (e) => {
      e.stopPropagation();
      els.skillPanel.style.display = els.skillPanel.style.display === 'none' ? 'block' : 'none';
    });
  }
  document.addEventListener('click', (e) => {
    if (!els.skillPanel.contains(e.target) && e.target !== els.skillBtn && e.target !== els.skillBtn2) {
      els.skillPanel.style.display = 'none';
    }
  });

  // --- 文件上传（欢迎区和底部区同步） ---
  els.uploadBtn.addEventListener('click', () => els.fileInput.click());
  if (els.uploadBtn2) els.uploadBtn2.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', handleFileUpload);

  // --- 侧边栏操作 ---
  els.sidebarToggle.addEventListener('click', toggleSidebar);
  els.newChatBtn.addEventListener('click', handleNewChat);
  els.clearBtn.addEventListener('click', handleClear);
  els.createSkillBtn.addEventListener('click', () => {
    showToast('请在管理后台「技能管理」中添加技能', 'info');
  });

  // --- 主题切换 ---
  els.themeBtn.addEventListener('click', toggleTheme);

  // --- 移动端遮罩层 ---
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      const overlay = document.querySelector('.mobile-overlay');
      if (overlay?.classList.contains('show') && !els.sidebar.contains(e.target)) {
        closeMobileSidebar();
      }
    }
  });
}

/**
 * 自动调整输入框高度
 */
function autoResizeInput(el, maxHeight) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
}

/**
 * 获取当前活跃的输入框元素
 */
function getActiveInput() {
  return chatState.hasMessages ? els.inputBottom : els.inputLarge;
}

/**
 * 更新发送按钮状态
 */
function updateSendButtons() {
  const text = getActiveInput().value.trim();
  const disabled = !text || chatState.isSending;
  els.sendBtnLg.disabled = disabled;
  els.sendBtnSm.disabled = disabled;
}

/**
 * 更新字符计数
 */
function updateCharCount() {
  if (els.charCount) {
    const len = els.inputLarge.value.length;
    els.charCount.textContent = `${len} / 5000`;
  }
}

/**
 * 切换搜索模式
 */
function toggleSearchMode() {
  chatState.searchMode = !chatState.searchMode;
  if (chatState.searchMode) {
    els.searchModeBtn.classList.add('search-active');
    if (els.searchModeBtn2) els.searchModeBtn2.classList.add('search-active');
    els.searchEngineSelect.style.display = '';
    if (els.searchEngineSelect2) els.searchEngineSelect2.style.display = '';
    chatState.activeSkill = null;
    els.skillPanel.style.display = 'none';
    renderSkillPanel();
  } else {
    els.searchModeBtn.classList.remove('search-active');
    if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
    els.searchEngineSelect.style.display = 'none';
    if (els.searchEngineSelect2) els.searchEngineSelect2.style.display = 'none';
  }
  updatePlaceholder();
}

/**
 * 切换主题
 */
function toggleTheme() {
  chatState.theme = chatState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(chatState.theme);
  saveLocal('theme', chatState.theme);
}

/**
 * 折叠/展开侧边栏
 */
function toggleSidebar() {
  els.sidebar.classList.toggle('collapsed');
}

/**
 * 移动端打开侧边栏
 */
function openMobileSidebar() {
  els.sidebar.classList.add('open');
  let overlay = document.querySelector('.mobile-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mobile-overlay show';
    document.body.appendChild(overlay);
  } else {
    overlay.classList.add('show');
  }
}

/**
 * 移动端关闭侧边栏
 */
function closeMobileSidebar() {
  els.sidebar.classList.remove('open');
  const overlay = document.querySelector('.mobile-overlay');
  if (overlay) overlay.classList.remove('show');
}

/**
 * 新建对话
 */
function handleNewChat() {
  // 中断正在运行的打字机效果
  stopTypewriter();
  chatState.messages = [];
  chatState.searchMode = false;
  chatState.activeSkill = null;
  chatState.uploadedFileContent = null;
  chatState.uploadedFileName = null;
  els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  els.searchEngineSelect.style.display = 'none';
  if (els.searchEngineSelect2) els.searchEngineSelect2.style.display = 'none';
  els.uploadFilename.style.display = 'none';
  els.uploadFilename.textContent = '';
  if (els.uploadFilename2) { els.uploadFilename2.style.display = 'none'; els.uploadFilename2.textContent = ''; }
  saveChatHistory();
  switchToWelcomeMode();
  updatePlaceholder();
  showToast('已开始新对话', 'info');
  if (window.innerWidth <= 768) closeMobileSidebar();
}

/**
 * 清空历史
 */
function handleClear() {
  if (chatState.messages.length === 0) return;
  // 中断正在运行的打字机效果
  stopTypewriter();
  chatState.messages = [];
  chatState.searchMode = false;
  chatState.activeSkill = null;
  chatState.uploadedFileContent = null;
  chatState.uploadedFileName = null;
  els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  els.searchEngineSelect.style.display = 'none';
  if (els.searchEngineSelect2) els.searchEngineSelect2.style.display = 'none';
  els.uploadFilename.style.display = 'none';
  els.uploadFilename.textContent = '';
  if (els.uploadFilename2) { els.uploadFilename2.style.display = 'none'; els.uploadFilename2.textContent = ''; }
  saveChatHistory();
  switchToWelcomeMode();
  updatePlaceholder();
  showToast('对话已清空', 'info');
}

/**
 * 切换到欢迎模式（空状态）
 */
function switchToWelcomeMode() {
  chatState.hasMessages = false;
  els.welcome.style.display = '';
  els.inputBottomArea.style.display = 'none';
  els.messages.querySelectorAll('.chat-message').forEach(el => el.remove());
  els.inputLarge.value = '';
  els.inputBottom.value = '';
  els.inputLarge.style.height = 'auto';
  els.inputBottom.style.height = 'auto';
  updateSendButtons();
}

/**
 * 切换到消息模式
 */
function switchToMessageMode() {
  chatState.hasMessages = true;
  els.welcome.style.display = 'none';
  els.inputBottomArea.style.display = '';
  updateSendButtons();
}

/**
 * 处理文件上传
 */
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const ext = '.' + file.name.toLowerCase().split('.').pop();
  const supportedExts = ['.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.log',
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.rs', '.go', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte',
    '.html', '.css', '.scss', '.less', '.env', '.cfg', '.ini', '.conf', '.sh', '.bat', '.ps1', '.sql'];

  if (!supportedExts.includes(ext)) {
    showToast(`不支持的文件类型: ${ext}`, 'error');
    els.fileInput.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('文件过大，最大支持 5MB', 'error');
    els.fileInput.value = '';
    return;
  }

  try {
    const text = await file.text();
    if (!text.trim()) {
      showToast('文件内容为空', 'error');
      els.fileInput.value = '';
      return;
    }
    chatState.uploadedFileContent = text;
    chatState.uploadedFileName = file.name;
    els.uploadFilename.textContent = file.name;
    els.uploadFilename.style.display = '';
    if (els.uploadFilename2) { els.uploadFilename2.textContent = file.name; els.uploadFilename2.style.display = ''; }
    showToast(`已加载文件: ${file.name} (${text.length} 字符)`, 'success');
  } catch (err) {
    showToast('文件读取失败: ' + err.message, 'error');
  }
  els.fileInput.value = '';
}

/**
 * 处理发送消息
 */
async function handleSend() {
  const activeInput = getActiveInput();
  const text = activeInput.value.trim();
  if (!text || chatState.isSending) return;

  if (text.length > 5000) {
    showToast('消息超过5000字符限制', 'error');
    return;
  }

  if (!chatState.hasMessages) {
    switchToMessageMode();
  }

  // 构建用户消息内容
  let userContent = text;

  // 如果有上传文件，附加上传内容
  if (chatState.uploadedFileContent) {
    userContent = `【上传文件: ${chatState.uploadedFileName}】\n\n${chatState.uploadedFileContent}\n\n---\n【用户问题】\n${text}`;
    // 清空上传状态
    chatState.uploadedFileContent = null;
    chatState.uploadedFileName = null;
    els.uploadFilename.style.display = 'none';
    els.uploadFilename.textContent = '';
    if (els.uploadFilename2) { els.uploadFilename2.style.display = 'none'; els.uploadFilename2.textContent = ''; }
  }

  // 添加用户消息（先中断可能正在运行的打字机）
  stopTypewriter();
  const displayContent = chatState.searchMode
    ? `[${chatState.searchEngine}搜索] ${text}`
    : userContent;
  addMessage('user', displayContent);

  // 清空输入框
  els.inputLarge.value = '';
  els.inputBottom.value = '';
  els.inputLarge.style.height = 'auto';
  els.inputBottom.style.height = 'auto';
  updateSendButtons();

  // 发送请求
  chatState.isSending = true;
  updateSendButtons();
  showLoading(true);

  try {
    let reply;
    if (chatState.searchMode) {
      // 搜索模式：将文件内容也传递给搜索接口（用于上下文补充）
      const searchPayload = {
        query: text,
        engine: chatState.searchEngine
      };
      // 如果有上传文件，附加文件内容供 LLM 提纯时参考
      if (chatState.uploadedFileContent) {
        searchPayload.fileContext = `【参考文件: ${chatState.uploadedFileName}】\n${chatState.uploadedFileContent}`;
        // 清空上传状态（与普通聊天一致）
        chatState.uploadedFileContent = null;
        chatState.uploadedFileName = null;
        els.uploadFilename.style.display = 'none';
        els.uploadFilename.textContent = '';
        if (els.uploadFilename2) { els.uploadFilename2.style.display = 'none'; els.uploadFilename2.textContent = ''; }
      }
      // 如果有激活的技能，传递技能提示词（搜索模式下也生效）
      if (chatState.activeSkill?.prompt) {
        searchPayload.skillPrompt = chatState.activeSkill.prompt;
      }
      reply = await sendSearchRequest(searchPayload);
      // 搜索完成后关闭搜索模式
      chatState.searchMode = false;
      els.searchModeBtn.classList.remove('search-active');
      if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
      els.searchEngineSelect.style.display = 'none';
      if (els.searchEngineSelect2) els.searchEngineSelect2.style.display = 'none';
      updatePlaceholder();
    } else {
      reply = await sendChatRequest(userContent);
    }
    // 使用打字机效果显示 AI 回复（逐字显示）
    await typewriterEffect(reply, 18);
  } catch (err) {
    showToast('发送失败: ' + err.message, 'error');
  } finally {
    chatState.isSending = false;
    showLoading(false);
    updateSendButtons();
  }
}

/**
 * 发送聊天请求
 */
async function sendChatRequest(userContent) {
  const requestMessages = [];

  // 如果有激活的技能，添加技能提示词
  if (chatState.activeSkill?.prompt) {
    requestMessages.push({
      role: 'system',
      content: chatState.activeSkill.prompt
    });
  }

  requestMessages.push(...chatState.messages.map(({ role, content }) => ({ role, content })));

  const data = await api('/api/chat', {
    method: 'POST',
    body: { messages: requestMessages }
  });

  return data.content;
}

/**
 * 发送搜索请求（完整流水线：真实搜索→清洗→LLM提纯）
 * @param {Object|string} payload - 搜索参数（支持字符串或对象格式）
 */
async function sendSearchRequest(payload) {
  // 兼容新旧两种调用方式
  const query = typeof payload === 'string' ? payload : payload.query;
  const engine = typeof payload === 'string' ? undefined : payload.engine;
  const fileContext = typeof payload === 'object' ? payload.fileContext : undefined;

  const data = await api('/api/search', {
    method: 'POST',
    body: {
      query: query,
      engine: engine || chatState.searchEngine,
      ...(fileContext ? { fileContext } : {}),
      ...(payload.skillPrompt ? { skillPrompt: payload.skillPrompt } : {})
    }
  });

  // 新版 API 返回 answer 字段（LLM 提纯后的最终答案）
  if (data.answer) {
    // 构建带来源信息的完整回答
    let reply = data.answer;

    // 如果有来源信息，附加来源列表
    if (data.sources && data.sources.length > 0 && data.pipeline === 'real-search') {
      const sourceLinks = data.sources.map((s, i) =>
        `${i + 1}. [${s.title}](${s.url || '#'})${s.snippet ? ` - ${s.snippet.slice(0, 60)}` : ''}`
      ).join('\n');
      reply += `\n\n---\n**来源 (${data.sourceCount} 条结果来自 ${data.engine})：**\n\n${sourceLinks}`;
    }

    // 标记是否为降级模式
    if (data.pipeline === 'ai-fallback') {
      reply += '\n\n> ⚠️ 无法连接到真实搜索引擎，以上答案由 AI 基于知识库生成，建议确认关键信息。';
    }

    return reply;
  }

  // 兼容旧格式
  return data.summary || data.content || JSON.stringify(data);
}

/**
 * 打字机效果：逐字显示 AI 回复
 * @param {string} fullText - 完整回复文本
 * @param {number} speed - 每字间隔毫秒（默认 20ms）
 */
function typewriterEffect(fullText, speed = 20) {
  // 先创建 AI 消息气泡（空内容，带打字光标）
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message assistant';

  // 头像
  const avatarEl = document.createElement('div');
  avatarEl.className = 'chat-avatar';
  avatarEl.textContent = 'AI';

  // 气泡（带打字光标）
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-bubble chat-bubble-typing';
  bubbleEl.innerHTML = '<span class="typewriter-cursor"></span>';

  msgEl.appendChild(avatarEl);
  msgEl.appendChild(bubbleEl);
  els.messages.insertBefore(msgEl, els.loading);
  scrollToBottom();

  // 如果已有打字机在运行，先中断
  if (chatState.typewriterTimer) {
    clearInterval(chatState.typewriterTimer);
    chatState.typewriterTimer = null;
  }

  let charIndex = 0;

  return new Promise((resolve) => {
    chatState.typewriterTimer = setInterval(() => {
      if (charIndex < fullText.length) {
        // 每次追加一个字符到光标前
        const cursor = bubbleEl.querySelector('.typewriter-cursor');
        if (cursor) {
          const textNode = document.createTextNode(fullText[charIndex]);
          bubbleEl.insertBefore(textNode, cursor);
        }
        charIndex++;
        scrollToBottom(); // 实时滚动到底部
      } else {
        // 打字完成：清除定时器、移除光标、保存消息
        clearInterval(chatState.typewriterTimer);
        chatState.typewriterTimer = null;
        bubbleEl.classList.remove('chat-bubble-typing');
        const cursor = bubbleEl.querySelector('.typewriter-cursor');
        if (cursor) cursor.remove();
        // 将完整内容保存到历史记录
        chatState.messages.push({ role: 'assistant', content: fullText });
        saveChatHistory();
        resolve();
      }
    }, speed);
  });
}

/**
 * 中断当前打字机效果（用户发新消息时调用）
 */
function stopTypewriter() {
  if (chatState.typewriterTimer) {
    clearInterval(chatState.typewriterTimer);
    chatState.typewriterTimer = null;
    // 找到正在打字的气泡，移除光标样式
    const typingBubble = els.messages.querySelector('.chat-bubble-typing');
    if (typingBubble) {
      typingBubble.classList.remove('chat-bubble-typing');
      const cursor = typingBubble.querySelector('.typewriter-cursor');
      if (cursor) cursor.remove();
    }
  }
}

/**
 * 添加消息
 */
function addMessage(role, content) {
  chatState.messages.push({ role, content });
  saveChatHistory();
  renderMessage(role, content);
  scrollToBottom();
}

/**
 * 渲染所有消息
 */
function renderAllMessages() {
  els.messages.querySelectorAll('.chat-message').forEach(el => el.remove());
  chatState.messages.forEach(msg => renderMessage(msg.role, msg.content));
  scrollToBottom();
}

/**
 * 渲染单条消息
 */
function renderMessage(role, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `chat-message ${role}`;

  // 头像
  const avatarEl = document.createElement('div');
  avatarEl.className = 'chat-avatar';
  if (role === 'user') {
    avatarEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  } else {
    avatarEl.textContent = 'AI';
  }

  // 气泡
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-bubble';
  bubbleEl.textContent = content;

  msgEl.appendChild(avatarEl);
  msgEl.appendChild(bubbleEl);
  els.messages.insertBefore(msgEl, els.loading);
}

/**
 * 显示/隐藏加载指示器
 */
function showLoading(show) {
  els.loading.style.display = show ? 'flex' : 'none';
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
  requestAnimationFrame(() => {
    els.messages.scrollTop = els.messages.scrollHeight;
  });
}

/**
 * Toast 提示
 */
function showToast(message, type = 'info') {
  const toast = els.toast;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initChat);
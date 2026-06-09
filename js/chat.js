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
  uploadedFileSize: null, // 上传的文件大小（格式化后）
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
  uploadFilename2: document.getElementById('uploadFilename2'),
  // 移动端汉堡菜单
  mobileMenuBtn: document.getElementById('mobileMenuBtn')
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

  // 初始化 Mermaid 图表库配置（启用错误抑制，避免显示炸弹图标）
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: chatState.theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
      // 抑制默认的错误渲染（炸弹图标），改为抛出异常让我们自行处理
      suppressErrorRendering: true
    });
  }
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
    if (els.skillPanel.style.getPropertyValue('display') === 'none' || els.skillPanel.style.display === 'none') {
      els.skillPanel.style.setProperty('display', 'block');
      els.skillPanel.classList.remove('is-hidden');
    } else {
      els.skillPanel.style.setProperty('display', 'none');
      els.skillPanel.classList.add('is-hidden');
    }
  });
  if (els.skillBtn2) {
    els.skillBtn2.addEventListener('click', (e) => {
      e.stopPropagation();
      if (els.skillPanel.style.getPropertyValue('display') === 'none' || els.skillPanel.style.display === 'none') {
        els.skillPanel.style.setProperty('display', 'block');
        els.skillPanel.classList.remove('is-hidden');
      } else {
        els.skillPanel.style.setProperty('display', 'none');
        els.skillPanel.classList.add('is-hidden');
      }
    });
  }
  document.addEventListener('click', (e) => {
    if (!els.skillPanel.contains(e.target) && e.target !== els.skillBtn && e.target !== els.skillBtn2) {
      els.skillPanel.style.setProperty('display', 'none');
      els.skillPanel.classList.add('is-hidden');
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

  // --- 移动端汉堡菜单 ---
  if (els.mobileMenuBtn) {
    els.mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMobileSidebar();
    });
  }

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
 * 切换搜索模式（不显示下拉框，自动使用后台配置的搜索引擎）
 */
function toggleSearchMode() {
  chatState.searchMode = !chatState.searchMode;
  if (chatState.searchMode) {
    els.searchModeBtn.classList.add('search-active');
    if (els.searchModeBtn2) els.searchModeBtn2.classList.add('search-active');
    // 不再显示下拉框，直接使用后台配置的默认引擎
    chatState.activeSkill = null;
    els.skillPanel.style.display = 'none';
    renderSkillPanel();
  } else {
    els.searchModeBtn.classList.remove('search-active');
    if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
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
  chatState.uploadedFileSize = null;
  els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  els.uploadFilename.classList.add('is-hidden');
  els.uploadFilename.style.setProperty('display', 'none');
  els.uploadFilename.textContent = '';
  if (els.uploadFilename2) { els.uploadFilename2.classList.add('is-hidden'); els.uploadFilename2.style.setProperty('display', 'none'); els.uploadFilename2.textContent = ''; }
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
  chatState.uploadedFileSize = null;
  els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  els.uploadFilename.classList.add('is-hidden');
  els.uploadFilename.style.setProperty('display', 'none');
  els.uploadFilename.textContent = '';
  if (els.uploadFilename2) { els.uploadFilename2.classList.add('is-hidden'); els.uploadFilename2.style.setProperty('display', 'none'); els.uploadFilename2.textContent = ''; }
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
  els.welcome.classList.remove('is-hidden');
  els.welcome.style.setProperty('display', '');
  els.inputBottomArea.classList.add('is-hidden');
  els.inputBottomArea.style.setProperty('display', 'none');
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
  els.welcome.classList.add('is-hidden');
  els.welcome.style.setProperty('display', 'none');
  els.inputBottomArea.classList.remove('is-hidden');
  els.inputBottomArea.style.setProperty('display', '');
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
    chatState.uploadedFileSize = formatFileSize(file.size);
    els.uploadFilename.textContent = file.name;
    els.uploadFilename.classList.remove('is-hidden');
    els.uploadFilename.style.setProperty('display', '');
    if (els.uploadFilename2) { els.uploadFilename2.textContent = file.name; els.uploadFilename2.classList.remove('is-hidden'); els.uploadFilename2.style.setProperty('display', ''); }
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

  // 如果有上传文件，先渲染文件卡片到消息区（独立于气泡）
  if (chatState.uploadedFileContent) {
    const fileCard = buildFileCard(chatState.uploadedFileName, chatState.uploadedFileSize || '');
    els.messages.appendChild(fileCard);

    // 用户消息只显示问题文本，不含文件内容（文件已通过卡片展示）
    userContent = text;

    // 清除文件名显示（保留内容供API调用）
    els.uploadFilename.classList.add('is-hidden');
    els.uploadFilename.style.setProperty('display', 'none');
    els.uploadFilename.textContent = '';
    if (els.uploadFilename2) { els.uploadFilename2.classList.add('is-hidden'); els.uploadFilename2.style.setProperty('display', 'none'); els.uploadFilename2.textContent = ''; }
  }

  // 添加用户消息（先中断可能正在运行的打字机）
  stopTypewriter();
  const displayContent = userContent;

  // 构建消息元数据（含文件信息，用于历史恢复时渲染文件卡片）
  const msgMeta = { role: 'user', content: displayContent };
  if (chatState.uploadedFileContent) {
    msgMeta.fileName = chatState.uploadedFileName;
    msgMeta.fileSize = chatState.uploadedFileSize;
  }
  chatState.messages.push(msgMeta);
  saveChatHistory();

  // 渲染用户消息（有文件时先渲染卡片）
  if (chatState.uploadedFileContent) {
    const fileCard = buildFileCard(chatState.uploadedFileName, chatState.uploadedFileSize || '');
    els.messages.appendChild(fileCard);
  }
  renderMessage('user', displayContent);
  scrollToBottom();

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
  chatState.uploadedFileSize = null;
  els.uploadFilename.classList.add('is-hidden');
  els.uploadFilename.style.setProperty('display', 'none');
  els.uploadFilename.textContent = '';
  if (els.uploadFilename2) { els.uploadFilename2.classList.add('is-hidden'); els.uploadFilename2.style.setProperty('display', 'none'); els.uploadFilename2.textContent = ''; }
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
    // 返回结构化数据（答案 + 来源信息分开），供打字机和渲染使用
    return {
      text: data.answer,
      sources: data.sources || [],
      sourceCount: data.sourceCount || 0,
      engine: data.engine || '',
      pipeline: data.pipeline || ''
    };
  }

  // 兼容旧格式
  return data.summary || data.content || JSON.stringify(data);
}

/**
 * 打字机效果（实时 Markdown 渲染）
 * 边打字边渲染：每累积一定字符或遇到换行/空格时，用 marked.parse 重新渲染
 * @param {string|Object} replyData - 纯文本或结构化数据 {text, sources, sourceCount, engine, pipeline}
 * @param {number} speed - 每字间隔毫秒（默认 18ms）
 */
function typewriterEffect(replyData, speed = 18) {
  // 兼容纯文本和结构化对象
  const fullText = typeof replyData === 'string' ? replyData : (replyData.text || '');
  const sources = typeof replyData === 'object' ? (replyData.sources || []) : [];
  const sourceCount = typeof replyData === 'object' ? (replyData.sourceCount || 0) : 0;
  const engineName = typeof replyData === 'object' ? (replyData.engine || '') : '';
  const pipeline = typeof replyData === 'object' ? (replyData.pipeline || '') : '';

  // 创建 AI 消息气泡（无头像）
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message assistant';

  // 气泡容器
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-bubble chat-bubble-typing';
  bubbleEl.innerHTML = '<span class="typewriter-cursor"></span>';

  msgEl.appendChild(bubbleEl);
  els.messages.insertBefore(msgEl, els.loading);
  scrollToBottom();

  // 中断已有打字机
  if (chatState.typewriterTimer) {
    clearInterval(chatState.typewriterTimer);
    chatState.typewriterTimer = null;
  }

  let charIndex = 0;
  let lastRenderIndex = 0; // 上次渲染到的位置

  /**
   * 增量渲染：将已累积的文本通过 marked 解析为 HTML 写入气泡
   * 保留光标位置，避免闪烁
   */
  function flushRender() {
    if (charIndex <= lastRenderIndex) return;

    const accumulated = fullText.substring(0, charIndex);

    if (typeof window.marked !== 'undefined') {
      try {
        const htmlContent = window.marked.parse(accumulated);
        // 追加光标
        bubbleEl.innerHTML = htmlContent + '<span class="typewriter-cursor"></span>';
      } catch (e) {
        bubbleEl.innerHTML = escapeHtml(accumulated).replace(/\n/g, '<br>') + '<span class="typewriter-cursor"></span>';
      }
    } else {
      bubbleEl.innerHTML = escapeHtml(accumulated).replace(/\n/g, '<br>') + '<span class="typewriter-cursor"></span>';
    }

    lastRenderIndex = charIndex;
    scrollToBottom();
  }

  return new Promise((resolve) => {
    chatState.typewriterTimer = setInterval(() => {
      if (charIndex < fullText.length) {
        charIndex++;

        // 触发条件：遇到换行、空格、或每隔 N 个字符刷新一次
        const currentChar = fullText[charIndex - 1];
        const shouldFlush = currentChar === '\n'
          || currentChar === ' '
          || currentChar === '>'
          || currentChar === '`'
          || currentChar === '*'
          || currentChar === '#'
          || currentChar === '|'
          || currentChar === '-'
          || (charIndex - lastRenderIndex >= 8); // 至多每8字符刷一次

        if (shouldFlush) {
          flushRender();
        }
      } else {
        // ====== 打字完成：最终渲染 ======
        clearInterval(chatState.typewriterTimer);
        chatState.typewriterTimer = null;
        bubbleEl.classList.remove('chat-bubble-typing');

        // 最终完整 Markdown 渲染
        let htmlContent = '';
        if (typeof window.marked !== 'undefined') {
          try {
            htmlContent = window.marked.parse(fullText);
          } catch (e) {
            htmlContent = escapeHtml(fullText).replace(/\n/g, '<br>');
          }
        } else {
          htmlContent = escapeHtml(fullText).replace(/\n/g, '<br>');
        }
        bubbleEl.innerHTML = htmlContent;

        // 渲染代码高亮（如果有 highlight.js）
        if (typeof hljs !== 'undefined') {
          bubbleEl.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
          });
        }

        // 渲染 Mermaid 图表（使用 Promise 链，避免 setInterval 回调中的 await）
        if (typeof mermaid !== 'undefined') {
          const mermaidBlocks = bubbleEl.querySelectorAll('.language-mermaid');
          const renderPromises = [];
          mermaidBlocks.forEach((el) => {
            const code = el.textContent.trim();
            const p = mermaid.parse(code).then(() => {
              el.outerHTML = `<div class="mermaid">${code}</div>`;
            }).catch((parseErr) => {
              console.group('Mermaid 渲染失败');
              console.warn('错误信息:', parseErr.message);
              console.warn('原始代码:\n', code);
              console.groupEnd();
              el.outerHTML = `<pre><code class="language-mermaid">${escapeHtml(code)}</code></pre>`;
            });
            renderPromises.push(p);
          });
          // 所有验证完成后统一渲染
          Promise.all(renderPromises).then(() => {
            if (bubbleEl.querySelector('.mermaid')) {
              mermaid.init(undefined, bubbleEl).catch((e) => {
                console.warn('Mermaid init 异常:', e.message);
              });
            }
          });
        }

        // ====== 添加引用源区域（logo + 跳转链接）======
        if (sources.length > 0 && pipeline === 'real-search') {
          const sourceFooter = buildSourceFooter(sources, sourceCount, engineName);
          bubbleEl.appendChild(sourceFooter);
        }

        // 降级模式提示
        if (pipeline === 'ai-fallback') {
          const warnEl = document.createElement('div');
          warnEl.className = 'ai-fallback-hint';
          warnEl.textContent = '无法连接到真实搜索引擎，以上答案由 AI 基于知识库生成';
          bubbleEl.appendChild(warnEl);
        }

        // ====== 添加复制按钮（气泡外）======
        const copyBtn = buildCopyButton(fullText);
        msgEl.appendChild(copyBtn);

        // 保存到历史记录
        chatState.messages.push({ role: 'assistant', content: fullText });
        saveChatHistory();
        resolve();
      }
    }, speed);
  });
}

/**
 * HTML 转义（防止 XSS）
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0);
  return `${size} ${units[i]}`;
}

/**
 * 构建引用源区域：已阅读 N 个网页 + 搜索引擎图标 + 来源列表
 */
function buildSourceFooter(sources, count, engineName) {
  const footer = document.createElement('div');
  footer.className = 'source-footer';

  // 头部：搜索图标 + "已阅读 N 个网页" + 搜索引擎图标
  const header = document.createElement('div');
  header.className = 'source-header';

  const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  header.innerHTML = `
    <span class="source-header-icon">${searchIcon}</span>
    <span>已阅读 ${count} 个网页</span>
    <span class="source-header-engines">${getEngineIcons(engineName)}</span>
  `;
  footer.appendChild(header);

  // 来源列表
  const list = document.createElement('div');
  list.className = 'source-list';

  sources.forEach((s, i) => {
    const item = document.createElement('a');
    item.className = 'source-item';
    item.href = s.url || '#';
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.title = s.snippet ? `${s.title}\n${s.snippet}` : s.title;

    const domainIcon = getDomainIcon(s.url || '');
    item.innerHTML = `
      <span class="source-icon">${domainIcon}</span>
      <span class="source-title">${escapeHtml(s.title)}</span>
    `;
    list.appendChild(item);
  });

  if (sources.length > 0) {
    footer.appendChild(list);
  }

  return footer;
}

/**
 * 根据搜索引擎名称返回对应图标HTML
 */
function getEngineIcons(engineName) {
  const name = (engineName || '').toLowerCase();
  let icons = '';

  if (name.includes('bing')) {
    icons += '<svg viewBox="0 0 24 24" width="18" height="18"><rect width="24" height="24" rx="4" fill="#008373"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold">B</text></svg>';
  }
  if (name.includes('baidu') || name.includes('百度')) {
    icons += '<svg viewBox="0 0 24 24" width="18" height="18"><rect width="24" height="24" rx="4" fill="#2932E1"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold">du</text></svg>';
  }
  if (name.includes('google') || name.includes('谷歌')) {
    icons += '<svg viewBox="0 0 24 24" width="18" height="18"><rect width="24" height="24" rx="4" fill="#4285F4"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="10" font-weight="bold">G</text></svg>';
  }
  if (!icons) {
    // 默认图标
    icons = '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#E8EAED"/><text x="12" y="16" text-anchor="middle" fill="#5C6470" font-size="10">?</text></svg>';
  }

  return icons;
}

/**
 * 获取域名图标（根据 URL 返回对应搜索引擎/网站 SVG 图标）
 */

/**
 * 根据域名返回对应的 SVG 图标
 */
function getDomainIcon(url) {
  if (!url) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"/></svg>';
  const domain = url.toLowerCase();
  if (domain.includes('bing.com')) return '<svg viewBox="0 0 24 24" fill="#00809d"><path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm7 16a6 6 0 100-12 6 6 0 000 12zm0-2a4 4 0 110-8 4 4 0 010 8z"/></svg>';
  if (domain.includes('baidu.com')) return '<svg viewBox="0 0 24 24" fill="#2932e1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
  if (domain.includes('sogou.com')) return '<svg viewBox="0 0 24 24" fill="#ff8000"><path d="M12 2L2 22h20L12 2zm0 4l6 12H6l6-12z"/></svg>';
  if (domain.includes('yandex')) return '<svg viewBox="0 0 24 24" fill="#fc3f1d"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15v-2h4v2h-4zm0-4V9h4v4h-4z"/></svg>';
  if (domain.includes('google')) return '<svg viewBox="0 0 24 24" fill="#4285F4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';
  if (domain.includes('wikipedia') || domain.includes('wiki')) return '<svg viewBox="0 0 24 24" fill="#333"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9.5 17l-2-6h-2l3-7 3 7h-2zm5 0l2-6h2l-3-7-3 7h2z"/></svg>';
  // 默认链接图标
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
}

/**
 * 构建复制按钮
 */
function buildCopyButton(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'copy-wrapper';

  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.title = '复制内容';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('copied');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
      }, 2000);
    } catch (e) {
      showToast('复制失败', 'error');
    }
  });

  wrapper.appendChild(btn);
  return wrapper;
}

/**
 * 构建文件附件卡片（独立于气泡外，右对齐）
 */
function buildFileCard(fileName, fileSize) {
  const card = document.createElement('div');
  card.className = 'chat-file-card';

  // 文件图标（根据扩展名选图标）
  let iconSvg = '';
  const ext = fileName.split('.').pop().toLowerCase();
  if (['md', 'txt', 'csv', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  } else if (['pdf'].includes(ext)) {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/></svg>';
  } else {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  }

  card.innerHTML = `
    <div class="chat-file-card-icon">${iconSvg}</div>
    <div class="chat-file-card-info">
      <div class="chat-file-card-name">${escapeHtml(fileName)}</div>
      <div class="chat-file-card-size">${fileSize || ''}</div>
    </div>
  `;

  return card;
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
  // 移除文件卡片（非 .chat-message 元素）
  els.messages.querySelectorAll('.chat-file-card').forEach(el => el.remove());
  chatState.messages.forEach(msg => {
    // 历史消息中有文件信息时，先渲染文件卡片
    if (msg.role === 'user' && msg.fileName) {
      const fileCard = buildFileCard(msg.fileName, msg.fileSize || '');
      els.messages.appendChild(fileCard);
    }
    renderMessage(msg.role, msg.content);
  });
  scrollToBottom();
}

/**
 * 渲染单条消息（历史消息加载时使用，支持 Markdown 渲染）
 */
function renderMessage(role, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `chat-message ${role}`;

  // 仅 AI 消息显示头像，用户消息不显示（当前版本统一不显示头像）
  // 气泡（AI 消息用 Markdown 渲染）
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-bubble';

  if (role === 'assistant') {
    // AI 回复：Markdown 渲染
    let htmlContent = '';
    if (typeof window.marked !== 'undefined') {
      try { htmlContent = window.marked.parse(content); } catch(e) {
        htmlContent = escapeHtml(content).replace(/\n/g, '<br>');
      }
    } else {
      htmlContent = escapeHtml(content).replace(/\n/g, '<br>');
    }
    bubbleEl.innerHTML = htmlContent;

    // 代码高亮
    if (typeof hljs !== 'undefined') {
      bubbleEl.querySelectorAll('pre code').forEach(block => { hljs.highlightElement(block); });
    }

    // Mermaid 图表（带容错：语法错误时回退为代码块）
    if (typeof mermaid !== 'undefined') {
      const mermaidBlocks = bubbleEl.querySelectorAll('.language-mermaid');
      const renderPromises = [];
      mermaidBlocks.forEach((el) => {
        const code = el.textContent.trim();
        // 使用 Promise 链处理异步验证
        const p = mermaid.parse(code).then(() => {
          el.outerHTML = `<div class="mermaid">${code}</div>`;
        }).catch((parseErr) => {
          console.group('Mermaid 渲染失败（历史消息）');
          console.warn('错误信息:', parseErr.message);
          console.warn('原始代码:\n', code);
          console.groupEnd();
          el.outerHTML = `<pre><code class="language-mermaid">${escapeHtml(code)}</code></pre>`;
        });
        renderPromises.push(p);
      });
      // 所有验证完成后统一渲染
      Promise.all(renderPromises).then(() => {
        if (bubbleEl.querySelector('.mermaid')) {
          mermaid.init(undefined, bubbleEl).catch((e) => {
            console.warn('Mermaid init 异常:', e.message);
          });
        }
      });
    }

    // 历史消息复制按钮（在气泡之后添加，见下方）
  } else {
    // 用户消息：纯文本
    bubbleEl.textContent = content;
  }

  // 将气泡添加到消息容器（无头像模式）— 气泡始终在最前
  msgEl.appendChild(bubbleEl);

  // AI 消息：复制按钮放在气泡下面（气泡外）
  if (role === 'assistant') {
    const copyBtn = buildCopyButton(content);
    msgEl.appendChild(copyBtn);
  }

  els.messages.insertBefore(msgEl, els.loading);
}

/**
 * 显示/隐藏加载指示器
 */
function showLoading(show) {
  if (show) {
    els.loading.classList.remove('is-hidden');
    els.loading.style.setProperty('display', 'flex');
  } else {
    els.loading.classList.add('is-hidden');
    els.loading.style.setProperty('display', 'none');
  }
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
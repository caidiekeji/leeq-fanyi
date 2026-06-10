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
  typewriterTimer: null,   // 打字机定时器引用（用于中断）
  typewriterAborted: false, // 用户主动停止打字机的标志
  currentConvId: null,    // 当前会话 ID
  conversations: [],       // 所有会话列表
  localSkills: []          // 用户自定义技能（localStorage）
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
  // 停止按钮
  stopBtn: document.getElementById('stopBtn'),
  stopBtnBottom: document.getElementById('stopBtnBottom'),
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
  skillPanel2: document.getElementById('skillPanel2'),
  skillPanelList2: document.getElementById('skillPanelList2'),
  uploadBtn2: document.getElementById('uploadBtn2'),
  uploadFilename2: document.getElementById('uploadFilename2'),
  // 移动端汉堡菜单
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  // 技能创建弹窗
  skillCreateOverlay: document.getElementById('skillCreateOverlay'),
  skillCreateName: document.getElementById('skillCreateName'),
  skillCreateDesc: document.getElementById('skillCreateDesc'),
  skillCreatePrompt: document.getElementById('skillCreatePrompt'),
  skillCreateSave: document.getElementById('skillCreateSave'),
  skillCreateCancel: document.getElementById('skillCreateCancel'),
  skillCreateClose: document.getElementById('skillCreateClose')
};

/**
 * 初始化聊天页面
 */
function initChat() {
  applyTheme(chatState.theme);
  loadConversations();
  loadLocalSkills();
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

  // 检查是否有待恢复的请求（页面离开时未完成的对话）
  const pending = restorePendingState();
  if (pending) {
    // 延迟执行恢复，确保 DOM 和事件绑定完成
    setTimeout(() => executeRestore(pending), 300);
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
 * 加载所有会话（多会话系统）
 */
function loadConversations() {
  const saved = loadLocal('chatConversations', null);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    chatState.conversations = saved;
    // 恢复最近一次的会话（最后一个）
    const lastConv = saved[saved.length - 1];
    chatState.currentConvId = lastConv.id;
    chatState.messages = lastConv.messages || [];
    if (chatState.messages.length > 0) {
      renderAllMessages();
      switchToMessageMode();
    }
  } else {
    chatState.conversations = [];
    chatState.currentConvId = null;
  }
  renderHistoryList();
}

/**
 * 保存所有会话到 localStorage
 */
function saveConversations() {
  // 更新当前会话的消息
  if (chatState.currentConvId) {
    const idx = chatState.conversations.findIndex(c => c.id === chatState.currentConvId);
    if (idx !== -1) {
      chatState.conversations[idx].messages = [...chatState.messages];
      chatState.conversations[idx].updatedAt = Date.now();
    }
  }
  saveLocal('chatConversations', chatState.conversations);
}

/**
 * 兼容旧接口：保存聊天历史
 */
function saveChatHistory() {
  saveConversations();
}

/**
 * 渲染侧边栏历史记录列表
 */
function renderHistoryList() {
  if (!els.historyList) return;

  if (chatState.conversations.length === 0) {
    els.historyList.innerHTML = '<div class="sidebar-empty-hint">暂无历史记录</div>';
    return;
  }

  // 按更新时间倒序排列（最新的在前）
  const sorted = [...chatState.conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  els.historyList.innerHTML = sorted.map(conv => {
    const isActive = conv.id === chatState.currentConvId;
    const timeLabel = formatTimeAgo(conv.updatedAt || conv.createdAt);
    return `
      <button class="history-item${isActive ? ' history-item-active' : ''}" data-conv-id="${conv.id}">
        <span class="history-item-title">${escapeHtml(conv.title || '新对话')}</span>
        <span class="history-item-time">${timeLabel}</span>
        <button class="history-item-delete" data-conv-id="${conv.id}" title="删除此对话" aria-label="删除对话">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </button>
    `;
  }).join('');

  // 绑定点击事件：切换会话
  els.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // 如果点击的是删除按钮，不触发切换
      if (e.target.closest('.history-item-delete')) return;
      const convId = item.dataset.convId;
      switchConversation(convId);
    });
  });

  // 绑定删除事件
  els.historyList.querySelectorAll('.history-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const convId = btn.dataset.convId;
      deleteConversation(convId);
    });
  });
}

/**
 * 切换到指定会话
 */
function switchConversation(convId) {
  stopTypewriter();
  const conv = chatState.conversations.find(c => c.id === convId);
  if (!conv) return;

  chatState.currentConvId = convId;
  chatState.messages = conv.messages || [];
  chatState.searchMode = false;
  chatState.activeSkill = null;
  chatState.uploadedFileContent = null;
  chatState.uploadedFileName = null;
  chatState.uploadedFileSize = null;

  if (els.searchModeBtn) els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  renderSkillPanel();

  if (chatState.messages.length > 0) {
    renderAllMessages();
    switchToMessageMode();
  } else {
    switchToWelcomeMode();
  }
  updatePlaceholder();
  renderHistoryList(); // 高亮当前项
  if (window.innerWidth <= 768) closeMobileSidebar();
}

/**
 * 删除指定会话
 */
function deleteConversation(convId) {
  const idx = chatState.conversations.findIndex(c => c.id === convId);
  if (idx === -1) return;

  chatState.conversations.splice(idx, 1);

  // 如果删除的是当前会话，切换到最近的或新建
  if (chatState.currentConvId === convId) {
    if (chatState.conversations.length > 0) {
      const sorted = [...chatState.conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      switchConversation(sorted[0].id);
    } else {
      chatState.currentConvId = null;
      chatState.messages = [];
      switchToWelcomeMode();
    }
  }

  saveConversations();
  renderHistoryList();
  showToast('对话已删除', 'info');
}

/**
 * 从消息内容生成会话标题
 */
function generateTitle(content, role) {
  if (role === 'user') {
    return content.replace(/\[.*?搜索\]\s*/, '').slice(0, 30) || '新对话';
  }
  return content.slice(0, 30) || '新对话';
}

/**
 * 格式化时间为相对时间
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + '分钟前';
  if (hours < 24) return hours + '小时前';
  if (days < 30) return days + '天前';
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

/**
 * 加载本地自定义技能（localStorage）
 */
function loadLocalSkills() {
  chatState.localSkills = loadLocal('localSkills', []);
}

/**
 * 保存本地自定义技能
 */
function saveLocalSkills() {
  saveLocal('localSkills', chatState.localSkills);
}

/**
 * 获取合并后的技能列表（后台技能 + 本地技能）
 */
function getMergedSkills() {
  // 后台技能标记 source: 'remote'，本地技能标记 source: 'local'
  const remote = chatState.skills.map(s => ({ ...s, _source: 'remote' }));
  const local = chatState.localSkills.map(s => ({ ...s, _source: 'local' }));
  return [...remote, ...local];
}

/**
 * 打开技能创建弹窗
 */
function openSkillCreateModal() {
  if (!els.skillCreateOverlay) return;
  if (els.skillCreateName) els.skillCreateName.value = '';
  if (els.skillCreateDesc) els.skillCreateDesc.value = '';
  if (els.skillCreatePrompt) els.skillCreatePrompt.value = '';
  els.skillCreateOverlay.classList.add('active');
}

/**
 * 关闭技能创建弹窗
 */
function closeSkillCreateModal() {
  if (els.skillCreateOverlay) els.skillCreateOverlay.classList.remove('active');
}

/**
 * 保存本地技能
 */
function handleSaveLocalSkill() {
  const name = els.skillCreateName?.value?.trim() || '';
  const description = els.skillCreateDesc?.value?.trim() || '';
  const prompt = els.skillCreatePrompt?.value?.trim() || '';

  if (!name) {
    showToast('请输入技能名称', 'error');
    els.skillCreateName?.focus();
    return;
  }
  if (!prompt) {
    showToast('请输入系统提示词', 'error');
    els.skillCreatePrompt?.focus();
    return;
  }

  // 检查重名
  const exists = chatState.localSkills.find(s => s.name === name);
  if (exists) {
    showToast('已存在同名技能，请更换名称', 'error');
    els.skillCreateName?.focus();
    return;
  }

  const newSkill = { id: 'local_' + Date.now(), name, description, prompt };
  chatState.localSkills.push(newSkill);
  saveLocalSkills();

  closeSkillCreateModal();
  renderSkillPanel(); // 刷新技能选择面板
  showToast(`技能「${name}」已创建`, 'success');
}

// ====== 后台继续生成：待处理状态管理 ======

const PENDING_KEY = 'chat:pending';

/**
 * 保存待处理状态（发送请求前调用）
 */
function savePendingState(rawText, displayContent, searchMode, searchEngine, activeSkill) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      rawText,
      displayContent,
      searchMode,
      searchEngine,
      activeSkill: activeSkill ? { name: activeSkill.name, prompt: activeSkill.prompt } : null,
      timestamp: Date.now(),
      convId: chatState.currentConvId
    }));
  } catch (e) {}
}

/**
 * 清除待处理状态（请求完成后调用）
 */
function clearPendingState() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch (e) {}
}

/**
 * 恢复待处理状态（页面加载时调用）
 */
function restorePendingState() {
  try {
    const data = sessionStorage.getItem(PENDING_KEY);
    if (!data) return false;
    const pending = JSON.parse(data);
    // 超过 5 分钟的过期请求不恢复
    if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
      clearPendingState();
      return false;
    }
    return pending;
  } catch (e) {
    clearPendingState();
    return false;
  }
}

/**
 * 执行恢复：重新发送上次未完成的请求
 */
async function executeRestore(pending) {
  if (pending.convId && pending.convId !== chatState.currentConvId) {
    clearPendingState();
    return;
  }

  showToast('恢复上次的对话...', 'info');

  // 恢复搜索模式和技能状态
  if (pending.searchMode) {
    chatState.searchMode = true;
    chatState.searchEngine = pending.searchEngine || 'bing';
    if (els.searchModeBtn) els.searchModeBtn.classList.add('search-active');
    if (els.searchModeBtn2) els.searchModeBtn2.classList.add('search-active');
  }
  if (pending.activeSkill) {
    chatState.activeSkill = pending.activeSkill;
    renderSkillPanel();
  }

  // 渲染用户消息
  els.inputLarge.value = '';
  els.inputBottom.value = '';
  renderMessage('user', pending.displayContent);
  scrollToBottom();

  // 发送请求
  chatState.typewriterAborted = false;
  chatState.isSending = true;
  updateSendButtons();
  showLoading(true);

  try {
    let reply;
    if (pending.searchMode) {
      const searchPayload = { query: pending.rawText, engine: pending.searchEngine };
      if (pending.activeSkill?.prompt) searchPayload.skillPrompt = pending.activeSkill.prompt;
      reply = await sendSearchRequest(searchPayload);
      chatState.searchMode = false;
      if (els.searchModeBtn) els.searchModeBtn.classList.remove('search-active');
      if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
      updatePlaceholder();
    } else {
      reply = await sendChatRequest(pending.displayContent);
    }
    await typewriterEffect(reply, 18);
  } catch (err) {
    showToast('恢复失败: ' + err.message, 'error');
  } finally {
    chatState.isSending = false;
    showLoading(false);
    updateSendButtons();
    clearPendingState();
  }
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
  const allSkills = getMergedSkills();
  let html = '';
  if (allSkills.length === 0) {
    html = '<div class="ds-skill-empty">暂无可用技能，点击左侧「创建技能」自定义</div>';
  } else {
    html = allSkills.map(skill => `
      <button class="skill-item${chatState.activeSkill?.name === skill.name ? ' selected' : ''}" data-skill-name="${skill.name}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span class="skill-item-name">${escapeHtml(skill.name)}</span>
        ${skill._source === 'local' ? `<button class="skill-item-delete" data-skill-delete="${skill.name}" title="删除本地技能"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
      </button>
    `).join('');
  }
  // 同步渲染到两个面板
  els.skillPanelList.innerHTML = html;
  if (els.skillPanelList2) els.skillPanelList2.innerHTML = html;

  // 绑定技能点击事件（两个面板都要绑）
  const bindEvents = (listEl) => {
    listEl.querySelectorAll('.skill-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.skill-item-delete')) return;
        const skillName = item.dataset.skillName;
        const skill = allSkills.find(s => s.name === skillName);
        if (skill) {
          if (chatState.activeSkill?.name === skill.name) {
            chatState.activeSkill = null;
          } else {
            chatState.activeSkill = { name: skill.name, prompt: skill.prompt, description: skill.description };
          }
          renderSkillPanel();
          updatePlaceholder();
          showToast(chatState.activeSkill ? `已选择技能: ${skill.name}` : '已取消技能选择', 'info');
        }
      });
    });
    // 绑定删除按钮（仅本地技能）
    listEl.querySelectorAll('.skill-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const skillName = btn.dataset.skillDelete;
        if (!confirm(`确定要删除本地技能「${skillName}」吗？`)) return;
        chatState.localSkills = chatState.localSkills.filter(s => s.name !== skillName);
        saveLocalSkills();
        if (chatState.activeSkill?.name === skillName) chatState.activeSkill = null;
        renderSkillPanel();
        updatePlaceholder();
        showToast(`技能「${skillName}」已删除`, 'info');
      });
    });
  };
  bindEvents(els.skillPanelList);
  if (els.skillPanelList2) bindEvents(els.skillPanelList2);
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
  if (els.inputLarge) els.inputLarge.placeholder = placeholder;
  if (els.inputBottom) els.inputBottom.placeholder = placeholder + ' (Enter 发送)';
}

/**
 * 绑定事件
 */
function bindEvents() {
  // --- 发送按钮 ---
  if (els.sendBtnLg) els.sendBtnLg.addEventListener('click', () => handleSend());
  if (els.sendBtnSm) els.sendBtnSm.addEventListener('click', () => handleSend());

  // --- 停止按钮 ---
  // NOTE: 不能在这里调用 stopTypewriter()，因为 stopTypewriter() 会直接 clearInterval，
  // 导致 typewriterEffect 的 Promise 永不 resolve，进而使 handleSend 的 finally 块
  // 无法执行，chatState.isSending 永远为 true，整个聊天功能永久卡死。
  // 正确做法：只设置 typewriterAborted 标志，让 typewriterEffect 内部的 interval
  // 回调检测到该标志后自行完成清理（finishRender + resolve）。
  const handleStop = () => {
    chatState.typewriterAborted = true;
    showToast('已停止回答', 'info');
  };
  if (els.stopBtn) els.stopBtn.addEventListener('click', handleStop);
  if (els.stopBtnBottom) els.stopBtnBottom.addEventListener('click', handleStop);

  // --- 居中输入框 ---
  if (els.inputLarge) {
    els.inputLarge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    els.inputLarge.addEventListener('input', () => {
      updateSendButtons();
      autoResizeInput(els.inputLarge, 220);
      updateCharCount();
    });
  }

  // --- 底部输入框 ---
  if (els.inputBottom) {
    els.inputBottom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    els.inputBottom.addEventListener('input', () => {
      updateSendButtons();
      autoResizeInput(els.inputBottom, 120);
    });
  }

  // --- 搜索模式切换（欢迎区和底部区同步） ---
  if (els.searchModeBtn) els.searchModeBtn.addEventListener('click', toggleSearchMode);
  if (els.searchModeBtn2) els.searchModeBtn2.addEventListener('click', toggleSearchMode);
  if (els.searchEngineSelect) {
    els.searchEngineSelect.addEventListener('change', (e) => {
      chatState.searchEngine = e.target.value;
      if (els.searchEngineSelect2) els.searchEngineSelect2.value = e.target.value;
      updatePlaceholder();
    });
  }
  if (els.searchEngineSelect2) {
    els.searchEngineSelect2.addEventListener('change', (e) => {
      chatState.searchEngine = e.target.value;
      if (els.searchEngineSelect) els.searchEngineSelect.value = e.target.value;
      updatePlaceholder();
    });
  }

  // --- 技能面板（欢迎区和底部区同步） ---
  function toggleSkillPanel() {
    if (!els.skillPanel) return;
    const isHidden = els.skillPanel.classList.contains('is-hidden');
    if (isHidden) {
      els.skillPanel.style.removeProperty('display');
      els.skillPanel.classList.remove('is-hidden');
      if (els.skillPanel2) { els.skillPanel2.style.removeProperty('display'); els.skillPanel2.classList.remove('is-hidden'); }
    } else {
      els.skillPanel.style.setProperty('display', 'none');
      els.skillPanel.classList.add('is-hidden');
      if (els.skillPanel2) { els.skillPanel2.style.setProperty('display', 'none'); els.skillPanel2.classList.add('is-hidden'); }
    }
  }

  if (els.skillBtn) {
    els.skillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSkillPanel();
    });
  }
  if (els.skillBtn2) {
    els.skillBtn2.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSkillPanel();
    });
  }
  document.addEventListener('click', (e) => {
    if (els.skillPanel && !els.skillPanel.classList.contains('is-hidden') && !els.skillPanel.contains(e.target) && !els.skillPanel2?.contains(e.target) && e.target !== els.skillBtn && e.target !== els.skillBtn2) {
      els.skillPanel.style.setProperty('display', 'none');
      els.skillPanel.classList.add('is-hidden');
      if (els.skillPanel2) { els.skillPanel2.style.setProperty('display', 'none'); els.skillPanel2.classList.add('is-hidden'); }
    }
  });

  // --- 文件上传（欢迎区和底部区同步） ---
  if (els.uploadBtn) els.uploadBtn.addEventListener('click', () => { if (els.fileInput) els.fileInput.click(); });
  if (els.uploadBtn2) els.uploadBtn2.addEventListener('click', () => { if (els.fileInput) els.fileInput.click(); });
  if (els.fileInput) els.fileInput.addEventListener('change', handleFileUpload);

  // --- 侧边栏操作 ---
  if (els.sidebarToggle) els.sidebarToggle.addEventListener('click', toggleSidebar);
  if (els.newChatBtn) els.newChatBtn.addEventListener('click', handleNewChat);
  if (els.clearBtn) els.clearBtn.addEventListener('click', handleClear);
  if (els.createSkillBtn) els.createSkillBtn.addEventListener('click', () => {
    openSkillCreateModal();
  });

  // 技能创建弹窗事件
  if (els.skillCreateClose) els.skillCreateClose.addEventListener('click', closeSkillCreateModal);
  if (els.skillCreateCancel) els.skillCreateCancel.addEventListener('click', closeSkillCreateModal);
  if (els.skillCreateSave) els.skillCreateSave.addEventListener('click', handleSaveLocalSkill);
  // 点击遮罩关闭
  if (els.skillCreateOverlay) {
    els.skillCreateOverlay.addEventListener('click', (e) => {
      if (e.target === els.skillCreateOverlay) closeSkillCreateModal();
    });
  }
  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.skillCreateOverlay?.classList.contains('active')) {
      closeSkillCreateModal();
    }
  });

  // --- 主题切换 ---
  if (els.themeBtn) els.themeBtn.addEventListener('click', toggleTheme);

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
      if (overlay?.classList.contains('show') && els.sidebar && !els.sidebar.contains(e.target)) {
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
  const activeInput = getActiveInput();
  const text = activeInput ? activeInput.value.trim() : '';
  if (chatState.isSending) {
    // 回答中：隐藏发送按钮，显示停止按钮
    if (els.sendBtnLg) els.sendBtnLg.style.display = 'none';
    if (els.sendBtnSm) els.sendBtnSm.style.display = 'none';
    if (els.stopBtn) els.stopBtn.style.removeProperty('display');
    if (els.stopBtnBottom) els.stopBtnBottom.style.removeProperty('display');
  } else {
    // 空闲中：显示发送按钮，隐藏停止按钮
    const disabled = !text;
    if (els.sendBtnLg) { els.sendBtnLg.disabled = disabled; els.sendBtnLg.style.removeProperty('display'); }
    if (els.sendBtnSm) { els.sendBtnSm.disabled = disabled; els.sendBtnSm.style.removeProperty('display'); }
    if (els.stopBtn) els.stopBtn.style.setProperty('display', 'none');
    if (els.stopBtnBottom) els.stopBtnBottom.style.setProperty('display', 'none');
  }
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
    if (els.searchModeBtn) els.searchModeBtn.classList.add('search-active');
    if (els.searchModeBtn2) els.searchModeBtn2.classList.add('search-active');
    // 不再显示下拉框，直接使用后台配置的默认引擎
    chatState.activeSkill = null;
    if (els.skillPanel) {
      els.skillPanel.style.setProperty('display', 'none');
      els.skillPanel.classList.add('is-hidden');
    }
    if (els.skillPanel2) { els.skillPanel2.style.setProperty('display', 'none'); els.skillPanel2.classList.add('is-hidden'); }
    renderSkillPanel();
  } else {
    if (els.searchModeBtn) els.searchModeBtn.classList.remove('search-active');
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
  if (els.sidebar) els.sidebar.classList.toggle('collapsed');
}

/**
 * 移动端打开侧边栏
 */
function openMobileSidebar() {
  if (!els.sidebar) return;
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
  if (els.sidebar) els.sidebar.classList.remove('open');
  const overlay = document.querySelector('.mobile-overlay');
  if (overlay) overlay.classList.remove('show');
}

/**
 * 新建对话（保存当前会话，创建空白新会话）
 */
function handleNewChat() {
  stopTypewriter();
  // 先保存当前会话（如果有消息）
  if (chatState.currentConvId && chatState.messages.length > 0) {
    saveConversations();
  }
  // 创建新会话
  const newId = 'conv_' + Date.now();
  const newConv = {
    id: newId,
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  chatState.conversations.push(newConv);
  chatState.currentConvId = newId;
  chatState.messages = [];
  chatState.searchMode = false;
  chatState.activeSkill = null;
  chatState.uploadedFileContent = null;
  chatState.uploadedFileName = null;
  chatState.uploadedFileSize = null;
  if (els.searchModeBtn) els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  if (els.uploadFilename) { els.uploadFilename.classList.add('is-hidden'); els.uploadFilename.style.setProperty('display', 'none'); els.uploadFilename.textContent = ''; }
  if (els.uploadFilename2) { els.uploadFilename2.classList.add('is-hidden'); els.uploadFilename2.style.setProperty('display', 'none'); els.uploadFilename2.textContent = ''; }
  saveConversations();
  switchToWelcomeMode();
  updatePlaceholder();
  renderHistoryList();
  showToast('已开始新对话', 'info');
  if (window.innerWidth <= 768) closeMobileSidebar();
}

/**
 * 清空所有历史
 */
function handleClear() {
  if (chatState.conversations.length === 0 && chatState.messages.length === 0) return;
  stopTypewriter();
  chatState.conversations = [];
  chatState.currentConvId = null;
  chatState.messages = [];
  chatState.searchMode = false;
  chatState.activeSkill = null;
  chatState.uploadedFileContent = null;
  chatState.uploadedFileName = null;
  chatState.uploadedFileSize = null;
  if (els.searchModeBtn) els.searchModeBtn.classList.remove('search-active');
  if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
  if (els.uploadFilename) { 
    els.uploadFilename.classList.add('is-hidden');
    els.uploadFilename.style.setProperty('display', 'none');
    els.uploadFilename.textContent = '';
  }
  if (els.uploadFilename2) { 
    els.uploadFilename2.classList.add('is-hidden'); 
    els.uploadFilename2.style.setProperty('display', 'none'); 
    els.uploadFilename2.textContent = ''; 
  }
  saveConversations();
  switchToWelcomeMode();
  updatePlaceholder();
  renderHistoryList();
  showToast('所有历史已清空', 'info');
}

/**
 * 切换到欢迎模式（空状态）
 */
function switchToWelcomeMode() {
  chatState.hasMessages = false;
  if (els.welcome) {
    els.welcome.classList.remove('is-hidden');
    els.welcome.style.setProperty('display', '');
  }
  if (els.inputBottomArea) {
    els.inputBottomArea.classList.add('is-hidden');
    els.inputBottomArea.style.setProperty('display', 'none');
  }
  if (els.messages) {
    els.messages.querySelectorAll('.chat-message').forEach(el => el.remove());
  }
  if (els.inputLarge) {
    els.inputLarge.value = '';
    els.inputLarge.style.height = 'auto';
  }
  if (els.inputBottom) {
    els.inputBottom.value = '';
    els.inputBottom.style.height = 'auto';
  }
  updateSendButtons();
}

/**
 * 切换到消息模式
 */
function switchToMessageMode() {
  chatState.hasMessages = true;
  if (els.welcome) {
    els.welcome.classList.add('is-hidden');
    els.welcome.style.setProperty('display', 'none');
  }
  if (els.inputBottomArea) {
    els.inputBottomArea.classList.remove('is-hidden');
    els.inputBottomArea.style.setProperty('display', '');
  }
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
    if (els.uploadFilename) {
      els.uploadFilename.textContent = file.name;
      els.uploadFilename.classList.remove('is-hidden');
      els.uploadFilename.style.setProperty('display', '');
    }
    if (els.uploadFilename2) { 
      els.uploadFilename2.textContent = file.name; 
      els.uploadFilename2.classList.remove('is-hidden'); 
      els.uploadFilename2.style.setProperty('display', ''); 
    }
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

  // 首次发送消息时，确保有当前会话
  if (!chatState.currentConvId) {
    const newId = 'conv_' + Date.now();
    chatState.currentConvId = newId;
    chatState.conversations.push({
      id: newId,
      title: generateTitle(text, 'user'),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  // 构建用户消息内容
  let userContent = text;

  // 如果有上传文件，保存文件信息到消息元数据（用于历史恢复），并清除文件名显示
  if (chatState.uploadedFileContent) {
    userContent = text;
    // 清除文件名显示元素（保留内容供 API 调用）
    if (els.uploadFilename) {
      els.uploadFilename.classList.add('is-hidden');
      els.uploadFilename.style.setProperty('display', 'none');
      els.uploadFilename.textContent = '';
    }
    if (els.uploadFilename2) { 
      els.uploadFilename2.classList.add('is-hidden'); 
      els.uploadFilename2.style.setProperty('display', 'none'); 
      els.uploadFilename2.textContent = ''; 
    }
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
  renderHistoryList(); // 更新侧边栏标题

  // 渲染文件卡片（仅一次）
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
  chatState.typewriterAborted = false;
  chatState.isSending = true;
  updateSendButtons();
  showLoading(true);

  // 保存待处理状态（用于页面离开后恢复）
  savePendingState(text, userContent, chatState.searchMode, chatState.searchEngine, chatState.activeSkill);

  // 保存文件上下文（用于发送后清除）
  const fileContext = chatState.uploadedFileContent
    ? `【参考文件: ${chatState.uploadedFileName}】\n${chatState.uploadedFileContent}`
    : '';

  try {
    let reply;
    if (chatState.searchMode) {
      // 搜索模式：将文件内容也传递给搜索接口（用于上下文补充）
      const searchPayload = {
        query: text,
        engine: chatState.searchEngine
      };
      if (fileContext) {
        searchPayload.fileContext = fileContext;
      }
      // 如果有激活的技能，传递技能提示词（搜索模式下也生效）
      if (chatState.activeSkill?.prompt) {
        searchPayload.skillPrompt = chatState.activeSkill.prompt;
      }
      reply = await sendSearchRequest(searchPayload);
      // 搜索完成后关闭搜索模式
      chatState.searchMode = false;
      if (els.searchModeBtn) els.searchModeBtn.classList.remove('search-active');
      if (els.searchModeBtn2) els.searchModeBtn2.classList.remove('search-active');
      updatePlaceholder();
    } else {
      reply = await sendChatRequest(userContent, fileContext);
    }

    // 清除上传文件状态（搜索模式和聊天模式共用）
    if (chatState.uploadedFileContent) {
      chatState.uploadedFileContent = null;
      chatState.uploadedFileName = null;
      chatState.uploadedFileSize = null;
      if (els.uploadFilename) {
        els.uploadFilename.classList.add('is-hidden');
        els.uploadFilename.style.setProperty('display', 'none');
        els.uploadFilename.textContent = '';
      }
      if (els.uploadFilename2) { 
        els.uploadFilename2.classList.add('is-hidden'); 
        els.uploadFilename2.style.setProperty('display', 'none'); 
        els.uploadFilename2.textContent = ''; 
      }
    }

    // 使用打字机效果显示 AI 回复（逐字显示）
    await typewriterEffect(reply, 18);
  } catch (err) {
    showToast('发送失败: ' + err.message, 'error');
  } finally {
    chatState.isSending = false;
    showLoading(false);
    updateSendButtons();
    clearPendingState(); // 请求完成，清除待处理状态
  }
}

/**
 * 发送聊天请求
 */
async function sendChatRequest(userContent, fileContext = '') {
  const requestMessages = [];

  // 如果有激活的技能，添加技能提示词
  if (chatState.activeSkill?.prompt) {
    requestMessages.push({
      role: 'system',
      content: chatState.activeSkill.prompt
    });
  }

  // 构建消息列表（含用户上传文件内容作为上下文）
  const msgs = chatState.messages.map(({ role, content }) => ({ role, content }));

  // 如果有上传文件，将文件内容附加到最后一条用户消息中
  if (fileContext && msgs.length > 0) {
    const lastUserIdx = msgs.map((m, i) => ({ m, i })).filter(x => x.m.role === 'user').pop();
    if (lastUserIdx) {
      msgs[lastUserIdx.i].content += '\n\n【用户上传的文件内容】\n' + fileContext;
    }
  }

  requestMessages.push(...msgs);

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
  if (els.messages) els.messages.insertBefore(msgEl, els.loading);
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
      // ====== 用户主动停止 ======
      if (chatState.typewriterAborted) {
        clearInterval(chatState.typewriterTimer);
        chatState.typewriterTimer = null;
        chatState.typewriterAborted = false;
        finishRender(fullText.substring(0, charIndex), true);
        resolve();
        return;
      }

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
        finishRender(fullText, false);
        resolve();
      }
    }, speed);

    /**
     * 完成渲染（正常完成或用户中断共用）
     * @param {string} renderText - 要渲染的文本（完整或部分）
     * @param {boolean} isAborted - 是否被用户中断
     */
    function finishRender(renderText, isAborted) {
      bubbleEl.classList.remove('chat-bubble-typing');

      // Markdown 渲染
      let htmlContent = '';
      if (typeof window.marked !== 'undefined') {
        try {
          htmlContent = window.marked.parse(renderText);
        } catch (e) {
          htmlContent = escapeHtml(renderText).replace(/\n/g, '<br>');
        }
      } else {
        htmlContent = escapeHtml(renderText).replace(/\n/g, '<br>');
      }
      bubbleEl.innerHTML = htmlContent;

      // 代码高亮
      if (typeof hljs !== 'undefined') {
        bubbleEl.querySelectorAll('pre code').forEach(block => {
          hljs.highlightElement(block);
        });
      }

      // Mermaid 图表
      if (typeof mermaid !== 'undefined') {
        const mermaidBlocks = bubbleEl.querySelectorAll('.language-mermaid');
        const renderPromises = [];
        mermaidBlocks.forEach((el) => {
          const code = el.textContent.trim();
          const p = mermaid.parse(code).then(() => {
            el.outerHTML = `<div class="mermaid">${code}</div>`;
          }).catch(() => {
            el.outerHTML = `<pre><code class="language-mermaid">${escapeHtml(code)}</code></pre>`;
          });
          renderPromises.push(p);
        });
        Promise.all(renderPromises).then(() => {
          if (bubbleEl.querySelector('.mermaid')) {
            mermaid.init(undefined, bubbleEl).catch(() => {});
          }
        });
      }

      // 引用源区域
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

      // 中断提示
      if (isAborted && renderText.length < fullText.length) {
        const abortHint = document.createElement('div');
        abortHint.className = 'ai-fallback-hint';
        abortHint.style.cssText = 'background:rgba(59,130,246,0.06);border-color:rgba(59,130,246,0.2);color:#2563eb;';
        abortHint.textContent = '回答已停止（显示部分内容）';
        bubbleEl.appendChild(abortHint);
      }

      // 复制按钮
      const copyBtn = buildCopyButton(renderText);
      msgEl.appendChild(copyBtn);

      // 保存到历史记录
      chatState.messages.push({ role: 'assistant', content: renderText });
      saveChatHistory();
    }
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
  if (!els.messages) return;
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

  if (els.messages) els.messages.insertBefore(msgEl, els.loading);
}

/**
 * 显示/隐藏加载指示器
 */
function showLoading(show) {
  if (!els.loading) return;
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
  if (!els.messages) return;
  requestAnimationFrame(() => {
    els.messages.scrollTop = els.messages.scrollHeight;
  });
}

/**
 * Toast 提示
 */
function showToast(message, type = 'info') {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.className = `toast ${type} show`;
  setTimeout(() => { els.toast.className = 'toast'; }, 2500);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initChat);
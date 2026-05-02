const i18n = {
  zh: {
    nav: { dashboard: '仪表盘', models: '模型管理', apikey: 'API 管理', seo: 'SEO 设置', stats: '访问统计', usage: 'API 用量', analytics: '高级分析', prompt: '提示词模板', system: '系统设置', logs: '访问日志', health: '健康监控', backup: '数据备份' },
    dashboard: { title: '仪表盘', todayMessages: '今日消息量', providers: '已配置提供商', tokenUsage: 'Token 消耗', availableModels: '可用模型', trend: '消息趋势', modelRanking: '模型调用排行', recentDays: '近7天', noData: '暂无数据' },
    models: { title: '模型管理', enable: '启用', disable: '禁用', testSpeed: '测速', noModels: '暂无模型' },
    apikey: { title: 'API 管理', addKey: '添加 API Key', provider: '提供商', apiKey: 'API Key', customEndpoint: '自定义端点（可选）', getModels: '获取模型列表', delete: '删除', masked: '已脱敏' },
    seo: { title: 'SEO 设置', siteTitle: '网站标题', description: '描述', keywords: '关键词', ogImage: 'OG 图片 URL', save: '保存' },
    stats: { title: '访问统计', uniqueVisitors: '独立访客', totalVisits: '总访问', translations: '翻译次数', tokens: 'Token 消耗', days: '近{n}天' },
    usage: { title: 'API 用量统计', provider: '提供商', calls: '调用次数', chars: '字符数', errors: '错误数', successRate: '成功率', avgLatency: '平均延迟' },
    analytics: { title: '高级分析', totalCalls: '总调用次数', totalChars: '总字符数', successRate: '成功率', avgDaily: '日均调用', dailyChart: '每日调用量', langPairRank: '热门翻译语言对', exportReport: '导出 CSV 报表' },
    prompt: { title: '提示词模板', translate: '翻译提示词', detect: '语言检测提示词', save: '保存全部配置', placeholder: '使用 [{source_lang}] 和 [{target_lang}] 作为语言占位符' },
    system: { title: '系统基础设置', siteName: '网站名称', defaultTargetLang: '默认目标语言', footer: '页脚文案', announcement: '公告内容（留空则不显示）', limits: '翻译限制配置', maxCharLimit: '单次最大字符数', dailyFreeLimit: '每日每IP翻译次数上限', save: '保存系统设置' },
    logs: { title: '访问日志', accessLog: '访问日志', errorLog: '错误日志', today: '今天', last3days: '近3天', last7days: '近7天', refresh: '刷新', time: '时间', ip: 'IP', langPair: '语言对', provider: '提供商', status: '状态', latency: '耗时', success: '成功', failed: '失败' },
    health: { title: '模型健康监控', checkNow: '立即检测', healthy: '正常', unhealthy: '异常', noProviders: '没有已启用的提供商' },
    backup: { title: '数据备份', export: '导出备份', import: '导入备份', exportDesc: '导出当前系统所有配置数据为 JSON 文件', importWarning: '导入备份将覆盖当前所有配置，确定要继续吗？', notes: '备份说明', note1: '备份包含：系统配置、API Key、SEO 设置、系统设置、今日统计', note2: '备份不包含：翻译缓存、访问日志、历史统计数据', note3: '导入备份将覆盖当前所有配置，请谨慎操作', note4: '建议定期导出备份并保存到安全位置' },
    login: { title: '管理后台登录', password: '密码', submit: '登录', wrongPassword: '密码错误', locked: '登录尝试过于频繁' },
    common: { save: '保存', cancel: '取消', delete: '删除', confirm: '确认', loading: '加载中...', noData: '暂无数据', success: '操作成功', error: '操作失败', saved: '已保存' },
    realtime: { title: '实时监控', connected: '已连接', disconnected: '已断开', todayCalls: '今日翻译', todayVisitors: '今日访客', successRate: '成功率', avgLatency: '平均延迟', waiting: '等待实时数据...' }
  },
  en: {
    nav: { dashboard: 'Dashboard', models: 'Models', apikey: 'API Keys', seo: 'SEO', stats: 'Statistics', usage: 'API Usage', analytics: 'Analytics', prompt: 'Prompt Templates', system: 'System', logs: 'Access Logs', health: 'Health Monitor', backup: 'Backup' },
    dashboard: { title: 'Dashboard', todayMessages: 'Today Messages', providers: 'Configured Providers', tokenUsage: 'Token Usage', availableModels: 'Available Models', trend: 'Message Trend', modelRanking: 'Model Ranking', recentDays: 'Last 7 Days', noData: 'No Data' },
    models: { title: 'Model Management', enable: 'Enable', disable: 'Disable', testSpeed: 'Test Speed', noModels: 'No Models' },
    apikey: { title: 'API Management', addKey: 'Add API Key', provider: 'Provider', apiKey: 'API Key', customEndpoint: 'Custom Endpoint (Optional)', getModels: 'Get Model List', delete: 'Delete', masked: 'Masked' },
    seo: { title: 'SEO Settings', siteTitle: 'Site Title', description: 'Description', keywords: 'Keywords', ogImage: 'OG Image URL', save: 'Save' },
    stats: { title: 'Access Statistics', uniqueVisitors: 'Unique Visitors', totalVisits: 'Total Visits', translations: 'Translations', tokens: 'Token Usage', days: 'Last {n} Days' },
    usage: { title: 'API Usage Statistics', provider: 'Provider', calls: 'Calls', chars: 'Characters', errors: 'Errors', successRate: 'Success Rate', avgLatency: 'Avg Latency' },
    analytics: { title: 'Advanced Analytics', totalCalls: 'Total Calls', totalChars: 'Total Characters', successRate: 'Success Rate', avgDaily: 'Avg Daily', dailyChart: 'Daily Calls', langPairRank: 'Top Language Pairs', exportReport: 'Export CSV Report' },
    prompt: { title: 'Prompt Templates', translate: 'Translation Prompt', detect: 'Language Detection Prompt', save: 'Save All', placeholder: 'Use [{source_lang}] and [{target_lang}] as language placeholders' },
    system: { title: 'System Settings', siteName: 'Site Name', defaultTargetLang: 'Default Target Language', footer: 'Footer Text', announcement: 'Announcement (leave empty to hide)', limits: 'Translation Limits', maxCharLimit: 'Max Characters Per Request', dailyFreeLimit: 'Daily Limit Per IP', save: 'Save Settings' },
    logs: { title: 'Access Logs', accessLog: 'Access Log', errorLog: 'Error Log', today: 'Today', last3days: 'Last 3 Days', last7days: 'Last 7 Days', refresh: 'Refresh', time: 'Time', ip: 'IP', langPair: 'Language Pair', provider: 'Provider', status: 'Status', latency: 'Latency', success: 'Success', failed: 'Failed' },
    health: { title: 'Health Monitor', checkNow: 'Check Now', healthy: 'Healthy', unhealthy: 'Unhealthy', noProviders: 'No enabled providers' },
    backup: { title: 'Data Backup', export: 'Export Backup', import: 'Import Backup', exportDesc: 'Export all configuration as JSON file', importWarning: 'Importing will overwrite all current configuration. Continue?', notes: 'Backup Notes', note1: 'Includes: System config, API Keys, SEO settings, System settings, Today stats', note2: 'Excludes: Translation cache, Access logs, Historical stats', note3: 'Importing will overwrite all current configuration', note4: 'Export backups regularly and save to a secure location' },
    login: { title: 'Admin Login', password: 'Password', submit: 'Login', wrongPassword: 'Wrong password', locked: 'Too many login attempts' },
    common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', confirm: 'Confirm', loading: 'Loading...', noData: 'No Data', success: 'Success', error: 'Error', saved: 'Saved' },
    realtime: { title: 'Realtime Monitor', connected: 'Connected', disconnected: 'Disconnected', todayCalls: 'Today Calls', todayVisitors: 'Today Visitors', successRate: 'Success Rate', avgLatency: 'Avg Latency', waiting: 'Waiting for data...' }
  }
};

let currentLang = localStorage.getItem('admin_lang') || 'zh';

function t(path) {
  const parts = path.split('.');
  let result = i18n[currentLang];
  for (const p of parts) {
    if (result && result[p] !== undefined) result = result[p];
    else { result = path; break; }
  }
  return result;
}

function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('admin_lang', lang);
  applyI18n();
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text && text !== key) el.textContent = text;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const text = t(key);
    if (text && text !== key) el.placeholder = text;
  });
  const langBtn = document.getElementById('langToggleBtn');
  if (langBtn) langBtn.textContent = currentLang === 'zh' ? 'EN' : '中文';
}

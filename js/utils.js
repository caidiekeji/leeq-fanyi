const LANG_MAP = {
  zh: { name: '中文', m2m: 'chinese' },
  en: { name: '英语', m2m: 'english' },
  ja: { name: '日语', m2m: 'japanese' },
  ko: { name: '韩语', m2m: 'korean' },
  fr: { name: '法语', m2m: 'french' },
  de: { name: '德语', m2m: 'german' },
  es: { name: '西班牙语', m2m: 'spanish' },
  ru: { name: '俄语', m2m: 'russian' },
  pt: { name: '葡萄牙语', m2m: 'portuguese' },
  it: { name: '意大利语', m2m: 'italian' },
  ar: { name: '阿拉伯语', m2m: 'arabic' },
  hi: { name: '印地语', m2m: 'hindi' },
  th: { name: '泰语', m2m: 'thai' },
  vi: { name: '越南语', m2m: 'vietnamese' },
  id: { name: '印尼语', m2m: 'indonesian' },
  nl: { name: '荷兰语', m2m: 'dutch' },
  pl: { name: '波兰语', m2m: 'polish' },
  tr: { name: '土耳其语', m2m: 'turkish' },
  sv: { name: '瑞典语', m2m: 'swedish' },
  da: { name: '丹麦语', m2m: 'danish' },
  fi: { name: '芬兰语', m2m: 'finnish' },
  el: { name: '希腊语', m2m: 'greek' },
  cs: { name: '捷克语', m2m: 'czech' },
  ro: { name: '罗马尼亚语', m2m: 'romanian' },
  hu: { name: '匈牙利语', m2m: 'hungarian' },
  uk: { name: '乌克兰语', m2m: 'ukrainian' },
  bg: { name: '保加利亚语', m2m: 'bulgarian' }
};

const PROVIDERS = {
  cloudflare: { name: 'Cloudflare', models: [
    { id: '@cf/meta/m2m100-1.2b', name: 'm2m100 翻译专用' },
    { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' }
  ]},
  openai: { name: 'OpenAI', models: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' }
  ]},
  anthropic: { name: 'Claude', models: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' }
  ]},
  gemini: { name: 'Gemini', models: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
  ]},
  deepseek: { name: 'DeepSeek', models: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' }
  ]},
  nvidia: { name: 'NVIDIA', models: [
    { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B' }
  ]},
  baidu: { name: '百度文心', models: [
    { id: 'ernie-4.0-8k-latest', name: '文心一言 4.0' },
    { id: 'ernie-speed-128k', name: '文心 Speed' }
  ]},
  aliyun: { name: '阿里通义', models: [
    { id: 'qwen-max', name: '通义千问 Max' },
    { id: 'qwen-plus', name: '通义千问 Plus' },
    { id: 'qwen-turbo', name: '通义千问 Turbo' }
  ]},
  zhipu: { name: '智谱 AI', models: [
    { id: 'glm-4', name: 'GLM-4' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus' }
  ]},
  moonshot: { name: '月之暗面 Kimi', models: [
    { id: 'moonshot-v1-8k', name: 'Kimi 8K' },
    { id: 'moonshot-v1-32k', name: 'Kimi 32K' }
  ]},
  tencent: { name: '腾讯混元', models: [
    { id: 'hunyuan-turbo', name: '混元 Turbo' },
    { id: 'hunyuan-pro', name: '混元 Pro' }
  ]},
  xunfei: { name: '讯飞星火', models: [
    { id: 'generalv3.5', name: '星火 3.5' },
    { id: 'generalv3', name: '星火 V3' }
  ]},
  minimax: { name: 'MiniMax', models: [
    { id: 'abab6.5-chat', name: 'abab6.5' },
    { id: 'abab7-chat', name: 'abab7' }
  ]},
  custom: { name: '自定义 API', models: [] }
};

function maskKey(key) {
  if (!key || key.length < 8) return '***';
  return key.slice(0, 3) + '...' + key.slice(-4);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(data.message || '请求失败');
  return data.data;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

function loadLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch(e) { return fallback; }
}

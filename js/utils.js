const LANG_MAP = {
  zh: { name: '中文' },
  en: { name: '英语' },
  ja: { name: '日语' },
  ko: { name: '韩语' },
  fr: { name: '法语' },
  de: { name: '德语' },
  es: { name: '西班牙语' },
  ru: { name: '俄语' },
  pt: { name: '葡萄牙语' },
  it: { name: '意大利语' },
  ar: { name: '阿拉伯语' },
  hi: { name: '印地语' },
  th: { name: '泰语' },
  vi: { name: '越南语' },
  id: { name: '印尼语' },
  nl: { name: '荷兰语' },
  pl: { name: '波兰语' },
  tr: { name: '土耳其语' },
  sv: { name: '瑞典语' },
  da: { name: '丹麦语' },
  fi: { name: '芬兰语' },
  el: { name: '希腊语' },
  cs: { name: '捷克语' },
  ro: { name: '罗马尼亚语' },
  hu: { name: '匈牙利语' },
  uk: { name: '乌克兰语' },
  bg: { name: '保加利亚语' }
};

const PROVIDERS = {
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

function debounce(fn, delay = 500) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ====== IndexedDB 封装 ======
const DB_NAME = 'leeq_translator';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbCount(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHistory(source, result, sourceLang, targetLang) {
  const item = { source, result, sourceLang, targetLang, time: Date.now() };
  await dbAdd('history', item);
  const count = await dbCount('history');
  if (count > 50) {
    const all = await dbGetAll('history');
    all.sort((a, b) => a.time - b.time);
    for (let i = 0; i < all.length - 50; i++) {
      await dbDelete('history', all[i].id);
    }
  }
}

async function saveFavorite(source, result, sourceLang, targetLang, tag) {
  const item = { source, result, sourceLang, targetLang, tag: tag || '', time: Date.now() };
  await dbAdd('favorites', item);
}

async function getHistory() {
  const all = await dbGetAll('history');
  all.sort((a, b) => b.time - a.time);
  return all;
}

async function getFavorites() {
  const all = await dbGetAll('favorites');
  all.sort((a, b) => b.time - a.time);
  return all;
}

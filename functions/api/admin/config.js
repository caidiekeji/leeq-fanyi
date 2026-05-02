const DEFAULT_CONFIG = {
  providers: {
    cloudflare: { name: 'Cloudflare Workers AI', enabled: true, models: [
      { id: '@cf/meta/m2m100-1.2b', name: 'm2m100 翻译专用' },
      { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' }
    ]},
    openai: { name: 'OpenAI', enabled: true, models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4o', name: 'GPT-4o' }
    ]},
    anthropic: { name: 'Claude', enabled: true, models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' }
    ]},
    gemini: { name: 'Gemini', enabled: false, models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
    ]},
    deepseek: { name: 'DeepSeek', enabled: false, models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' }
    ]},
    nvidia: { name: 'NVIDIA NIM', enabled: false, models: [
      { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B' },
      { id: 'nvidia/mistral-nemo-minitron-8b-8k-instruct', name: 'Mistral NeMo Minitron 8B' }
    ]},
    baidu: { name: '百度文心', enabled: false, models: [
      { id: 'ernie-4.0-8k-latest', name: '文心一言 4.0' },
      { id: 'ernie-speed-128k', name: '文心 Speed' },
      { id: 'ernie-lite-8k', name: '文心 Lite' }
    ]},
    aliyun: { name: '阿里通义', enabled: false, models: [
      { id: 'qwen-max', name: '通义千问 Max' },
      { id: 'qwen-plus', name: '通义千问 Plus' },
      { id: 'qwen-turbo', name: '通义千问 Turbo' }
    ]},
    zhipu: { name: '智谱 AI', enabled: false, models: [
      { id: 'glm-4', name: 'GLM-4' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4-air', name: 'GLM-4 Air' }
    ]},
    minimax: { name: 'MiniMax', enabled: false, models: [
      { id: 'abab6.5-chat', name: 'abab6.5' },
      { id: 'abab7-chat', name: 'abab7' }
    ]},
    moonshot: { name: '月之暗面 Kimi', enabled: false, models: [
      { id: 'moonshot-v1-8k', name: 'Kimi 8K' },
      { id: 'moonshot-v1-32k', name: 'Kimi 32K' },
      { id: 'moonshot-v1-128k', name: 'Kimi 128K' }
    ]},
    xunfei: { name: '讯飞星火', enabled: false, models: [
      { id: 'generalv3.5', name: '星火 3.5' },
      { id: 'generalv3', name: '星火 V3' },
      { id: 'generalv2', name: '星火 V2' }
    ]},
    tencent: { name: '腾讯混元', enabled: false, models: [
      { id: 'hunyuan-turbo', name: '混元 Turbo' },
      { id: 'hunyuan-pro', name: '混元 Pro' },
      { id: 'hunyuan-lite', name: '混元 Lite' }
    ]},
    custom: { name: '自定义 API', enabled: true, models: [] }
  },
  defaultProvider: 'cloudflare',
  defaultModel: '@cf/meta/m2m100-1.2b',
  promptTemplates: {
    translate: '你是一个专业的翻译助手。将用户输入翻译成{targetLang}，保持原文风格和语气。只返回翻译结果，不要加任何解释。',
    detect: '你是一个语言检测助手。识别以下文本的语言，只返回语言代码（如 en、zh、ja），不要返回其他内容。'
  }
};

function verifyToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  const configData = await env.SETTINGS.get('admin:config');
  const config = configData ? JSON.parse(configData) : DEFAULT_CONFIG;
  return new Response(JSON.stringify({ code: 200, data: config, message: 'success' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = await request.json();
    await env.SETTINGS.put('admin:config', JSON.stringify(body));
    return new Response(JSON.stringify({ code: 200, data: null, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

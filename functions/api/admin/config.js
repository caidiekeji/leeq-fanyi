const DEFAULT_CONFIG = {
  providers: {
    openai: { name: 'OpenAI', enabled: false, models: [] },
    anthropic: { name: 'Claude', enabled: false, models: [] },
    gemini: { name: 'Gemini', enabled: false, models: [] },
    deepseek: { name: 'DeepSeek', enabled: false, models: [] },
    nvidia: { name: 'NVIDIA NIM', enabled: false, models: [] },
    baidu: { name: '百度文心', enabled: false, models: [] },
    aliyun: { name: '阿里通义', enabled: false, models: [] },
    zhipu: { name: '智谱 AI', enabled: false, models: [] },
    minimax: { name: 'MiniMax', enabled: false, models: [] },
    moonshot: { name: '月之暗面 Kimi', enabled: false, models: [] },
    xunfei: { name: '讯飞星火', enabled: false, models: [] },
    tencent: { name: '腾讯混元', enabled: false, models: [] },
    custom: { name: '自定义 API', enabled: false, models: [] }
  },
  promptTemplates: {
    translate: '',
    detect: ''
  },
  aigcPrompts: {
    compliance: '',
    quality: '',
    aiDetection: '',
    sensitiveInfo: ''
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

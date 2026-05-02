const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-20250514' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-8b-instruct' },
  baidu: { baseUrl: 'https://qianfan.baidubce.com/v2', defaultModel: 'ernie-4.0-8k' },
  aliyun: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', defaultModel: 'abab6.5-chat' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  xunfei: { baseUrl: 'https://spark-api-open.xf-yun.com/v1', defaultModel: '4.0Ultra' },
  tencent: { baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', defaultModel: 'hunyuan-standard' },
  custom: { baseUrl: '', defaultModel: '' }
};

function verifyToken(request) {
  try {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return false;
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

async function checkProvider(provider, apiKey, customEndpoint) {
  const prov = PROVIDERS[provider];
  if (!prov && provider !== 'custom') return { provider, healthy: false, latency: 0, error: '未知提供商' };
  const baseUrl = customEndpoint || prov?.baseUrl;
  if (!baseUrl) return { provider, healthy: false, latency: 0, error: '未配置端点' };

  const startTime = Date.now();
  try {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    }
    const body = {
      model: prov?.defaultModel || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    };
    const endpoint = provider === 'anthropic'
      ? `${baseUrl}/messages`
      : `${baseUrl}/chat/completions`;
    if (provider === 'anthropic') {
      body.messages = [{ role: 'user', content: 'Hi' }];
      body.system = 'Reply with OK';
    }
    const res = await fetch(endpoint, {
      method: 'POST', headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const latency = Date.now() - startTime;
    if (res.ok) return { provider, healthy: true, latency, error: null };
    const errText = await res.text().catch(() => '');
    return { provider, healthy: false, latency, error: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
  } catch (err) {
    return { provider, healthy: false, latency: Date.now() - startTime, error: err.message };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const configData = await env.SETTINGS.get('admin:config');
    const config = configData ? JSON.parse(configData) : {};
    const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
    const apiKeys = apiKeysData ? JSON.parse(apiKeysData) : {};
    const providers = config.providers || {};
    const results = [];
    const enabledProviders = Object.entries(providers)
      .filter(([, p]) => p.enabled && apiKeys[p]?.apiKey);
    for (const [pId] of enabledProviders) {
      const kd = apiKeys[pId];
      const result = await checkProvider(pId, kd.apiKey, kd.customEndpoint || '');
      results.push(result);
    }
    const healthKey = 'health:models';
    await env.SETTINGS.put(healthKey, JSON.stringify({ results, checkedAt: Date.now() }), { expirationTtl: 3600 });
    return new Response(JSON.stringify({ code: 200, data: { results, checkedAt: Date.now() }, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

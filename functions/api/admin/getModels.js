function verifyToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

const PROVIDER_ENDPOINTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', listPath: '/models' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', listPath: '/models' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', listPath: '/models' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', listPath: '/models' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', listPath: '/models' },
  baidu: { baseUrl: 'https://aip.baidubce.com', listPath: '/v1/models' },
  aliyun: { baseUrl: 'https://dashscope.aliyuncs.com', listPath: '/api/v1/models' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', listPath: '/models' },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', listPath: '/models' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', listPath: '/models' },
  xunfei: { baseUrl: 'https://spark-api-open.xf-yun.com/v1', listPath: '/models' },
  tencent: { baseUrl: 'https://hunyuan.tencentcloudapi.com', listPath: '/v1/models' },
  custom: null
};

async function fetchModels(provider, apiKey, customEndpoint) {
  const endpoint = customEndpoint ? 
    { baseUrl: customEndpoint, listPath: '/models' } : 
    PROVIDER_ENDPOINTS[provider];
  
  if (!endpoint) return null;

  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider === 'baidu') {
    return { models: [], error: '百度文心需要获取 access_token，请手动配置模型' };
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const url = `${endpoint.baseUrl}${endpoint.listPath}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { models: [], error: `获取失败 (${res.status}): ${errText.slice(0, 100)}` };
    }
    
    const data = await res.json();
    let models = [];
    
    if (provider === 'gemini') {
      models = (data.models || []).map(m => ({ 
        id: m.name?.replace('models/', '') || '', 
        name: m.displayName || m.name?.replace('models/', '') || '' 
      })).filter(m => m.id);
    } else if (data.data && Array.isArray(data.data)) {
      models = data.data.map(m => ({ id: m.id, name: m.id })).filter(m => m.id);
    } else if (data.models && Array.isArray(data.models)) {
      models = data.models.map(m => ({ id: m.id || m.model || '', name: m.id || m.model || '' })).filter(m => m.id);
    }
    
    return { models: models.slice(0, 50), error: null };
  } catch (err) {
    return { models: [], error: err.message };
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { provider } = await request.json();
    if (!provider) {
      return new Response(JSON.stringify({ code: 400, data: null, message: '缺少 provider 参数' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const keysData = await env.SETTINGS.get('admin:apiKeys');
    const keys = keysData ? JSON.parse(keysData) : {};
    const apiKey = keys[provider]?.apiKey;
    if (!apiKey) {
      return new Response(JSON.stringify({ code: 400, data: null, message: `未配置 ${provider} 的 API Key` }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const customEndpoint = keys[provider]?.customEndpoint || '';

    const result = await fetchModels(provider, apiKey, customEndpoint);
    if (!result) {
      return new Response(JSON.stringify({ code: 400, data: null, message: '不支持的提供商或需要先测试连接' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (result.error) {
      return new Response(JSON.stringify({ code: 200, data: { models: result.models, message: result.error }, message: 'success' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ code: 200, data: { models: result.models, message: '获取成功' }, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

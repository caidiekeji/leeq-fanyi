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
  try {
    const data = await env.SETTINGS.get('admin:apiKeys');
    const keys = data ? JSON.parse(data) : {};
    const masked = {};
    Object.entries(keys).forEach(([provider, { apiKey, customEndpoint }]) => {
      masked[provider] = {
        apiKey: apiKey ? apiKey.slice(0, 4) + '...' + apiKey.slice(-4) : '',
        customEndpoint,
        configured: !!apiKey
      };
    });
    return new Response(JSON.stringify({ code: 200, data: masked, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
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
    const { provider, apiKey, customEndpoint } = await request.json();
    if (!provider) return new Response(JSON.stringify({ code: 400, data: null, message: '请选择提供商' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
    if (!apiKey) return new Response(JSON.stringify({ code: 400, data: null, message: '请输入 API Key' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });

    const data = await env.SETTINGS.get('admin:apiKeys');
    const keys = data ? JSON.parse(data) : {};
    keys[provider] = { apiKey, customEndpoint: customEndpoint || null };
    await env.SETTINGS.put('admin:apiKeys', JSON.stringify(keys));

    return new Response(JSON.stringify({ code: 200, data: { provider }, message: '保存成功，正在获取模型列表' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');
    if (!provider) return new Response(JSON.stringify({ code: 400, data: null, message: '请指定提供商' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });

    const data = await env.SETTINGS.get('admin:apiKeys');
    const keys = data ? JSON.parse(data) : {};
    delete keys[provider];
    await env.SETTINGS.put('admin:apiKeys', JSON.stringify(keys));

    const configData = await env.SETTINGS.get('admin:config');
    if (configData) {
      const config = JSON.parse(configData);
      if (config.providers && config.providers[provider]) {
        config.providers[provider] = { name: config.providers[provider].name, enabled: false, models: [] };
        await env.SETTINGS.put('admin:config', JSON.stringify(config));
      }
    }

    return new Response(JSON.stringify({ code: 200, data: null, message: '已删除' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

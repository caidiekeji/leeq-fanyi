const DEFAULT_SYSTEM_CONFIG = {
  siteName: 'LeeQ 翻译',
  footer: 'Powered by LeeQ 旗下产品 · 由 jie 开发 · Cloudflare 提供加速服务',
  announcement: '',
  defaultSourceLang: 'auto',
  defaultTargetLang: 'zh',
  maxCharLimit: 5000,
  dailyFreeLimit: 1000
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

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const data = await env.SETTINGS.get('admin:system');
    const config = data ? JSON.parse(data) : DEFAULT_SYSTEM_CONFIG;
    return new Response(JSON.stringify({ code: 200, data: config, message: 'success' }), {
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
    const body = await request.json();
    const existing = await env.SETTINGS.get('admin:system');
    const current = existing ? JSON.parse(existing) : DEFAULT_SYSTEM_CONFIG;
    const config = { ...current, ...body };
    await env.SETTINGS.put('admin:system', JSON.stringify(config));
    return new Response(JSON.stringify({ code: 200, data: config, message: '系统设置已保存' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

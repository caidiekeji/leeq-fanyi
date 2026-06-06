/**
 * 搜索引擎配置 API
 * GET: 公开获取已启用的搜索引擎列表（无需认证）
 * POST: 管理员保存搜索引擎配置（需认证）
 */

function verifyToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

// 默认搜索引擎配置（全部启用）
const DEFAULT_CONFIG = {
  bing: { name: '必应', enabled: true },
  baidu: { name: '百度', enabled: true },
  sogou: { name: '搜狗', enabled: true },
  yandex: { name: 'Yandex', enabled: true }
};

/**
 * 获取搜索引擎配置（公开接口，无需认证）
 */
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const data = await env.SETTINGS.get('admin:searchConfig');
    const config = data ? JSON.parse(data) : DEFAULT_CONFIG;
    // 只返回已启用的引擎信息
    const enabled = Object.entries(config)
      .filter(([, cfg]) => cfg.enabled)
      .map(([key, cfg]) => ({ key, name: cfg.name }));
    return new Response(JSON.stringify({ code: 200, data: { config, enabled }, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 保存搜索引擎配置（管理员认证）
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ code: 400, data: null, message: '请求格式错误' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    // 合并默认配置，确保所有引擎都有配置
    const config = { ...DEFAULT_CONFIG, ...body };
    await env.SETTINGS.put('admin:searchConfig', JSON.stringify(config));
    return new Response(JSON.stringify({ code: 200, data: config, message: '保存成功' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
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
    const backup = {};
    const keys = ['admin:config', 'admin:apiKeys', 'admin:system', 'admin:seo'];
    for (const key of keys) {
      const data = await env.SETTINGS.get(key);
      if (data) backup[key] = JSON.parse(data);
    }
    const today = new Date().toISOString().slice(0, 10);
    const statsKey = `stats:${today}`;
    const statsData = await env.SETTINGS.get(statsKey);
    if (statsData) backup[statsKey] = JSON.parse(statsData);
    backup._meta = { version: 1, createdAt: Date.now(), date: today };
    return new Response(JSON.stringify({ code: 200, data: backup, message: 'success' }), {
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
    if (!body || !body._meta) {
      return new Response(JSON.stringify({ code: 400, data: null, message: '无效的备份数据' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const keys = Object.keys(body).filter(k => k !== '_meta');
    let restored = 0;
    for (const key of keys) {
      await env.SETTINGS.put(key, JSON.stringify(body[key]));
      restored++;
    }
    return new Response(JSON.stringify({
      code: 200,
      data: { restored },
      message: `已恢复 ${restored} 项配置`
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

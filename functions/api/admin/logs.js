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
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'access';
    const days = parseInt(url.searchParams.get('days') || '7');
    const dateList = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateList.push(d.toISOString().slice(0, 10));
    }
    const results = [];
    for (const date of dateList) {
      const key = type === 'error' ? `logs:error:${date}` : `logs:access:${date}`;
      const data = await env.SETTINGS.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          parsed.forEach(entry => { entry.date = date; });
          results.push(...parsed);
        }
      }
    }
    results.sort((a, b) => b.timestamp - a.timestamp);
    return new Response(JSON.stringify({
      code: 200,
      data: { logs: results.slice(0, 200), total: results.length },
      message: 'success'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

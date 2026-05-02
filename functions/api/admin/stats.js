function verifyToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'track') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const today = getTodayKey();
    const key = `stats:${today}`;
    try {
      const data = await env.SETTINGS.get(key);
      const visits = data ? JSON.parse(data) : { unique: [], total: 0 };
      if (!visits.unique.includes(ip)) {
        visits.unique.push(ip);
      }
      visits.total += 1;
      await env.SETTINGS.put(key, JSON.stringify(visits));
      return new Response(JSON.stringify({ code: 200, data: { unique: visits.unique.length, total: visits.total }, message: 'success' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const days = parseInt(url.searchParams.get('days')) || 7;
    const stats = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const key = `stats:${dateKey}`;
      const data = await env.SETTINGS.get(key);
      const visit = data ? JSON.parse(data) : { unique: [], total: 0 };
      stats.push({
        date: dateKey,
        unique: visit.unique.length,
        total: visit.total
      });
    }
    return new Response(JSON.stringify({ code: 200, data: stats, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

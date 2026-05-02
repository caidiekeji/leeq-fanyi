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
    const days = parseInt(url.searchParams.get('days')) || 7;
    const usageByProvider = {};
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const accessKey = `logs:access:${dateKey}`;
      const data = await env.SETTINGS.get(accessKey);
      if (data) {
        const logs = JSON.parse(data);
        logs.forEach(log => {
          const p = log.provider || 'unknown';
          if (!usageByProvider[p]) {
            usageByProvider[p] = { calls: 0, chars: 0, errors: 0, totalLatency: 0 };
          }
          usageByProvider[p].calls++;
          usageByProvider[p].chars += log.charCount || 0;
          if (!log.success) usageByProvider[p].errors++;
          usageByProvider[p].totalLatency += log.latency || 0;
        });
      }
    }
    const results = Object.entries(usageByProvider).map(([provider, data]) => ({
      provider,
      calls: data.calls,
      chars: data.chars,
      errors: data.errors,
      avgLatency: data.calls > 0 ? Math.round(data.totalLatency / data.calls) : 0,
      successRate: data.calls > 0 ? Math.round(((data.calls - data.errors) / data.calls) * 100) : 0
    }));
    results.sort((a, b) => b.calls - a.calls);
    return new Response(JSON.stringify({ code: 200, data: { usage: results, days }, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

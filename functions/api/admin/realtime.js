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
    const today = new Date().toISOString().slice(0, 10);
    const accessKey = `logs:access:${today}`;
    const data = await env.SETTINGS.get(accessKey);
    let totalCalls = 0;
    let totalChars = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let successCount = 0;
    const ips = new Set();
    const recentLogs = [];

    if (data) {
      const logs = JSON.parse(data);
      logs.forEach(log => {
        totalCalls++;
        totalChars += log.charCount || 0;
        if (log.success) {
          successCount++;
          totalLatency += log.latency || 0;
        } else {
          totalErrors++;
        }
        if (log.ip) ips.add(log.ip);
      });

      const lastLogs = logs.slice(-8).reverse();
      lastLogs.forEach(log => {
        recentLogs.push({
          ip: log.ip || '-',
          sourceLang: log.sourceLang || '?',
          targetLang: log.targetLang || '?',
          provider: log.provider || '-',
          success: log.success,
          latency: log.latency || 0,
          charCount: log.charCount || 0,
          timestamp: log.timestamp
        });
      });
    }

    const successRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0;
    const avgLatency = successCount > 0 ? Math.round(totalLatency / successCount) : 0;

    return new Response(JSON.stringify({
      code: 200,
      data: {
        todayCalls: totalCalls,
        todayVisitors: ips.size,
        successRate,
        avgLatency,
        totalChars,
        totalErrors,
        recentLogs
      },
      message: 'success'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

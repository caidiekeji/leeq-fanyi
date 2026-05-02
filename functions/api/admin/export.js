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
    const stats = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const key = `stats:${dateKey}`;
      const data = await env.SETTINGS.get(key);
      const visit = data ? JSON.parse(data) : { unique: [], total: 0, tokens: 0, translations: 0 };
      stats.push({
        date: dateKey,
        uniqueVisitors: visit.unique?.length || 0,
        totalVisits: visit.total || 0,
        tokens: visit.tokens || 0,
        translations: visit.translations || 0
      });
    }
    let csv = '\uFEFF日期,独立访客,总访问,Token消耗,翻译次数\n';
    stats.forEach(s => {
      csv += `${s.date},${s.uniqueVisitors},${s.totalVisits},${s.tokens},${s.translations}\n`;
    });
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stats-report-${new Date().toISOString().slice(0,10)}.csv"`
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

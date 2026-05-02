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
    const langPairs = {};
    const countries = {};
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      const accessKey = `logs:access:${dateKey}`;
      const data = await env.SETTINGS.get(accessKey);
      let dayCalls = 0, dayChars = 0, dayErrors = 0;
      if (data) {
        const logs = JSON.parse(data);
        logs.forEach(log => {
          dayCalls++;
          dayChars += log.charCount || 0;
          if (!log.success) dayErrors++;
          const pair = `${log.sourceLang || '?'}→${log.targetLang || '?'}`;
          langPairs[pair] = (langPairs[pair] || 0) + 1;
          const c = log.country || 'Unknown';
          countries[c] = (countries[c] || 0) + 1;
        });
      }
      stats.push({ date: dateKey, calls: dayCalls, chars: dayChars, errors: dayErrors });
    }
    const langPairRanking = Object.entries(langPairs)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const countryDistribution = Object.entries(countries)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const totalCalls = stats.reduce((s, d) => s + d.calls, 0);
    const totalChars = stats.reduce((s, d) => s + d.chars, 0);
    const totalErrors = stats.reduce((s, d) => s + d.errors, 0);
    const avgDaily = days > 0 ? Math.round(totalCalls / days) : 0;
    const successRate = totalCalls > 0 ? Math.round(((totalCalls - totalErrors) / totalCalls) * 100) : 0;
    return new Response(JSON.stringify({
      code: 200,
      data: {
        daily: stats,
        langPairRanking,
        countryDistribution,
        summary: { totalCalls, totalChars, totalErrors, avgDaily, successRate, days }
      },
      message: 'success'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

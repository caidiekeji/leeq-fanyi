/**
 * 获取爬虫访问日志
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  try {
    const key = `logs:spider:${date}`;
    const data = await env.SETTINGS.get(key);
    const logs = data ? JSON.parse(data) : [];

    // 按爬虫分组统计
    const stats = {};
    logs.forEach(log => {
      if (!stats[log.spider]) {
        stats[log.spider] = { count: 0, ips: new Set() };
      }
      stats[log.spider].count++;
      stats[log.spider].ips.add(log.ip);
    });

    // 转换为数组并排序
    const spiderStats = Object.entries(stats).map(([name, data]) => ({
      name,
      count: data.count,
      uniqueIps: data.ips.size
    })).sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify({
      code: 200,
      data: {
        date,
        total: logs.length,
        spiderStats,
        logs: logs.slice(0, 100) // 只返回最近100条
      },
      message: 'success'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      code: 500,
      data: null,
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

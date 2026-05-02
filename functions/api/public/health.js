export async function onRequestGet(context) {
  const { env } = context;
  try {
    const healthData = await env.SETTINGS.get('health:models');
    if (healthData) {
      const health = JSON.parse(healthData);
      const allHealthy = health.results?.every(r => r.healthy) ?? false;
      return new Response(JSON.stringify({
        status: allHealthy ? 'healthy' : 'degraded',
        checkedAt: health.checkedAt,
        providers: health.results?.map(r => ({
          provider: r.provider,
          healthy: r.healthy,
          latency: r.latency
        })) || []
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      status: 'unknown',
      checkedAt: null,
      providers: []
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      error: err.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

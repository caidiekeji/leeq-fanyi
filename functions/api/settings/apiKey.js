export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { provider, apiKey, customEndpoint } = await request.json();
    if (!provider) return errorResponse('请选择提供商');
    if (!apiKey) return errorResponse('请输入 API Key');

    const userId = request.headers.get('cf-connecting-ip') || 'default';
    const settingsData = await env.SETTINGS.get(`user:${userId}`);
    const settings = settingsData ? JSON.parse(settingsData) : { apiKeys: {} };

    settings.apiKeys[provider] = { apiKey, customEndpoint: customEndpoint || null };

    await env.SETTINGS.put(`user:${userId}`, JSON.stringify(settings));

    const keyMasked = apiKey.slice(0, 3) + '...' + apiKey.slice(-4);
    return new Response(JSON.stringify({ code: 200, data: { keyMasked }, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ code: status, data: null, message }), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

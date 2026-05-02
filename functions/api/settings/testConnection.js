export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { provider, model } = await request.json();
    const userId = request.headers.get('cf-connecting-ip') || 'default';
    const settingsData = await env.SETTINGS.get(`user:${userId}`);
    const settings = settingsData ? JSON.parse(settingsData) : { apiKeys: {} };

    if (provider === 'cloudflare') {
      return new Response(JSON.stringify({
        code: 200,
        data: { success: true, message: 'Cloudflare AI 内置模型，无需测试', latency: 0 },
        message: 'success'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const keyData = settings.apiKeys?.[provider];
    if (!keyData) {
      return new Response(JSON.stringify({
        code: 200,
        data: { success: false, message: '请先配置 API Key' },
        message: 'success'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const start = Date.now();
    const testBody = {
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    };

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keyData.apiKey}` };
    const baseUrl = keyData.customEndpoint || {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
      deepseek: 'https://api.deepseek.com/v1'
    }[provider];

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testBody)
    });

    const latency = Date.now() - start;
    return new Response(JSON.stringify({
      code: 200,
      data: { success: res.ok, message: res.ok ? '连接成功' : `HTTP ${res.status}`, latency },
      message: 'success'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      code: 200,
      data: { success: false, message: err.message, latency: 0 },
      message: 'success'
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

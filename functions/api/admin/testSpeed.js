const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-20250514' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-8b-instruct' },
  baidu: { baseUrl: 'https://qianfan.baidubce.com/v2', defaultModel: 'ernie-4.0-8k' },
  aliyun: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', defaultModel: 'abab6.5-chat' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  xunfei: { baseUrl: 'https://spark-api-open.xf-yun.com/v1', defaultModel: '4.0Ultra' },
  tencent: { baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', defaultModel: 'hunyuan-standard' },
  custom: { baseUrl: '', defaultModel: '' }
};

function verifyToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

const TEST_MESSAGES = [
  { role: 'system', content: '你是一个翻译助手。将以下内容翻译为英文，只返回翻译结果：你好世界' },
  { role: 'user', content: '你好世界' }
];

function buildBody(provider, model) {
  if (provider === 'anthropic') {
    return {
      model,
      messages: TEST_MESSAGES.filter(m => m.role !== 'system'),
      system: TEST_MESSAGES[0].content,
      max_tokens: 256
    };
  }
  return { model, messages: TEST_MESSAGES, max_tokens: 256 };
}

async function testModelSpeed(provider, model, apiKey, customEndpoint) {
  const prov = PROVIDERS[provider];
  const baseUrl = customEndpoint || prov?.baseUrl;
  if (!baseUrl && provider !== 'custom') throw new Error('未配置 API 端点');
  if (provider === 'custom' && !customEndpoint) throw new Error('自定义 API 需要指定端点');

  const endpoint = provider === 'anthropic'
    ? `${baseUrl}/messages`
    : `${baseUrl}/chat/completions`;

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    delete headers['Authorization'];
  }

  const body = buildBody(provider, model);

  const startTime = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  const endTime = Date.now();
  const latency = endTime - startTime;

  const text = provider === 'anthropic'
    ? data.content?.[0]?.text
    : data.choices?.[0]?.message?.content;

  const tokens = data.usage?.total_tokens || 0;

  return { latency, tokens, text: text?.slice(0, 50) };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { provider, model, apiKey, customEndpoint } = await request.json();
    if (!provider || !model || !apiKey) {
      return new Response(JSON.stringify({ code: 400, data: null, message: '缺少必要参数' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await testModelSpeed(provider, model, apiKey, customEndpoint);
    return new Response(JSON.stringify({ code: 200, data: result, message: '测试成功' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

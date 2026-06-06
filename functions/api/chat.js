/**
 * Chat API - 聊天对话接口
 * 复用翻译模块的 AI 提供商配置，支持多轮对话
 */

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

/** 返回 JSON 成功响应 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ code: status, data, message: 'success' }), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

/** 返回 JSON 错误响应 */
function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ code: status, data: null, message }), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * 调用 AI 聊天 API，发送消息并获取回复
 */
async function callChatAPI(messages, provider, model, apiKey, customEndpoint) {
  const prov = PROVIDERS[provider];
  const baseUrl = customEndpoint || prov?.baseUrl;
  if (!baseUrl) throw new Error('未配置 API 端点');

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

  // Anthropic 使用不同的认证方式
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    delete headers['Authorization'];
  }

  const body = {
    model: model || prov?.defaultModel || 'gpt-4o-mini',
    messages,
    max_tokens: 4096,
    temperature: 0.7,
    top_p: 0.9
  };

  const endpoint = provider === 'anthropic'
    ? `${baseUrl}/messages`
    : `${baseUrl}/chat/completions`;

  // 处理 Anthropic 的特殊消息格式
  if (provider === 'anthropic') {
    const systemMsg = messages.find(m => m.role === 'system');
    body.messages = messages.filter(m => m.role !== 'system');
    if (systemMsg) body.system = systemMsg.content;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 调用失败 (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  // 提取回复内容
  const content = provider === 'anthropic'
    ? data.content?.[0]?.text
    : data.choices?.[0]?.message?.content;

  if (!content) throw new Error('API 返回格式异常');

  return { content, tokens: data.usage?.total_tokens || 0 };
}

/**
 * 聊天请求入口
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { messages, provider, model } = body;

    // 验证消息列表
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errorResponse('消息不能为空');
    }

    // 验证每条消息格式
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return errorResponse('消息格式不正确，需要 role 和 content 字段');
      }
    }

    // 读取管理员配置
    const configData = await env.SETTINGS.get('admin:config');
    const config = configData ? JSON.parse(configData) : {};
    const configProviders = config.providers || {};

    // 读取 API Keys
    const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
    const adminKeys = apiKeysData ? JSON.parse(apiKeysData) : {};

    // 确定使用的提供商和模型
    let useProvider = provider;
    let useModel = model;

    if (!useProvider) {
      // 从启用的提供商中选择第一个
      const enabledProviders = Object.entries(configProviders)
        .filter(([, pConfig]) => pConfig?.enabled)
        .map(([pId]) => pId);

      if (enabledProviders.length > 0) {
        useProvider = enabledProviders[0];
      } else {
        return errorResponse('请先在管理后台配置并启用 AI 服务', 401);
      }
    }

    if (!useModel) {
      const provConfig = configProviders[useProvider];
      if (provConfig?.modelEnabled && provConfig.modelEnabled.length > 0) {
        useModel = provConfig.modelEnabled[0];
      } else {
        useModel = PROVIDERS[useProvider]?.defaultModel || 'gpt-4o-mini';
      }
    }

    // 获取 API Key
    const keyConfig = adminKeys[useProvider];
    if (!keyConfig?.apiKey) {
      return errorResponse(`未配置 ${useProvider} 的 API Key`, 401);
    }

    // 调用 AI 聊天 API
    let result;
    try {
      result = await callChatAPI(
        messages, useProvider, useModel,
        keyConfig.apiKey,
        keyConfig.customEndpoint || ''
      );
    } catch (err) {
      // 故障转移：尝试其他启用的提供商
      const fallbackKeys = Object.entries(adminKeys)
        .filter(([pId]) => pId !== useProvider && configProviders[pId]?.enabled && adminKeys[pId]?.apiKey);

      let fallbackSuccess = false;
      for (const [fbId, fbKey] of fallbackKeys) {
        try {
          const fbModel = configProviders[fbId]?.modelEnabled?.[0] || PROVIDERS[fbId]?.defaultModel || 'gpt-4o-mini';
          result = await callChatAPI(
            messages, fbId, fbModel,
            typeof fbKey === 'string' ? fbKey : fbKey.apiKey,
            (typeof fbKey === 'object' ? fbKey.customEndpoint : '') || ''
          );
          fallbackSuccess = true;
          useProvider = fbId;
          useModel = fbModel;
          break;
        } catch { continue; }
      }
      if (!fallbackSuccess) throw err;
    }

    return jsonResponse({
      content: result.content,
      provider: useProvider,
      model: useModel,
      tokens: result.tokens
    });
  } catch (err) {
    // 记录错误日志
    try {
      const today = new Date().toISOString().slice(0, 10);
      const errorKey = `logs:error:chat:${today}`;
      const errorData = await env.SETTINGS.get(errorKey);
      const errorLogs = errorData ? JSON.parse(errorData) : [];
      errorLogs.push({
        timestamp: Date.now(),
        provider: body?.provider || 'unknown',
        error: err.message || '未知错误'
      });
      if (errorLogs.length > 200) errorLogs.splice(0, errorLogs.length - 200);
      await env.SETTINGS.put(errorKey, JSON.stringify(errorLogs));
    } catch {}

    return errorResponse(err.message || '聊天请求失败', 500);
  }
}
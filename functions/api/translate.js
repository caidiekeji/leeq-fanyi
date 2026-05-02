const LANG_MAP = {
  zh: 'chinese', en: 'english', ja: 'japanese', ko: 'korean',
  fr: 'french', de: 'german', es: 'spanish', ru: 'russian',
  pt: 'portuguese', it: 'italian', ar: 'arabic', hi: 'hindi',
  th: 'thai', vi: 'vietnamese', id: 'indonesian', nl: 'dutch',
  pl: 'polish', tr: 'turkish', sv: 'swedish', da: 'danish',
  fi: 'finnish', el: 'greek', cs: 'czech', ro: 'romanian',
  hu: 'hungarian', uk: 'ukrainian', bg: 'bulgarian'
};

const LANG_NAMES = {
  zh: '中文', en: '英语', ja: '日语', ko: '韩语',
  fr: '法语', de: '德语', es: '西班牙语', ru: '俄语',
  pt: '葡萄牙语', it: '意大利语', ar: '阿拉伯语', hi: '印地语',
  th: '泰语', vi: '越南语', id: '印尼语', nl: '荷兰语',
  pl: '波兰语', tr: '土耳其语', sv: '瑞典语', da: '丹麦语',
  fi: '芬兰语', el: '希腊语', cs: '捷克语', ro: '罗马尼亚语',
  hu: '匈牙利语', uk: '乌克兰语', bg: '保加利亚语'
};

const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-20250514' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ code: status, data, message: 'success' }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ code: status, data: null, message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getTranslatePrompt(promptTemplates, sourceLangName, targetLangName) {
  const customPrompt = promptTemplates?.translate;
  if (customPrompt) {
    return customPrompt
      .replace(/\[{source_lang}\]/g, sourceLangName)
      .replace(/\[{target_lang}\]/g, targetLangName);
  }
  return `你是一个专业的翻译助手。将用户输入从${sourceLangName}翻译成${targetLangName}。只返回翻译结果，不要加任何解释。`;
}

async function translateWithCloudflare(text, sourceLang, targetLang, model, env, promptTemplates) {
  const sourceLangName = sourceLang === 'auto' ? '自动检测' : (LANG_NAMES[sourceLang] || sourceLang);
  const targetLangName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = getTranslatePrompt(promptTemplates, sourceLangName, targetLangName);

  if (model === '@cf/meta/m2m100-1.2b' || !model) {
    const srcM2m = sourceLang === 'auto' ? 'english' : (LANG_MAP[sourceLang] || 'english');
    const tgtM2m = LANG_MAP[targetLang] || 'chinese';
    const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text,
      source_lang: srcM2m,
      target_lang: tgtM2m
    });
    return { translatedText: response.translated_text, detectedSourceLang: sourceLang === 'auto' ? null : sourceLang };
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ];
  const response = await env.AI.run(model || '@cf/meta/llama-3.1-8b-instruct', { messages });
  return { translatedText: response.response, detectedSourceLang: null };
}

async function translateWithExternal(text, sourceLang, targetLang, provider, model, apiKey, customEndpoint, promptTemplates) {
  const sourceLangName = sourceLang === 'auto' ? '自动检测' : (LANG_NAMES[sourceLang] || sourceLang);
  const targetLangName = LANG_NAMES[targetLang] || targetLang;
  const prov = PROVIDERS[provider];
  const baseUrl = customEndpoint || prov?.baseUrl;
  if (!baseUrl) throw new Error('未配置 API 端点');

  const systemPrompt = getTranslatePrompt(promptTemplates, sourceLangName, targetLangName);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ];

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    delete headers['Authorization'];
  }

  const body = {
    model: model || prov?.defaultModel || 'gpt-4o-mini',
    messages,
    max_tokens: 4096
  };

  const endpoint = provider === 'anthropic'
    ? `${baseUrl}/messages`
    : `${baseUrl}/chat/completions`;

  if (provider === 'anthropic') {
    body.messages = messages.filter(m => m.role !== 'system');
    body.system = messages[0].content;
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
  const translatedText = provider === 'anthropic'
    ? data.content?.[0]?.text
    : data.choices?.[0]?.message?.content;

  if (!translatedText) throw new Error('API 返回格式异常');
  return { translatedText, detectedSourceLang: null };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { text, sourceLang, targetLang, provider, model } = body;

    if (!text || !text.trim()) return errorResponse('文本不能为空');
    if (text.length > 5000) return errorResponse('文本超过5000字符限制');
    if (!targetLang) return errorResponse('请选择目标语言');

    const configData = await env.SETTINGS.get('admin:config');
    const config = configData ? JSON.parse(configData) : {};
    const promptTemplates = config.promptTemplates || {};

    const prov = provider || 'cloudflare';
    let result;

    if (prov === 'cloudflare') {
      result = await translateWithCloudflare(text, sourceLang || 'auto', targetLang, model, env, promptTemplates);
    } else {
      const userId = request.headers.get('cf-connecting-ip') || 'default';
      const settingsData = await env.SETTINGS.get(`user:${userId}`);
      const settings = settingsData ? JSON.parse(settingsData) : {};
      const keyData = settings.apiKeys?.[prov];
      if (!keyData) return errorResponse('请先配置 API Key', 401);
      result = await translateWithExternal(
        text, sourceLang || 'auto', targetLang, prov, model,
        keyData.apiKey, keyData.customEndpoint, promptTemplates
      );
    }

    return jsonResponse({
      translatedText: result.translatedText,
      sourceLang: result.detectedSourceLang || sourceLang,
      targetLang,
      provider: prov,
      model: model || (prov === 'cloudflare' ? '@cf/meta/m2m100-1.2b' : PROVIDERS[prov]?.defaultModel)
    });
  } catch (err) {
    return errorResponse(err.message || '翻译失败', 500);
  }
}

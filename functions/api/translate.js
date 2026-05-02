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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ code: status, data, message: 'success' }), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ code: status, data: null, message }), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function getTranslatePrompt(promptTemplates, sourceLangName, targetLangName, mode) {
  const customPrompt = promptTemplates?.translate;
  if (customPrompt) {
    return customPrompt
      .replace(/\[{source_lang}\]/g, sourceLangName)
      .replace(/\[{target_lang}\]/g, targetLangName);
  }

  let base = `你是一个专业的翻译助手。将用户输入从${sourceLangName}翻译成${targetLangName}。只返回翻译结果，不要加任何解释。`;

  if (mode === 'markdown') {
    base += '\n\n【重要】用户内容包含Markdown格式（标题、列表、代码块、链接、加粗等标记），翻译时必须完整保留所有Markdown语法标记不变，只翻译纯文本部分的内容。绝对不能输出或复制任何指令文字。';
  } else if (mode === 'html') {
    base += '\n\n【重要】用户内容包含HTML标签，翻译时必须保留所有HTML标签及其属性完全不变，只翻译标签之间的文本内容。';
  } else if (mode === 'code') {
    base += '\n\n【重要】用户内容是代码文件，请只翻译其中的注释内容（以//、/*、<!--、#、--、;等开头的注释行），保持所有代码逻辑、变量名、函数名、语法结构完全不变。';
  }

  return base;
}

async function recordStats(env, ip, tokens) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `stats:${today}`;
    const data = await env.SETTINGS.get(key);
    const stats = data ? JSON.parse(data) : { unique: [], total: 0, tokens: 0, translations: 0 };
    stats.tokens = (stats.tokens || 0) + (tokens || 0);
    stats.translations = (stats.translations || 0) + 1;
    stats.total = (stats.total || 0) + 1;
    if (ip && ip !== 'unknown' && !stats.unique.includes(ip)) {
      stats.unique.push(ip);
    }
    if (stats.unique.length > 10000) stats.unique.splice(0, stats.unique.length - 10000);
    await env.SETTINGS.put(key, JSON.stringify(stats));
  } catch (e) { /* 静默失败 */ }
}

async function logAccess(env, ip, sourceLang, targetLang, provider, charCount, success, latency, country) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `logs:access:${today}`;
    const data = await env.SETTINGS.get(key);
    const logs = data ? JSON.parse(data) : [];
    logs.push({
      ip,
      timestamp: Date.now(),
      sourceLang,
      targetLang,
      provider,
      charCount,
      success,
      latency,
      country: country || null
    });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    await env.SETTINGS.put(key, JSON.stringify(logs));
  } catch (e) { /* 访问日志记录失败，静默处理 */ }
}

async function translateWithCloudflare(text, sourceLang, targetLang, model, env, promptTemplates, mode) {
  const sourceLangName = sourceLang === 'auto' ? '自动检测' : (LANG_NAMES[sourceLang] || sourceLang);
  const targetLangName = LANG_NAMES[targetLang] || targetLang;
  const systemPrompt = getTranslatePrompt(promptTemplates, sourceLangName, targetLangName, mode);

  if (model === '@cf/meta/m2m100-1.2b' || !model) {
    const srcM2m = sourceLang === 'auto' ? 'english' : (LANG_MAP[sourceLang] || 'english');
    const tgtM2m = LANG_MAP[targetLang] || 'chinese';
    const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text,
      source_lang: srcM2m,
      target_lang: tgtM2m
    });
    return { translatedText: response.translated_text, detectedSourceLang: sourceLang === 'auto' ? null : sourceLang, tokens: 0 };
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ];
  const response = await env.AI.run(model || '@cf/meta/llama-3.1-8b-instruct', { messages });
  return { translatedText: response.response, detectedSourceLang: null, tokens: 0 };
}

async function translateWithExternal(text, sourceLang, targetLang, provider, model, apiKey, customEndpoint, promptTemplates, mode) {
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
  const tokens = data.usage?.total_tokens || 0;
  return { translatedText, detectedSourceLang: null, tokens };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const startTime = Date.now();
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const clientCountry = request.headers.get('cf-ipcountry') || null;

  try {
    const body = await request.json();
    const { text, sourceLang, targetLang, provider, model, mode } = body;

    if (!text || !text.trim()) return errorResponse('文本不能为空');

    // 读取系统配置，检查翻译限制
    let maxCharLimit = 5000;
    let dailyFreeLimit = 1000;
    try {
      const sysData = await env.SETTINGS.get('admin:system');
      if (sysData) {
        const sysConfig = JSON.parse(sysData);
        maxCharLimit = sysConfig.maxCharLimit || 5000;
        dailyFreeLimit = sysConfig.dailyFreeLimit || 1000;
      }
    } catch {}

    if (text.length > maxCharLimit) return errorResponse(`文本超过${maxCharLimit}字符限制`);

    // 检查每日翻译次数限制
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dailyKey = `rate:daily:${clientIp}:${today}`;
      const dailyData = await env.SETTINGS.get(dailyKey);
      const dailyCount = dailyData ? parseInt(dailyData) : 0;
      if (dailyCount >= dailyFreeLimit) {
        return errorResponse(`今日翻译次数已达上限（${dailyFreeLimit}次）`, 429);
      }
      await env.SETTINGS.put(dailyKey, String(dailyCount + 1), { expirationTtl: 86400 });
    } catch {}

    if (!targetLang) return errorResponse('请选择目标语言');

    const srcLang = sourceLang || 'auto';
    const configData = await env.SETTINGS.get('admin:config');
    const config = configData ? JSON.parse(configData) : {};
    const promptTemplates = config.promptTemplates || {};

    // 翻译缓存：尝试从缓存获取
    const cacheHash = simpleHash(text.trim().toLowerCase() + '|' + srcLang + '|' + targetLang);
    try {
      const cacheKey = `cache:translate:${cacheHash}`;
      const cached = await env.SETTINGS.get(cacheKey);
      if (cached) {
        const cachedResult = JSON.parse(cached);
        await logAccess(env, clientIp, srcLang, targetLang, 'cache', text.length, true, Date.now() - startTime, clientCountry);
        return jsonResponse({
          translatedText: cachedResult.translatedText,
          sourceLang: srcLang,
          targetLang,
          provider: 'cache',
          model: 'cached',
          fromCache: true
        });
      }
    } catch {}

    const prov = provider || 'cloudflare';
    let result;

    if (prov === 'cloudflare') {
      result = await translateWithCloudflare(text, srcLang, targetLang, model, env, promptTemplates, mode);
      await logAccess(env, clientIp, srcLang, targetLang, 'cloudflare', text.length, true, Date.now() - startTime, clientCountry);
    } else {
      // 智能路由：从admin:apiKeys获取所有启用的API Key，按优先级尝试
      const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
      const adminKeys = apiKeysData ? JSON.parse(apiKeysData) : {};

      // 如果指定了provider，尝试用该provider；否则智能路由
      if (prov && adminKeys[prov]?.apiKey) {
        try {
          result = await translateWithExternal(
            text, srcLang, targetLang, prov, model,
            adminKeys[prov].apiKey,
            adminKeys[prov].customEndpoint || '',
            promptTemplates,
            mode
          );
          await logAccess(env, clientIp, srcLang, targetLang, prov, text.length, true, Date.now() - startTime, clientCountry);
        } catch (err) {
          await logAccess(env, clientIp, srcLang, targetLang, prov, text.length, false, Date.now() - startTime, clientCountry);
          // 故障转移：尝试其他启用的提供商
          const configProviders = config.providers || {};
          const fallbackKeys = Object.entries(adminKeys)
            .filter(([pId]) => pId !== prov && configProviders[pId]?.enabled && adminKeys[pId]?.apiKey);
          let translated = false;
          for (const [fbId, fbKey] of fallbackKeys) {
            try {
              result = await translateWithExternal(
                text, srcLang, targetLang, fbId,
                PROVIDERS[fbId]?.defaultModel || 'gpt-4o-mini',
                typeof fbKey === 'string' ? fbKey : fbKey.apiKey,
                (typeof fbKey === 'object' ? fbKey.customEndpoint : '') || '',
                promptTemplates,
                mode
              );
              await logAccess(env, clientIp, srcLang, targetLang, fbId, text.length, true, Date.now() - startTime, clientCountry);
              translated = true;
              break;
            } catch { continue; }
          }
          if (!translated) throw err;
        }
      } else {
        // 智能路由：从启用的提供商中选择
        const configProviders = config.providers || {};
        const enabledKeys = Object.entries(adminKeys)
          .filter(([pId]) => configProviders[pId]?.enabled && adminKeys[pId]?.apiKey);
        if (enabledKeys.length === 0) {
          return errorResponse('请先在管理后台配置并启用 API Key', 401);
        }
        let translated = false;
        let lastError = null;
        for (const [pId, k] of enabledKeys) {
          try {
            const kd = typeof k === 'object' ? k : { apiKey: k, customEndpoint: '' };
            const useModel = model || PROVIDERS[pId]?.defaultModel || 'gpt-4o-mini';
            result = await translateWithExternal(
              text, srcLang, targetLang, pId, useModel,
              kd.apiKey, kd.customEndpoint || '', promptTemplates, mode
            );
            await logAccess(env, clientIp, srcLang, targetLang, pId, text.length, true, Date.now() - startTime, clientCountry);
            translated = true;
            break;
          } catch (e) {
            lastError = e;
            continue;
          }
        }
        if (!translated) {
          await logAccess(env, clientIp, srcLang, targetLang, 'none', text.length, false, Date.now() - startTime, clientCountry);
          throw lastError || new Error('所有可用的翻译服务均失败');
        }
      }
    }

    await recordStats(env, clientIp, result.tokens);

    // 写入翻译缓存（24小时过期）
    try {
      const cacheKey = `cache:translate:${cacheHash}`;
      await env.SETTINGS.put(cacheKey, JSON.stringify({
        translatedText: result.translatedText,
        provider: provider || 'cloudflare',
        createdAt: Date.now()
      }), { expirationTtl: 86400 });
    } catch {}

    return jsonResponse({
      translatedText: result.translatedText,
      sourceLang: result.detectedSourceLang || srcLang,
      targetLang,
      provider: prov,
      model: model || (prov === 'cloudflare' ? '@cf/meta/m2m100-1.2b' : PROVIDERS[prov]?.defaultModel)
    });
  } catch (err) {
    // 记录错误日志
    try {
      const today = new Date().toISOString().slice(0, 10);
      const errorKey = `logs:error:${today}`;
      const errorData = await env.SETTINGS.get(errorKey);
      const errorLogs = errorData ? JSON.parse(errorData) : [];
      errorLogs.push({
        ip: clientIp,
        timestamp: Date.now(),
        sourceLang: body?.sourceLang || 'unknown',
        targetLang: body?.targetLang || 'unknown',
        provider: body?.provider || 'unknown',
        charCount: body?.text?.length || 0,
        success: false,
        latency: Date.now() - startTime,
        error: err.message || '未知错误'
      });
      if (errorLogs.length > 200) errorLogs.splice(0, errorLogs.length - 200);
      await env.SETTINGS.put(errorKey, JSON.stringify(errorLogs));
    } catch (logErr) { /* 错误日志记录失败，静默处理 */ }
    return errorResponse(err.message || '翻译失败', 500);
  }
}

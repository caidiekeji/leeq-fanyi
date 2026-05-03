const LANG_NAMES = {
  zh: '中文(Chinese)', en: '英语(English)', ja: '日语(Japanese)', ko: '韩语(Korean)',
  fr: '法语(French)', de: '德语(German)', es: '西班牙语(Spanish)', ru: '俄语(Russian)',
  pt: '葡萄牙语(Portuguese)', it: '意大利语(Italian)', ar: '阿拉伯语(Arabic)', hi: '印地语(Hindi)',
  th: '泰语(Thai)', vi: '越南语(Vietnamese)', id: '印尼语(Indonesian)', nl: '荷兰语(Dutch)',
  pl: '波兰语(Polish)', tr: '土耳其语(Turkish)', sv: '瑞典语(Swedish)', da: '丹麦语(Danish)',
  fi: '芬兰语(Finnish)', el: '希腊语(Greek)', cs: '捷克语(Czech)', ro: '罗马尼亚语(Romanian)',
  hu: '匈牙利语(Hungarian)', uk: '乌克兰语(Ukrainian)', bg: '保加利亚语(Bulgarian)'
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

/**
 * 清理输入文本，移除不可见字符和异常编码
 */
function sanitizeInput(text) {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * 清洗LLM返回的翻译结果，去除多余内容
 */
function cleanTranslationResult(text, originalText, sourceLang, targetLang) {
  if (!text) throw new Error('API 返回空结果');

  let cleaned = text.trim();

  // 移除常见的AI回复前缀
  const prefixesToRemove = [
    '翻译结果：', '翻译结果:', '译文：', '译文:',
    '好的，翻译如下：', '好的，翻译如下:',
    '以下是翻译结果：', '以下是翻译结果:',
    '翻译如下：', '翻译如下:',
  ];
  for (const prefix of prefixesToRemove) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  // 检查翻译结果是否与原文相同（翻译失败）
  const originalTrimmed = originalText.trim();
  if (cleaned === originalTrimmed) {
    throw new Error('翻译失败：返回结果与原文完全相同');
  }

  return cleaned;
}

/**
 * 翻译质量检查：检测常见翻译异常
 */
function checkTranslationQuality(translatedText, originalText, sourceLang, targetLang) {
  const issues = [];
  if (!translatedText || !translatedText.trim()) {
    issues.push('翻译结果为空');
    return issues;
  }

  const cleaned = translatedText.trim();
  const original = originalText.trim();

  // 检查是否与原文完全相同（可能未翻译）
  if (cleaned === original && sourceLang !== targetLang) {
    issues.push('翻译结果与原文相同');
  }

  // 检查长度比例异常
  const ratio = cleaned.length / original.length;
  if (ratio > 3.0) {
    issues.push(`翻译结果过长（是原文的${(ratio * 100).toFixed(0)}%），可能包含多余内容`);
  } else if (ratio < 0.1 && original.length > 10) {
    issues.push(`翻译结果过短（是原文的${(ratio * 100).toFixed(0)}%），可能被截断`);
  }

  // 检查是否包含明显的错误提示
  const errorPatterns = [/error/i, /failed/i, /无法翻译/, /翻译失败/, /不支持/];
  for (const pattern of errorPatterns) {
    if (pattern.test(cleaned) && cleaned.length < 50) {
      issues.push('翻译结果可能包含错误信息');
      break;
    }
  }

  return issues;
}

/**
 * 生成翻译提示词（仅使用管理员配置）
 * @param {Object} promptTemplates - 管理员配置的提示词模板
 * @param {string} sourceLangName - 源语言名称
 * @param {string} targetLangName - 目标语言名称
 * @returns {string} 翻译系统提示词
 */
function getTranslatePrompt(promptTemplates, sourceLangName, targetLangName) {
  // 仅使用管理员配置的翻译提示词
  const customPrompt = promptTemplates?.translate;
  
  if (!customPrompt || !customPrompt.trim()) {
    throw new Error('请先在管理后台配置翻译提示词模板');
  }

  // 替换占位符并返回
  return customPrompt
    .replace(/\[{source_lang}\]/g, sourceLangName)
    .replace(/\[{target_lang}\]/g, targetLangName);
}

/**
 * 记录翻译统计
 */
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

/**
 * 记录访问日志
 */
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

/**
 * 调用第三方翻译API
 */
async function translateWithExternal(text, sourceLang, targetLang, provider, model, apiKey, customEndpoint, promptTemplates) {
  const sourceLangName = sourceLang === 'auto' ? '自动检测' : (LANG_NAMES[sourceLang] || sourceLang);
  const targetLangName = LANG_NAMES[targetLang] || targetLang;
  const prov = PROVIDERS[provider];
  const baseUrl = customEndpoint || prov?.baseUrl;
  if (!baseUrl) throw new Error('未配置 API 端点');

  // 调试日志：验证参数正确传递
  console.log(`[翻译调试] sourceLang=${sourceLang}, targetLang=${targetLang}, sourceLangName=${sourceLangName}, targetLangName=${targetLangName}, provider=${provider}, model=${model}`);

  const systemPrompt = getTranslatePrompt(promptTemplates, sourceLangName, targetLangName);
  console.log(`[翻译调试] 系统提示词: ${systemPrompt.slice(0, 150)}...`);

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
    max_tokens: 4096,
    temperature: 0.1,
    top_p: 0.9,
    frequency_penalty: 0.0,
    presence_penalty: 0.0
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
  const rawText = provider === 'anthropic'
    ? data.content?.[0]?.text
    : data.choices?.[0]?.message?.content;

  if (!rawText) throw new Error('API 返回格式异常');
  
  const cleanedText = cleanTranslationResult(rawText, text, sourceLang, targetLang);
  const tokens = data.usage?.total_tokens || 0;
  return { translatedText: cleanedText, detectedSourceLang: null, tokens };
}

/**
 * 检测是否为搜索引擎爬虫
 * @param {string} ua - User-Agent 字符串
 * @returns {Object|null} 爬虫信息 {name, type} 或 null
 */
function detectSpider(ua) {
  if (!ua) return null;
  const uaLower = ua.toLowerCase();
  
  const spiders = [
    { pattern: /googlebot/i, name: 'Google', type: 'google' },
    { pattern: /bingbot|msnbot/i, name: 'Bing', type: 'bing' },
    { pattern: /baiduspider/i, name: '百度', type: 'baidu' },
    { pattern: /sogou (spider|web)/i, name: '搜狗', type: 'sogou' },
    { pattern: /soso.*spider/i, name: '搜搜', type: 'soso' },
    { pattern: /360spider|haosouspider/i, name: '360', type: '360' },
    { pattern: /yandexbot/i, name: 'Yandex', type: 'yandex' },
    { pattern: /duckduckbot/i, name: 'DuckDuckGo', type: 'duckduckgo' },
    { pattern: /facebookexternalhit|facebot/i, name: 'Facebook', type: 'facebook' },
    { pattern: /twitterbot/i, name: 'Twitter', type: 'twitter' },
    { pattern: /linkedinbot/i, name: 'LinkedIn', type: 'linkedin' },
    { pattern: /applebot/i, name: 'Apple', type: 'apple' },
    { pattern: /petalbot/i, name: '华为花瓣', type: 'petal' },
    { pattern: /bytespider/i, name: '字节', type: 'bytedance' },
  ];
  
  for (const spider of spiders) {
    if (spider.pattern.test(ua)) {
      return { name: spider.name, type: spider.type };
    }
  }
  return null;
}

/**
 * 记录爬虫访问日志
 * @param {Object} env - Cloudflare KV 环境
 * @param {string} ip - 访问者 IP
 * @param {string} ua - User-Agent
 * @param {string} spiderName - 爬虫名称
 * @param {string} path - 请求路径
 */
async function logSpiderAccess(env, ip, ua, spiderName, path) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `logs:spider:${today}`;
    const data = await env.SETTINGS.get(key);
    const logs = data ? JSON.parse(data) : [];
    logs.push({
      ip,
      ua,
      spider: spiderName,
      path: path || '/',
      timestamp: Date.now()
    });
    // 每天最多保留 200 条记录
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    await env.SETTINGS.put(key, JSON.stringify(logs));
  } catch (e) { /* 静默失败 */ }
}

/**
 * 翻译请求入口
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const startTime = Date.now();
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const clientCountry = request.headers.get('cf-ipcountry') || null;
  const userAgent = request.headers.get('user-agent') || '';

  // 检测爬虫并记录
  const spider = detectSpider(userAgent);
  if (spider) {
    await logSpiderAccess(env, clientIp, userAgent, spider.name, '/api/translate');
  }

  try {
    const body = await request.json();
    let { text, sourceLang, targetLang, provider, model, nocache } = body;

    if (!text || !text.trim()) return errorResponse('文本不能为空');

    // 预处理：清理不可见字符和异常编码
    text = sanitizeInput(text);
    if (!text) return errorResponse('文本预处理后为空');

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
    const configProviders = config.providers || {};

    // 确定使用的翻译提供商和模型
    let prov = provider;
    let useModel = model;

    if (!prov) {
      // 从管理员配置中获取第一个启用的第三方提供商
      const enabledProviders = Object.entries(configProviders)
        .filter(([pId, pConfig]) => pConfig?.enabled)
        .map(([pId]) => pId);

      if (enabledProviders.length > 0) {
        prov = enabledProviders[0];
      } else {
        return errorResponse('请先在管理后台配置并启用第三方翻译 API Key', 401);
      }
    }

    if (!useModel) {
      // 从管理员配置中获取该提供商启用的第一个模型
      const provConfig = configProviders[prov];
      if (provConfig?.modelEnabled && provConfig.modelEnabled.length > 0) {
        useModel = provConfig.modelEnabled[0];
      } else {
        useModel = PROVIDERS[prov]?.defaultModel || 'gpt-4o-mini';
      }
    }

    // 缓存哈希（用于写入缓存）
    const cacheHash = simpleHash(text.trim().toLowerCase() + '|' + srcLang + '|' + targetLang);

    // 执行翻译
    const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
    const adminKeys = apiKeysData ? JSON.parse(apiKeysData) : {};

    let result;

    // 如果指定了provider且有对应的API Key，直接使用该provider
    if (prov && adminKeys[prov]?.apiKey) {
      try {
        result = await translateWithExternal(
          text, srcLang, targetLang, prov, useModel,
          adminKeys[prov].apiKey,
          adminKeys[prov].customEndpoint || '',
          promptTemplates
        );
        await logAccess(env, clientIp, srcLang, targetLang, prov, text.length, true, Date.now() - startTime, clientCountry);
      } catch (err) {
        await logAccess(env, clientIp, srcLang, targetLang, prov, text.length, false, Date.now() - startTime, clientCountry);
        // 故障转移：尝试其他启用的第三方提供商
        const fallbackKeys = Object.entries(adminKeys)
          .filter(([pId]) => pId !== prov && configProviders[pId]?.enabled && adminKeys[pId]?.apiKey);
        let translated = false;
        for (const [fbId, fbKey] of fallbackKeys) {
          try {
            const fbModel = configProviders[fbId]?.modelEnabled?.[0] || PROVIDERS[fbId]?.defaultModel || 'gpt-4o-mini';
            result = await translateWithExternal(
              text, srcLang, targetLang, fbId, fbModel,
              typeof fbKey === 'string' ? fbKey : fbKey.apiKey,
              (typeof fbKey === 'object' ? fbKey.customEndpoint : '') || '',
              promptTemplates
            );
            await logAccess(env, clientIp, srcLang, targetLang, fbId, text.length, true, Date.now() - startTime, clientCountry);
            translated = true;
            break;
          } catch { continue; }
        }
        if (!translated) throw err;
      }
    } else {
      // 智能路由：从启用的第三方提供商中选择
      const enabledKeys = Object.entries(adminKeys)
        .filter(([pId]) => configProviders[pId]?.enabled && adminKeys[pId]?.apiKey);
      if (enabledKeys.length === 0) {
        return errorResponse('请先在管理后台配置并启用第三方翻译 API Key', 401);
      }
      let translated = false;
      let lastError = null;
      for (const [pId, k] of enabledKeys) {
        try {
          const kd = typeof k === 'object' ? k : { apiKey: k, customEndpoint: '' };
          const pModel = configProviders[pId]?.modelEnabled?.[0] || PROVIDERS[pId]?.defaultModel || 'gpt-4o-mini';
          result = await translateWithExternal(
            text, srcLang, targetLang, pId, pModel,
            kd.apiKey, kd.customEndpoint || '', promptTemplates
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

    await recordStats(env, clientIp, result.tokens);

    // 质量检查
    const qualityIssues = checkTranslationQuality(result.translatedText, text, sourceLang, targetLang);
    if (qualityIssues.length > 0) {
      console.warn('翻译质量警告:', qualityIssues.join(', '), '| 原文:', text.slice(0, 100));
    }

    // 写入翻译缓存（24小时过期）
    try {
      const cacheKey = `cache:translate:${cacheHash}`;
      await env.SETTINGS.put(cacheKey, JSON.stringify({
        translatedText: result.translatedText,
        provider: prov,
        createdAt: Date.now()
      }), { expirationTtl: 86400 });
    } catch {}

    return jsonResponse({
      translatedText: result.translatedText,
      sourceLang: result.detectedSourceLang || srcLang,
      targetLang,
      provider: prov,
      model: useModel,
      qualityWarnings: qualityIssues
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

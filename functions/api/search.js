/**
 * 联网搜索 API - 完整工作流
 *
 * 流程：用户输入 → 真实搜索引擎请求 → HTML内容清洗 → LLM分析提纯 → 输出给用户
 */

// ====== AI 提供商配置（复用翻译模块的配置）======
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

// ====== 搜索引擎配置（真实请求 URL + User-Agent）======
const SEARCH_ENGINES = {
  bing: {
    name: '必应',
    // 使用 Bing 国际版，返回更干净的 HTML
    url: 'https://www.bing.com/search?q=',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  baidu: {
    name: '百度',
    url: 'https://www.baidu.com/s?wd=',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  sogou: {
    name: '搜狗',
    url: 'https://www.sogou.com/web?query=',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  yandex: {
    name: 'Yandex',
    url: 'https://yandex.com/search/?text=',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

/* ========== 工具函数 ========== */
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

/**
 * 步骤1: 向真实搜索引擎发起请求，获取原始 HTML
 */
async function fetchSearchPage(engine, query) {
  const engineConfig = SEARCH_ENGINES[engine];
  if (!engineConfig) throw new Error(`不支持的搜索引擎: ${engine}`);

  const searchUrl = engineConfig.url + encodeURIComponent(query);

  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': engineConfig.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache'
    }
  });

  if (!res.ok) {
    throw new Error(`${engineConfig.name} 搜索请求失败 (${res.status})`);
  }

  return await res.text();
}

/**
 * 步骤2: 清洗搜索结果 HTML，提取结构化数据
 * 从原始 HTML 中提取标题、链接、摘要文本，去除广告、脚本、样式等噪音
 */
function cleanSearchResults(html, engine) {
  const results = [];

  switch (engine) {
    case 'bing':
      results.push(...extractBingResults(html));
      break;
    case 'baidu':
      results.push(...extractBaiduResults(html));
      break;
    case 'sogou':
      results.push(...extractSogouResults(html));
      break;
    case 'yandex':
      results.push(...extractYandexResults(html));
      break;
  }

  return results;
}

/**
 * 提取 Bing 搜索结果
 * Bing 的结果在 <li class="b_algo"> 中，包含 <h2><a> 标题链接 和 <p> 或 <div> 摘要
 */
function extractBingResults(html) {
  const results = [];
  // 匹配 b_algo 块
  const algoRegex = /<li[^>]*class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = algoRegex.exec(html)) !== null && results.length < 10) {
    const block = match[1];

    // 提取标题和链接
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    // 提取摘要（多种可能的标签）
    const snippetMatch = block.match(/<(?:p|div)[^>]*class="(?:b_caption|b_algoSlug)"[^>]*>([\s\S]*?)<\/(?:p|div)>/i)
      || block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

    if (titleMatch) {
      const title = stripHtmlTags(titleMatch[2]).trim();
      const url = titleMatch[1];
      const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]).trim() : '';

      if (title && url && !isAdUrl(url)) {
        results.push({ title, url, snippet });
      }
    }
  }

  return results;
}

/**
 * 提取百度搜索结果
 * 百度结果在 .result 或 .c-container 中
 */
function extractBaiduResults(html) {
  const results = [];
  // 百度搜索结果容器
  const resultRegex = /<div[^>]*(?:class="result[^"]*"|class="c-result[^"]*")[^>]*>([\s\S]*?)(?=<\/div>\s*(?:<div[^>]*(?:class="result|class="c-result)|$))/gi;
  let match;

  // 备用方案：匹配 h3 + 链接模式
  const h3Regex = /<h3[^>]*class="[^"]*t[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*data-url="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  while ((match = h3Regex.exec(html)) !== null && results.length < 10) {
    const rawUrl = match[1] || match[2]; // data-url 是真实 URL（百度会加密 href）
    const title = stripHtmlTags(match[3]).trim();

    if (title && rawUrl) {
      // 尝试获取附近摘要文本
      const afterH3 = html.substring(match.index);
      const snippetMatch = afterH3.match(/<span[^>]*class="[^"]*content-right[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
        || afterH3.match(/<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

      const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]).trim().slice(0, 150) : '';

      // 过滤广告
      if (!title.includes('推广') && !title.includes('广告')) {
        results.push({
          title,
          url: rawUrl.startsWith('http') ? rawUrl : `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`,
          snippet
        });
      }
    }
  }

  // 如果上面的提取没结果，用更宽松的模式
  if (results.length === 0) {
    const looseRegex = /<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = looseRegex.exec(html)) !== null && results.length < 6) {
      const title = stripHtmlTags(match[1]).trim();
      if (title && title.length > 3 && !title.includes('推广') && !title.includes('广告')) {
        results.push({ title, url: '', snippet: '' });
      }
    }
  }

  return results;
}

/**
 * 提取搜狗搜索结果
 */
function extractSogouResults(html) {
  const results = [];
  // 搜狗结果在 .vrwrap 或 .rb 中
  const vrRegex = /<div[^>]*class="vrwrap"[^>]*>([\s\S]*?)<\/div>\s*(?=<\/div>|$)/gi;
  let match;

  while ((match = vrRegex.exec(html)) !== null && results.length < 10) {
    const block = match[1];
    const titleMatch = block.match(/<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/<p[^>]*class="[^"]*str-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

    if (titleMatch) {
      const title = stripHtmlTags(titleMatch[2]).trim();
      const url = titleMatch[1];
      const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]).trim() : '';

      if (title && !title.includes('推广')) {
        results.push({ title, url, snippet });
      }
    }
  }

  // 备用：更宽泛的 h3 匹配
  if (results.length === 0) {
    const h3Regex = /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = h3Regex.exec(html)) !== null && results.length < 6) {
      const title = stripHtmlTags(match[2]).trim();
      if (title && title.length > 3) {
        results.push({ title, url: match[1], snippet: '' });
      }
    }
  }

  return results;
}

/**
 * 提取 Yandex 搜索结果
 */
function extractYandexResults(html) {
  const results = [];
  // Yandex 结果在 li.organic 中
  const organicRegex = /<li[^>]*class="serp-item[^"]*"[^>]*data-cid="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = organicRegex.exec(html)) !== null && results.length < 10) {
    const block = match[2];
    const titleMatch = block.match(/<h3[^>]*class="[^"]*OrganicTitle[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetContainer = block.match(/<div[^>]*class="[^"]*text-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const snippetMatch = snippetContainer ? snippetContainer[1].match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i) : null;

    if (titleMatch) {
      const title = stripHtmlTags(titleMatch[2]).trim();
      const url = titleMatch[1];
      const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]).trim() : '';

      if (title) {
        results.push({ title, url, snippet });
      }
    }
  }

  // 备用方案
  if (results.length === 0) {
    const linkRegex = /<a[^>]*class="[^"]*Link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && results.length < 6) {
      const title = stripHtmlTags(match[2]).trim();
      if (title && title.length > 3 && match[1].startsWith('http')) {
        results.push({ title, url: match[1], snippet: '' });
      }
    }
  }

  return results;
}

/**
 * 去除 HTML 标签，保留纯文本
 */
function stripHtmlTags(str) {
  if (!str) return '';
  return str
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')           // 去除所有HTML标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')             // 去除数字实体
    .replace(/\s+/g, ' ')               // 合并空白
    .trim();
}

/**
 * 判断是否为广告 URL
 */
function isAdUrl(url) {
  if (!url) return false;
  const adPatterns = [
    /ad\.doubleclick\.net/,
    /googleadservices/,
    /adservice\.google/,
    /bing\.com.*ckbk/,
    /baidu\.com.*ad/
  ];
  return adPatterns.some(p => p.test(url));
}

/**
 * 步骤3: 将清洗后的搜索结果发给 LLM 进行分析提纯
 * LLM 对原始结果进行去重、相关性排序、信息整合、生成最终回答
 */
async function purifyWithLLM(query, rawResults, engineName, apiKey, provider, model, baseUrl, fileContext, skillPrompt) {
  // 构建清洗后的原始结果文本
  const resultsText = rawResults.map((r, i) =>
    `[${i + 1}] 标题: ${r.title}\n   链接: ${r.url}\n   摘要: ${r.snippet || '(无摘要)'}`
  ).join('\n\n');

  // 构建系统提示词：基础搜索分析要求 + 可选的技能提示词
  let systemPrompt = `你是一个专业的搜索结果分析助手。用户通过「${engineName}」搜索引擎进行了查询。
你的任务是对搜索结果进行分析、提纯和总结。

要求：
1. 去除重复或低质量的结果
2. 按与问题的相关程度排序
3. 整合多个来源的信息，给出全面而准确的回答
4. 如果搜索结果不足以回答问题，明确说明
5. 回答要简洁、有条理，使用 Markdown 格式

请直接输出分析后的最终答案，不要输出"根据搜索结果"之类的过渡语。`;

  // 如果有技能提示词（如"翻译助手"、"代码解释"），追加到系统提示词中
  if (skillPrompt) {
    systemPrompt += `\n\n---\n【用户激活的技能/角色设定】\n${skillPrompt}\n请结合以上技能设定来分析和回答问题。`;
  }

  // 构建用户内容：搜索结果 + 可选的文件上下文
  let userContent = `搜索关键词: ${query}

以下是${engineName}引擎返回的原始搜索结果：

${resultsText}

请基于以上搜索结果，对问题"${query}"进行详细分析和回答。`;

  // 如果有上传文件，附加文件内容作为补充参考
  if (fileContext) {
    userContent += `\n\n---\n以下是用户上传的参考文件内容（请结合搜索结果和文件内容综合分析）：\n\n${fileContext}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  // 构建请求头（兼容不同 AI 提供商）
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    delete headers['Authorization'];
  }

  // 构建请求体
  const body = {
    model: model,
    messages,
    max_tokens: 3000,
    temperature: 0.3  // 低温度确保回答稳定准确
  };

  const endpoint = provider === 'anthropic'
    ? `${baseUrl}/messages`
    : `${baseUrl}/chat/completions`;

  // Anthropic 需要特殊处理 system 消息
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
    throw new Error(`LLM 分析请求失败 (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = provider === 'anthropic'
    ? data.content?.[0]?.text
    : data.choices?.[0]?.message?.content;

  if (!content) throw new Error('LLM 返回空结果');

  return content;
}

/**
 * 获取第一个可用的 AI 提供商（从后台配置中读取）
 */
async function getFirstAvailableProvider(env) {
  // 读取 AI 提供商配置
  const configData = await env.SETTINGS.get('admin:config');
  const config = configData ? JSON.parse(configData) : {};
  const configProviders = config.providers || {};

  // 读取 API Key 配置
  const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
  const adminKeys = apiKeysData ? JSON.parse(apiKeysData) : {};

  // 遍历已启用的提供商，找到第一个有 Key 的
  for (const [provId, provConfig] of Object.entries(configProviders)) {
    if (provConfig?.enabled && adminKeys[provId]?.apiKey) {
      const prov = PROVIDERS[provId];
      if (!prov || !prov.baseUrl) continue;
      const model = provConfig.modelEnabled?.[0] || prov.defaultModel;
      return {
        provider: provId,
        apiKey: adminKeys[provId].apiKey,
        model,
        baseUrl: adminKeys[provId].customEndpoint || prov.baseUrl
      };
    }
  }
  return null;
}

/**
 * 校验搜索引擎是否已在后台启用
 */
async function isEngineEnabled(engine, env) {
  const data = await env.SETTINGS.get('admin:searchConfig');
  if (!data) return true; // 无配置则默认全部启用
  const config = JSON.parse(data);
  return config[engine]?.enabled !== false;
}

/**
 * 主入口：处理搜索请求
 * 完整流程：用户输入 → 真实搜索 → 内容清洗 → LLM提纯 → 输出
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { query, engine, fileContext, skillPrompt } = body;

    // 参数校验
    if (!query || !query.trim()) return errorResponse('搜索关键词不能为空');
    const trimmedQuery = query.trim();

    const searchEngine = engine || 'bing';
    if (!SEARCH_ENGINES[searchEngine]) {
      return errorResponse('不支持的搜索引擎，可选: bing, baidu, sogou, yandex');
    }

    // 校验搜索引擎是否已启用
    const enabled = await isEngineEnabled(searchEngine, env);
    if (!enabled) {
      return errorResponse(`搜索引擎「${SEARCH_ENGINES[searchEngine].name}」已被管理员禁用`);
    }

    // 获取可用的 AI 提供商（用于后续 LLM 提纯）
    const aiProvider = await getFirstAvailableProvider(env);
    if (!aiProvider) {
      return errorResponse('请先在管理后台配置并启用 AI API Key');
    }

    // ====== 步骤1: 向真实搜索引擎发起请求 ======
    let rawHtml;
    try {
      rawHtml = await fetchSearchPage(searchEngine, trimmedQuery);
    } catch (fetchErr) {
      // 如果真实搜索失败，降级为 AI 直接搜索（至少保证有结果）
      console.warn(`真实搜索失败，降级为AI模拟搜索: ${fetchErr.message}`);
      return await fallbackToAISearch(trimmedQuery, searchEngine, aiProvider, fileContext || undefined, skillPrompt || undefined);
    }

    // ====== 步骤2: 清洗 HTML，提取结构化搜索结果 ======
    const rawResults = cleanSearchResults(rawHtml, searchEngine);

    // 如果清洗后没有有效结果，也降级
    if (rawResults.length === 0) {
      console.warn('未从搜索页面提取到有效结果，降级为AI模拟搜索');
      return await fallbackToAISearch(trimmedQuery, searchEngine, aiProvider, fileContext || undefined, skillPrompt || undefined);
    }

    // ====== 步骤3: LLM 分析提纯（含文件上下文 + 技能提示词）======
    const purifiedAnswer = await purifyWithLLM(
      trimmedQuery,
      rawResults,
      SEARCH_ENGINES[searchEngine].name,
      aiProvider.apiKey,
      aiProvider.provider,
      aiProvider.model,
      aiProvider.baseUrl,
      fileContext || undefined,   // 文件上下文
      skillPrompt || undefined   // 技能提示词
    );

    // 返回最终结果
    return jsonResponse({
      engine: SEARCH_ENGINES[searchEngine].name,
      engineKey: searchEngine,
      query: trimmedQuery,
      answer: purifiedAnswer,          // LLM 提纯后的最终答案
      sourceCount: rawResults.length,  // 来源数量
      sources: rawResults.slice(0, 5), // 前5条来源（供前端展示）
      pipeline: 'real-search'          // 标记使用了真实搜索流水线
    });

  } catch (err) {
    return errorResponse(err.message || '搜索失败', 500);
  }
}

/**
 * 降级方案：当真实搜索失败时，使用 AI 模拟搜索
 * 至少保证用户能获得一个答案
 */
async function fallbackToAISearch(query, engine, aiProvider, fileContext, skillPrompt) {
  const engineName = SEARCH_ENGINES[engine]?.name || '搜索引擎';

  // 构建系统提示词：基础降级搜索 + 可选技能提示词
  let systemPrompt = `你是一个专业的联网搜索助手。请基于你的知识库，模拟使用「${engineName}」搜索引擎查找以下问题的答案。
注意：由于无法连接到真实搜索引擎，请你基于自身知识尽可能准确地回答。如果信息可能已过时，请提醒用户确认最新信息。`;

  if (skillPrompt) {
    systemPrompt += `\n\n---\n【用户激活的技能/角色设定】\n${skillPrompt}\n请结合以上技能设定来回答问题。`;
  }

  // 构建用户消息：搜索问题 + 可选文件上下文
  let userMsg = `搜索: ${query}`;
  if (fileContext) {
    userMsg += `\n\n---\n用户上传的参考文件内容：\n\n${fileContext}`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMsg }
  ];

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiProvider.apiKey}` };
  if (aiProvider.provider === 'anthropic') {
    headers['x-api-key'] = aiProvider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    delete headers['Authorization'];
  }

  const body = {
    model: aiProvider.model,
    messages,
    max_tokens: 2048,
    temperature: 0.3
  };

  const endpoint = aiProvider.provider === 'anthropic'
    ? `${aiProvider.baseUrl}/messages`
    : `${aiProvider.baseUrl}/chat/completions`;

  if (aiProvider.provider === 'anthropic') {
    body.messages = [messages[1]];
    body.system = messages[0].content;
  }

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`AI 降级搜索也失败了 (${res.status})`);

  const data = await res.json();
  const content = aiProvider.provider === 'anthropic'
    ? data.content?.[0]?.text
    : data.choices?.[0]?.message?.content;

  if (!content) throw new Error('AI 返回空结果');

  return jsonResponse({
    engine: engineName,
    engineKey: engine,
    query,
    answer: content,
    sourceCount: 0,
    sources: [],
    pipeline: 'ai-fallback'  // 标记使用了 AI 降级
  });
}
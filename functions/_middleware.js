/**
 * 全局中间件 - 拦截所有页面请求，检测爬虫访问并记录日志
 * 搜索引擎爬虫通常用 GET 请求爬取页面，不会 POST 到翻译 API
 * 此中间件确保所有页面被爬虫访问时都能被记录下来
 */

// 爬虫 User-Agent 检测规则
function detectSpider(ua) {
  if (!ua) return null;
  const spiders = [
    { pattern: /googlebot/i, name: 'Google' },
    { pattern: /bingbot|msnbot/i, name: 'Bing' },
    { pattern: /baiduspider/i, name: '百度' },
    { pattern: /sogou (spider|web)/i, name: '搜狗' },
    { pattern: /soso.*spider/i, name: '搜搜' },
    { pattern: /360spider|haosouspider/i, name: '360' },
    { pattern: /yandexbot/i, name: 'Yandex' },
    { pattern: /duckduckbot/i, name: 'DuckDuckGo' },
    { pattern: /facebookexternalhit|facebot/i, name: 'Facebook' },
    { pattern: /twitterbot/i, name: 'Twitter' },
    { pattern: /linkedinbot/i, name: 'LinkedIn' },
    { pattern: /applebot/i, name: 'Apple' },
    { pattern: /petalbot/i, name: '华为花瓣' },
    { pattern: /bytespider/i, name: '字节' },
    { pattern: /slurp/i, name: 'Yahoo' },
    { pattern: /ia_archiver|alexa/i, name: 'Alexa' },
    { pattern: /ahrefsbot/i, name: 'Ahrefs' },
    { pattern: /semrushbot/i, name: 'Semrush' },
    { pattern: /dotbot/i, name: 'Moz' },
    { pattern: /mj12bot/i, name: 'Majestic' },
    { pattern: /rogerbot/i, name: 'Roger' },
    { pattern: /exabot/i, name: 'Exalead' },
    { pattern: /blexbot/i, name: 'Blexb' },
    { pattern: /seznambot/i, name: 'Seznam' },
    { pattern: /mauibot/i, name: 'Maui' },
    { pattern: /gptbot|chatgpt/i, name: 'ChatGPT' },
    { pattern: /anthropic|claude/i, name: 'Claude' },
    { pattern: /perplexity/i, name: 'Perplexity' },
    { pattern: /commoncrawl|ccbot/i, name: 'CommonCrawl' },
  ];
  for (const spider of spiders) {
    if (spider.pattern.test(ua)) return spider;
  }
  return null;
}

// 记录爬虫访问到 KV
async function logSpiderAccess(env, ip, ua, spiderName, path) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `logs:spider:${today}`;
    const data = await env.SETTINGS.get(key);
    const logs = data ? JSON.parse(data) : [];
    logs.push({ ip, ua, spider: spiderName, path: path || '/', timestamp: Date.now() });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    await env.SETTINGS.put(key, JSON.stringify(logs));
  } catch (e) { /* 静默失败，不影响正常请求 */ }
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const ua = request.headers.get('user-agent') || '';
    const spider = detectSpider(ua);

    if (spider) {
      const url = new URL(request.url);
      const path = url.pathname;

      // /api/translate 自身已记录爬虫，避免重复
      if (path === '/api/translate') return context.next();

      const ip = request.headers.get('cf-connecting-ip') || 'unknown';

      // 使用 writeable stream + waitUntil 确保日志写入
      // 但要确保 SETTINGS KV 存在（可能在本地开发时没有）
      if (env.SETTINGS) {
        context.waitUntil(logSpiderAccess(env, ip, ua, spider.name, path));
      }
    }
  } catch (e) {
    // 中间件出错不影响正常请求
  }

  return context.next();
}
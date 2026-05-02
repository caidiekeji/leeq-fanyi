function verifyToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token));
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch { return false; }
}

const DEFAULT_SEO = {
  title: 'LeeQ 翻译',
  description: '基于大语言模型的多语言翻译工具，支持20+种语言互译',
  keywords: '翻译,多语言,LLM,翻译工具,LeeQ',
  ogImage: ''
};

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const data = await env.SETTINGS.get('admin:seo');
    const seo = data ? JSON.parse(data) : DEFAULT_SEO;
    return new Response(JSON.stringify({ code: 200, data: seo, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request)) {
    return new Response(JSON.stringify({ code: 401, data: null, message: '未授权' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { title, description, keywords, ogImage } = await request.json();
    const seo = {
      title: title || DEFAULT_SEO.title,
      description: description || DEFAULT_SEO.description,
      keywords: keywords || DEFAULT_SEO.keywords,
      ogImage: ogImage || ''
    };
    await env.SETTINGS.put('admin:seo', JSON.stringify(seo));
    return new Response(JSON.stringify({ code: 200, data: seo, message: '保存成功' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

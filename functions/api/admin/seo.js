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
  title: 'LeeQ 翻译 - 基于大语言模型的智能多语言翻译工具',
  description: 'LeeQ 翻译是一款基于大语言模型（LLM）的智能多语言翻译工具。支持 20+ 种语言互译，智能语言检测，格式完美保留，为您提供快速、精准、专业的翻译服务。',
  keywords: 'LeeQ 翻译，在线翻译，多语言翻译，LLM 翻译，大语言模型翻译，智能翻译，AI 翻译，格式保留翻译，免费翻译工具，文本翻译，语言互译',
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

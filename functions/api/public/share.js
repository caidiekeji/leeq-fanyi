export async function onRequestGet(context) {
  const { request } = context;
  try {
    const url = new URL(request.url);
    const text = url.searchParams.get('text') || '';
    const sourceLang = url.searchParams.get('source') || 'auto';
    const targetLang = url.searchParams.get('target') || 'zh';
    if (!text) {
      return new Response(JSON.stringify({ code: 400, data: null, message: '缺少文本参数' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      code: 200,
      data: { text: decodeURIComponent(text), sourceLang, targetLang },
      message: 'success'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

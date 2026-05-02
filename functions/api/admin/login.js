export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ code: 400, data: null, message: '请求格式错误' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const { password } = body || {};
    const adminPassword = env.ADMIN_PASSWORD || 'admin123';
    if (password !== adminPassword) {
      return new Response(JSON.stringify({ code: 401, data: null, message: '密码错误' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const token = btoa(JSON.stringify({ role: 'admin', exp: Date.now() + 86400000 }));
    return new Response(JSON.stringify({ code: 200, data: { token }, message: 'success' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message || '服务器错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

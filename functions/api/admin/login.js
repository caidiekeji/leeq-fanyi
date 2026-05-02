export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

    // 登录防爆破：检查该IP是否被锁定
    const lockKey = `security:lockout:${clientIp}`;
    const lockData = await env.SETTINGS.get(lockKey);
    if (lockData) {
      const lock = JSON.parse(lockData);
      if (lock.until > Date.now()) {
        const remaining = Math.ceil((lock.until - Date.now()) / 60000);
        return new Response(JSON.stringify({
          code: 429, data: null, message: `登录尝试过于频繁，请 ${remaining} 分钟后重试`
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
    }

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
      // 记录失败次数
      const failKey = `security:fail:${clientIp}`;
      let failCount = 0;
      const failData = await env.SETTINGS.get(failKey);
      if (failData) {
        const fail = JSON.parse(failData);
        failCount = fail.count || 0;
        fail.count = failCount + 1;
        fail.lastAttempt = Date.now();
        await env.SETTINGS.put(failKey, JSON.stringify(fail));
      } else {
        await env.SETTINGS.put(failKey, JSON.stringify({ count: 1, lastAttempt: Date.now() }));
      }
      failCount++;

      // 连续5次失败后锁定15分钟
      if (failCount >= 5) {
        await env.SETTINGS.put(lockKey, JSON.stringify({
          until: Date.now() + 15 * 60 * 1000,
          reason: '连续5次登录失败'
        }));
        return new Response(JSON.stringify({
          code: 429, data: null, message: '登录尝试过于频繁，请 15 分钟后重试'
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        code: 401, data: null, message: `密码错误，还剩 ${5 - failCount} 次尝试机会`
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // 登录成功，清除失败记录
    await env.SETTINGS.delete(`security:fail:${clientIp}`).catch(() => {});
    await env.SETTINGS.delete(lockKey).catch(() => {});

    const token = btoa(JSON.stringify({ role: 'admin', exp: Date.now() + 86400000 }));
    return new Response(JSON.stringify({ code: 200, data: { token }, message: '登录成功' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, data: null, message: err.message || '服务器错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

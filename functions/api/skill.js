/**
 * 技能（提示词模板）管理 API
 * 支持技能的增删改查，存储在 KV 中
 */

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
 * 获取全部技能列表（公开接口，无需认证）
 */
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const data = await env.SETTINGS.get('admin:skills');
    const skills = data ? JSON.parse(data) : [];
    return jsonResponse(skills);
  } catch (err) {
    return errorResponse('获取技能列表失败: ' + err.message, 500);
  }
}

/**
 * 保存技能配置（管理员专用）
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    // 如果 body 是数组，直接保存为技能列表
    if (Array.isArray(body)) {
      await env.SETTINGS.put('admin:skills', JSON.stringify(body));
      return jsonResponse({ skills: body, count: body.length });
    }
    return errorResponse('请求格式错误：需要技能数组');
  } catch (err) {
    return errorResponse('保存技能失败: ' + err.message, 500);
  }
}
/**
 * TTS 语音合成代理 - 解决 HTTPS 页面无法请求 HTTP API 的问题
 * 接收前端请求，转发到内网 TTS 服务，返回音频二进制数据
 */
var TTS_API_URL = 'http://123.156.40.66:5050/v1/audio/speech';
var TTS_API_KEY = 'Bearer leeq-12311';

// 音频格式对应的 MIME 类型
var MIME_MAP = {
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/l16'
};

// 使用 onRequest 统一处理所有方法，避免 Cloudflare Pages 方法路由问题
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ code: 405, data: null, message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  var body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ code: 400, data: null, message: '请求体格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  var input = (body.input || '').trim();
  if (!input) {
    return new Response(JSON.stringify({ code: 400, data: null, message: '请输入文字内容' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  var voice = body.voice || 'zh-CN-XiaoxiaoNeural';
  var format = body.response_format || 'mp3';
  var speed = parseFloat(body.speed) || 1;

  // 转发到 TTS API
  var ttsRes;
  try {
    ttsRes = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': TTS_API_KEY
      },
      body: JSON.stringify({
        input: input,
        voice: voice,
        response_format: format,
        speed: speed
      })
    });
  } catch (e) {
    return new Response(JSON.stringify({ code: 502, data: null, message: 'TTS 服务连接失败' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!ttsRes.ok) {
    var errText = '';
    try { errText = await ttsRes.text(); } catch (e) {}
    return new Response(JSON.stringify({ code: ttsRes.status, data: null, message: errText || 'TTS 生成失败' }), {
      status: ttsRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 直接透传音频二进制数据
  var audioData = await ttsRes.arrayBuffer();
  var contentType = MIME_MAP[format] || 'audio/mpeg';

  return new Response(audioData, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    }
  });
}
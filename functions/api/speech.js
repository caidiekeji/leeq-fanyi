/**
 * TTS 语音合成代理 - 代理到 https://tts1.lequ.pw
 */
export async function onRequest(context) {
  var TTS_BASE = 'https://tts1.lequ.pw/v1/audio/speech';
  var VOICES_URL = 'https://tts1.lequ.pw/v1/voices';
  var TTS_API_KEY = 'Bearer leeq-12311';

  var MIME_MAP = {
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav',
    pcm: 'audio/l16'
  };

  var request = context.request;

  // GET: 代理获取音色列表
  if (request.method === 'GET') {
    try {
      var voicesRes = await fetch(VOICES_URL, {
        headers: { 'Authorization': TTS_API_KEY }
      });
      var voicesData = await voicesRes.json();
      return new Response(JSON.stringify(voicesData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: '获取音色列表失败: ' + e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ code: 405, data: null, message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  var body;
  try {
    body = await request.json();
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

  var ttsRes;
  try {
    ttsRes = await fetch(TTS_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': TTS_API_KEY
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: input,
        voice: voice,
        response_format: format,
        speed: speed
      })
    });
  } catch (e) {
    return new Response(JSON.stringify({ code: 502, data: null, message: 'TTS 服务连接失败: ' + e.message }), {
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

  var audioBuffer = await ttsRes.arrayBuffer();
  var base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(audioBuffer)));
  var contentType = MIME_MAP[format] || 'audio/mpeg';

  return new Response(JSON.stringify({
    code: 200,
    data: { audio: base64, contentType: contentType, format: format },
    message: 'success'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
/**
 * 文件上传 API
 * 支持上传文本文件，读取内容并返回
 * 支持: txt, md, json, csv, js, py, html, css, xml, yaml, yml, log, env, cfg, ini, conf, sh, bat, ps1, sql, java, c, cpp, h, hpp, rs, go, ts, tsx, jsx, vue, svelte, php, rb, swift, kt, scala
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

// 支持的文件类型及扩展名
const SUPPORTED_EXTENSIONS = [
  '.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.log',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.rs', '.go', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte',
  '.html', '.css', '.scss', '.less',
  '.env', '.cfg', '.ini', '.conf', '.sh', '.bat', '.ps1', '.sql',
  '.rtf', '.tex', '.rst', '.org'
];

// 最大文件大小: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * 检测文件类型
 */
function getFileType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte', 'sql', 'sh', 'bat', 'ps1', 'css', 'scss', 'less'];
  const markupExtensions = ['html', 'xml', 'md', 'yaml', 'yml', 'json', 'csv'];

  if (codeExtensions.includes(ext)) return 'code';
  if (markupExtensions.includes(ext)) return 'markup';
  return 'text';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';

    // 支持两种上传方式：multipart/form-data 和 JSON
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !file.name) {
        return errorResponse('未选择文件');
      }

      const ext = '.' + file.name.toLowerCase().split('.').pop();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return errorResponse(`不支持的文件类型: ${ext}。支持的类型: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      }

      if (file.size > MAX_FILE_SIZE) {
        return errorResponse(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 5MB`);
      }

      const text = await file.text();
      if (!text.trim()) {
        return errorResponse('文件内容为空');
      }

      return jsonResponse({
        filename: file.name,
        size: file.size,
        type: getFileType(file.name),
        content: text,
        charCount: text.length
      });
    }

    // JSON 方式：直接传递文本内容
    const body = await request.json();
    const { content, filename } = body;

    if (!content || !content.trim()) {
      return errorResponse('内容不能为空');
    }

    return jsonResponse({
      filename: filename || 'text',
      size: content.length,
      type: 'text',
      content: content,
      charCount: content.length
    });
  } catch (err) {
    return errorResponse('文件上传失败: ' + err.message, 500);
  }
}
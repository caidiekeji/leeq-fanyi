/**
 * 内容检测 API - 调用大模型分析用户输入内容，生成专业判断报告
 * 支持：合规检测、质量评估、AI生成检测、敏感信息检测、事实核查
 */

// 大模型提供商配置（与 translate.js 保持一致）
const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-20250514' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-8b-instruct' },
  baidu: { baseUrl: 'https://qianfan.baidubce.com/v2', defaultModel: 'ernie-4.0-8k' },
  aliyun: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', defaultModel: 'abab6.5-chat' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  xunfei: { baseUrl: 'https://spark-api-open.xf-yun.com/v1', defaultModel: '4.0Ultra' },
  tencent: { baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', defaultModel: 'hunyuan-standard' },
  custom: { baseUrl: '', defaultModel: '' }
};

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

// 检测类型对应的系统提示词
const DETECT_PROMPTS = {
  compliance: `你是一名专业的内容合规审查专家。请对用户提供的文本进行全面的合规性检测。

检测维度：
1. 法律法规 - 是否含有违法内容、危害国家安全的信息
2. 暴力与色情 - 是否含有暴力、血腥、色情或低俗内容
3. 人身攻击 - 是否含有谩骂、侮辱、歧视或人身攻击
4. 虚假信息 - 是否含有明显的虚假信息或谣言
5. 侵权风险 - 是否涉嫌侵犯他人隐私、知识产权

请以 JSON 格式返回报告，格式如下：
{"overall": "合规/不通过","score": 85,"summary": "一句话总结","dimensions": [{"name": "维度名称","pass": true,"score": 90,"detail": "详细分析"}],"risks": [{"level": "高/中/低","content": "风险描述","suggestion": "建议"}],"conclusion": "最终结论"}`,

  quality: `你是一名资深内容编辑和写作专家。请对用户提供的文本进行专业质量评估。

评估维度：
1. 逻辑结构 - 文章结构是否清晰、逻辑是否连贯
2. 语言表达 - 用词是否精准、语句是否流畅、语法是否正确
3. 内容深度 - 信息量是否充足、观点是否有见地
4. 可读性 - 段落划分是否合理、是否适合目标读者
5. 格式规范 - 标点、排版等格式是否规范

请以 JSON 格式返回报告：
{"overall": "优秀/良好/一般/较差","score": 85,"summary": "一句话总结","dimensions": [{"name": "维度名称","score": 90,"detail": "详细分析","tip": "改进建议"}],"highlights": ["亮点描述"],"suggestions": ["改进建议1"],"conclusion": "总体评价"}`,

  aiDetection: `你是一名 AI 内容检测专家。请分析用户提供的文本，判断其是否由 AI 生成。

检测依据：
1. 语言模式 - AI 生成文本通常语言过于规整、缺乏个人风格
2. 内容多样性 - 是否存在重复的句式或过于平均的段落长度
3. 创造性 - 是否有独特观点、个人经历或创新表达
4. 细节密度 - 是否有具体的细节描述而非笼统概括
5. 语气一致性 - 全篇语气是否过于一致、缺乏自然的情感起伏

请以 JSON 格式返回报告：
{"isAI": true,"confidence": 85,"summary": "一句话总结","indicators": [{"name": "指标名称","score": 80,"evidence": "依据说明"}],"explanation": "详细分析说明","conclusion": "最终结论"}`,

  sensitiveInfo: `你是一名信息安全专家。请检测用户提供的文本中是否含有敏感信息。

检测类型：
1. 个人信息 - 姓名、身份证号、手机号、邮箱、地址
2. 账号密码 - API Key、Token、密码、密钥
3. 金融信息 - 银行卡号、支付信息
4. 商业机密 - 内部数据、未公开信息、商业策略
5. 联系方式 - 微信、QQ、电话号码

请以 JSON 格式返回报告：
{"hasSensitive": true,"score": 85,"summary": "一句话总结","items": [{"type": "信息类型","content": "脱敏后的内容片段","risk": "高/中/低","masked": "打码后的示例","suggestion": "处理建议"}],"totalCount": 3,"conclusion": "最终结论"}`

};

// 检测描述映射（前端显示用）
const DETECT_NAMES = {
  compliance: '合规性检测',
  quality: '质量评估',
  aiDetection: 'AI生成检测',
  sensitiveInfo: '敏感信息检测'
};

/**
 * POST /api/detect - 调用大模型检测内容
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { text, type } = body;

    if (!text || !text.trim()) return errorResponse('请输入要检测的内容');
    if (!type || !DETECT_PROMPTS[type]) return errorResponse('请选择有效的检测类型');
    if (text.length > 10000) return errorResponse('文本长度不能超过10000字符');

    // 读取管理员配置
    const configData = await env.SETTINGS.get('admin:config');
    const config = configData ? JSON.parse(configData) : {};
    const configProviders = config.providers || {};

    // 获取启用的提供商
    const enabledProviders = Object.entries(configProviders)
      .filter(([, pConfig]) => pConfig?.enabled)
      .map(([pId]) => pId);

    if (enabledProviders.length === 0) {
      return errorResponse('请先在管理后台配置并启用第三方 API Key', 500);
    }

    // 使用第一个启用的提供商
    const provider = enabledProviders[0];
    const provConfig = configProviders[provider];

    // 获取 API Key
    const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
    const adminKeys = apiKeysData ? JSON.parse(apiKeysData) : {};
    const apiKey = adminKeys[provider]?.apiKey;
    if (!apiKey) return errorResponse('未找到可用的 API Key，请检查后台配置', 500);

    // 获取模型
    const prov = PROVIDERS[provider];
    const useModel = provConfig?.modelEnabled?.[0] || prov?.defaultModel || 'gpt-4o-mini';
    const baseUrl = adminKeys[provider]?.customEndpoint || prov?.baseUrl;
    if (!baseUrl) return errorResponse('未配置 API 端点', 500);

    // 构建检测提示词
    const systemPrompt = DETECT_PROMPTS[type];
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请检测以下文本内容：\n\n${text.trim()}` }
    ];

    // 调用大模型
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    }

    const reqBody = {
      model: useModel,
      messages,
      max_tokens: 4096,
      temperature: 0.3,
      top_p: 0.9
    };

    const endpoint = provider === 'anthropic'
      ? `${baseUrl}/messages`
      : `${baseUrl}/chat/completions`;

    if (provider === 'anthropic') {
      reqBody.messages = messages.filter(m => m.role !== 'system');
      reqBody.system = messages[0].content;
    }

    const llmRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody)
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      throw new Error(`API 调用失败 (${llmRes.status}): ${err.slice(0, 200)}`);
    }

    const llmData = await llmRes.json();
    const rawText = provider === 'anthropic'
      ? llmData.content?.[0]?.text
      : llmData.choices?.[0]?.message?.content;

    if (!rawText) throw new Error('大模型返回为空，请重试');

    // 解析 JSON 报告
    let report;
    try {
      // 提取 JSON（可能包含 markdown 代码块）
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        report = JSON.parse(jsonMatch[0]);
      } else {
        // 如果无法提取 JSON，直接使用原始文本
        report = { raw: rawText, summary: rawText };
      }
    } catch {
      report = { raw: rawText, summary: rawText };
    }

    // 记录日志
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = `logs:detect:${today}`;
      const data = await env.SETTINGS.get(key);
      const logs = data ? JSON.parse(data) : [];
      logs.push({
        timestamp: Date.now(),
        type,
        textLength: text.length,
        provider,
        model: useModel
      });
      if (logs.length > 500) logs.splice(0, logs.length - 500);
      await env.SETTINGS.put(key, JSON.stringify(logs));
    } catch {}

    return jsonResponse({
      type,
      typeName: DETECT_NAMES[type] || type,
      report,
      metadata: { provider, model: useModel, textLength: text.length }
    });

  } catch (e) {
    return errorResponse(e.message || '检测服务异常，请稍后重试', 500);
  }
}
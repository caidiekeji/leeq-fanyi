/**
 * 获取翻译默认配置（公开接口，无需认证）
 * 前端用于获取管理员配置的默认翻译提供商和模型
 */

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

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 读取系统公开配置（无需认证）
    const systemData = await env.SETTINGS.get('admin:system');
    const systemConfig = systemData ? JSON.parse(systemData) : {};
    
    // 读取管理员配置
    const configData = await env.SETTINGS.get('admin:config');
    const config = configData ? JSON.parse(configData) : {};
    const configProviders = config.providers || {};

    // 读取API Keys配置
    const apiKeysData = await env.SETTINGS.get('admin:apiKeys');
    const apiKeys = apiKeysData ? JSON.parse(apiKeysData) : {};

    // 找到第一个启用的且有API Key的提供商
    let defaultProvider = null;
    let defaultModel = null;
    const availableProviders = [];

    for (const [pId, pConfig] of Object.entries(configProviders)) {
      if (pConfig?.enabled && apiKeys[pId]?.apiKey) {
        availableProviders.push({
          id: pId,
          name: pConfig.name || pId,
          models: pConfig.modelEnabled || []
        });
        if (!defaultProvider) {
          defaultProvider = pId;
          if (pConfig.modelEnabled && pConfig.modelEnabled.length > 0) {
            defaultModel = pConfig.modelEnabled[0];
          } else {
            defaultModel = PROVIDERS[pId]?.defaultModel || 'gpt-4o-mini';
          }
        }
      }
    }

    return new Response(JSON.stringify({
      code: 200,
      data: {
        // 系统公开配置
        siteName: systemConfig.siteName || null,
        announcement: systemConfig.announcement || null,
        footer: systemConfig.footer || null,
        maxCharLimit: systemConfig.maxCharLimit || 5000,
        defaultSourceLang: systemConfig.defaultSourceLang || 'auto',
        defaultTargetLang: systemConfig.defaultTargetLang || 'zh',
        // 翻译配置
        defaultProvider,
        defaultModel,
        availableProviders,
        message: defaultProvider ? 'success' : '请先在管理后台配置并启用第三方翻译服务'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      code: 500,
      data: null,
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

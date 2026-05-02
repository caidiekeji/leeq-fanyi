export async function onRequestGet() {
  const languages = [
    { code: 'zh', name: '中文', nameEn: 'Chinese' },
    { code: 'en', name: '英语', nameEn: 'English' },
    { code: 'ja', name: '日语', nameEn: 'Japanese' },
    { code: 'ko', name: '韩语', nameEn: 'Korean' },
    { code: 'fr', name: '法语', nameEn: 'French' },
    { code: 'de', name: '德语', nameEn: 'German' },
    { code: 'es', name: '西班牙语', nameEn: 'Spanish' },
    { code: 'ru', name: '俄语', nameEn: 'Russian' },
    { code: 'pt', name: '葡萄牙语', nameEn: 'Portuguese' },
    { code: 'it', name: '意大利语', nameEn: 'Italian' },
    { code: 'ar', name: '阿拉伯语', nameEn: 'Arabic' },
    { code: 'hi', name: '印地语', nameEn: 'Hindi' },
    { code: 'th', name: '泰语', nameEn: 'Thai' },
    { code: 'vi', name: '越南语', nameEn: 'Vietnamese' },
    { code: 'id', name: '印尼语', nameEn: 'Indonesian' },
    { code: 'nl', name: '荷兰语', nameEn: 'Dutch' },
    { code: 'pl', name: '波兰语', nameEn: 'Polish' },
    { code: 'tr', name: '土耳其语', nameEn: 'Turkish' },
    { code: 'sv', name: '瑞典语', nameEn: 'Swedish' },
    { code: 'da', name: '丹麦语', nameEn: 'Danish' },
    { code: 'fi', name: '芬兰语', nameEn: 'Finnish' },
    { code: 'el', name: '希腊语', nameEn: 'Greek' },
    { code: 'cs', name: '捷克语', nameEn: 'Czech' },
    { code: 'ro', name: '罗马尼亚语', nameEn: 'Romanian' },
    { code: 'hu', name: '匈牙利语', nameEn: 'Hungarian' },
    { code: 'uk', name: '乌克兰语', nameEn: 'Ukrainian' },
    { code: 'bg', name: '保加利亚语', nameEn: 'Bulgarian' }
  ];
  return new Response(JSON.stringify({ code: 200, data: { languages }, message: 'success' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

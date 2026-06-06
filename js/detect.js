/**
 * AIGC 内容检测页面 JS - 与翻译页面一致的交互逻辑
 */
(function () {
  const textEl = document.getElementById('detectText');
  const detectBtn = document.getElementById('detectBtn');
  const detectType = document.getElementById('detectType');
  const sourceCount = document.getElementById('sourceCount');
  const placeholder = document.getElementById('detectPlaceholder');
  const loadingEl = document.getElementById('detectLoading');
  const reportEl = document.getElementById('detectReport');
  const resultCount = document.getElementById('resultCount');
  // 检测报告内容区域
  const reportBody = reportEl.querySelector('.detect-result-body');

  let isDetecting = false;

  // 导航栏滚动阴影
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 0);
    }, { passive: true });
  }

  // 主题管理
  const theme = localStorage.getItem('theme') || 'light';
  applyTheme(theme);

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = t === 'light'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    }
  }

  document.getElementById('themeBtn').addEventListener('click', function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });

  // 字符计数
  textEl.addEventListener('input', function () {
    const len = textEl.value.length;
    sourceCount.textContent = '输入 ' + len + ' / 10000';
    detectBtn.disabled = len === 0 || isDetecting;
  });

  // 检测类型标签切换
  const detectTypeTabs = document.getElementById('detectTypeTabs');
  if (detectTypeTabs) {
    detectTypeTabs.addEventListener('click', function (e) {
      const tab = e.target.closest('.detect-type-tab');
      if (!tab) return;
      // 更新标签激活状态
      detectTypeTabs.querySelectorAll('.detect-type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // 同步下拉选择器
      const type = tab.dataset.type;
      if (type) detectType.value = type;
    });
  }

  // 下拉选择器变化时同步标签
  detectType.addEventListener('change', function () {
    if (detectTypeTabs) {
      detectTypeTabs.querySelectorAll('.detect-type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === detectType.value);
      });
    }
  });

  // 开始检测
  detectBtn.addEventListener('click', startDetection);
  textEl.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'Enter' && !detectBtn.disabled) {
      e.preventDefault();
      startDetection();
    }
  });

  async function startDetection() {
    const text = textEl.value.trim();
    if (!text || isDetecting) return;

    isDetecting = true;
    detectBtn.disabled = true;
    placeholder.style.display = 'none';
    reportEl.style.display = 'none';
    resultCount.style.display = 'none';
    loadingEl.style.display = 'flex';

    const type = detectType.value;

    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, type: type })
      });

      const data = await res.json();

      if (data.code === 200) {
        renderReport(data.data);
        resultCount.style.display = 'block';
        sourceCount.textContent = '输入 ' + text.length + ' / 10000';
      } else {
        showError(data.message || '检测失败');
        resultCount.style.display = 'block';
      }
    } catch (e) {
      showError('网络请求失败：' + e.message);
      resultCount.style.display = 'block';
    } finally {
      isDetecting = false;
      detectBtn.disabled = textEl.value.trim().length === 0;
      loadingEl.style.display = 'none';
    }
  }

  function showError(msg) {
    reportEl.style.display = 'block';
    placeholder.style.display = 'none';
    reportBody.innerHTML = '<div class="report-section"><p style="color:var(--color-error);text-align:center;padding:24px">' + escapeHtml(msg) + '</p></div>';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 渲染报告
  function renderReport(data) {
    const report = data.report;
    reportEl.style.display = 'block';
    placeholder.style.display = 'none';

    let html = '';

    // 报告头部
    html += '<div class="report-header">';
    html += '<h2 class="report-title">' + escapeHtml(data.typeName) + '报告</h2>';
    html += '<div class="report-meta">模型：' + escapeHtml(data.metadata.model) + ' | ' + escapeHtml(data.metadata.textLength) + ' 字符</div>';
    html += '</div>';

    if (report.raw) {
      html += '<div class="report-section"><div style="padding:16px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);font-size:13px;line-height:1.8;color:var(--color-text-secondary);white-space:pre-wrap;word-break:break-word">' + formatMarkdown(report.raw) + '</div></div>';
    } else if (data.type === 'compliance') {
      html += renderComplianceReport(report);
    } else if (data.type === 'quality') {
      html += renderQualityReport(report);
    } else if (data.type === 'aiDetection') {
      html += renderAIDetectionReport(report);
    } else if (data.type === 'sensitiveInfo') {
      html += renderSensitiveReport(report);
    }

    reportBody.innerHTML = html;
    reportEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderComplianceReport(report) {
    let html = '';
    const overall = report.overall || '未知';
    const score = report.score || 0;
    const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
    const statusClass = overall === '合规' ? 'status-pass' : 'status-fail';

    html += '<div class="report-summary ' + statusClass + '">';
    html += '<div class="summary-score ' + scoreClass + '">' + score + '<span>分</span></div>';
    html += '<div class="summary-main">';
    html += '<div class="summary-overall">检测结果：<strong>' + escapeHtml(overall) + '</strong></div>';
    html += '<p>' + escapeHtml(report.summary || '') + '</p>';
    html += '</div></div>';

    if (report.dimensions && report.dimensions.length) {
      html += '<div class="report-section"><h3>各维度检测详情</h3><div class="dimension-list">';
      report.dimensions.forEach(function (dim) {
        html += '<div class="dimension-item ' + (dim.pass ? 'pass' : 'fail') + '">';
        html += '<div class="dim-header">';
        html += '<span class="dim-name">' + escapeHtml(dim.name) + '</span>';
        html += '<span class="dim-score">' + (dim.score || 0) + '分</span>';
        html += '<span class="dim-status">' + (dim.pass ? '✓ 通过' : '✗ 未通过') + '</span>';
        html += '</div>';
        html += '<p class="dim-detail">' + escapeHtml(dim.detail || '') + '</p>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    if (report.risks && report.risks.length) {
      html += '<div class="report-section"><h3>风险项</h3>';
      report.risks.forEach(function (risk) {
        const levelClass = risk.level === '高' ? 'risk-high' : risk.level === '中' ? 'risk-mid' : 'risk-low';
        html += '<div class="risk-item ' + levelClass + '">';
        html += '<span class="risk-level">' + escapeHtml(risk.level) + '风险</span>';
        html += '<div class="risk-body">';
        html += '<p>' + escapeHtml(risk.content || '') + '</p>';
        html += '<p class="risk-suggestion">建议：' + escapeHtml(risk.suggestion || '') + '</p>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    if (report.conclusion) {
      html += '<div class="report-section report-conclusion"><h3>综合结论</h3><p>' + escapeHtml(report.conclusion) + '</p></div>';
    }

    return html;
  }

  function renderQualityReport(report) {
    let html = '';
    const overall = report.overall || '未知';
    const score = report.score || 0;
    const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';

    html += '<div class="report-summary">';
    html += '<div class="summary-score ' + scoreClass + '">' + score + '<span>分</span></div>';
    html += '<div class="summary-main">';
    html += '<div class="summary-overall">总体评价：<strong>' + escapeHtml(overall) + '</strong></div>';
    html += '<p>' + escapeHtml(report.summary || '') + '</p>';
    html += '</div></div>';

    if (report.dimensions && report.dimensions.length) {
      html += '<div class="report-section"><h3>各维度评估</h3><div class="dimension-list">';
      report.dimensions.forEach(function (dim) {
        html += '<div class="dimension-item">';
        html += '<div class="dim-header">';
        html += '<span class="dim-name">' + escapeHtml(dim.name) + '</span>';
        html += '<span class="dim-score">' + (dim.score || 0) + '分</span>';
        html += '</div>';
        html += '<p class="dim-detail">' + escapeHtml(dim.detail || '') + '</p>';
        if (dim.tip) html += '<p class="dim-tip">改进建议：' + escapeHtml(dim.tip) + '</p>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    if (report.highlights && report.highlights.length) {
      html += '<div class="report-section"><h3>内容亮点</h3><ul class="bullet-list">';
      report.highlights.forEach(function (h) { html += '<li>' + escapeHtml(h) + '</li>'; });
      html += '</ul></div>';
    }

    if (report.suggestions && report.suggestions.length) {
      html += '<div class="report-section"><h3>改进建议</h3><ul class="bullet-list">';
      report.suggestions.forEach(function (s) { html += '<li>' + escapeHtml(s) + '</li>'; });
      html += '</ul></div>';
    }

    if (report.conclusion) {
      html += '<div class="report-section report-conclusion"><h3>综合评价</h3><p>' + escapeHtml(report.conclusion) + '</p></div>';
    }

    return html;
  }

  function renderAIDetectionReport(report) {
    let html = '';
    const isAI = report.isAI;
    const confidence = report.confidence || 0;

    html += '<div class="report-summary ' + (isAI ? 'status-fail' : 'status-pass') + '">';
    html += '<div class="ai-result-badge">';
    html += '<div class="ai-badge-icon">' + (isAI ? '&#x1F916;' : '&#x270D;') + '</div>';
    html += '<div class="ai-badge-text">' + (isAI ? '疑似 AI 生成' : '可能为人类创作') + '</div>';
    html += '<div class="ai-confidence">置信度 ' + confidence + '%</div>';
    html += '</div>';
    html += '<p>' + escapeHtml(report.summary || '') + '</p>';
    html += '</div>';

    if (report.indicators && report.indicators.length) {
      html += '<div class="report-section"><h3>检测指标详情</h3><div class="dimension-list">';
      report.indicators.forEach(function (ind) {
        html += '<div class="dimension-item">';
        html += '<div class="dim-header">';
        html += '<span class="dim-name">' + escapeHtml(ind.name) + '</span>';
        html += '<span class="dim-score">' + (ind.score || 0) + '%</span>';
        html += '</div>';
        html += '<p class="dim-detail">' + escapeHtml(ind.evidence || '') + '</p>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    if (report.explanation) {
      html += '<div class="report-section"><h3>分析说明</h3><p>' + escapeHtml(report.explanation) + '</p></div>';
    }

    if (report.conclusion) {
      html += '<div class="report-section report-conclusion"><h3>最终结论</h3><p>' + escapeHtml(report.conclusion) + '</p></div>';
    }

    return html;
  }

  function renderSensitiveReport(report) {
    let html = '';
    const hasSensitive = report.hasSensitive;
    const totalCount = report.totalCount || 0;

    html += '<div class="report-summary ' + (hasSensitive ? 'status-fail' : 'status-pass') + '">';
    html += '<div class="sensitive-summary-row">';
    html += '<div class="sensitive-icon">' + (hasSensitive ? '&#x26A0;' : '&#x2705;') + '</div>';
    html += '<div class="sensitive-info">';
    html += '<div class="summary-overall">' + (hasSensitive ? '发现 <strong>' + totalCount + '</strong> 处敏感信息' : '未发现敏感信息') + '</div>';
    html += '<p>' + escapeHtml(report.summary || '') + '</p>';
    html += '</div></div></div>';

    if (report.items && report.items.length) {
      html += '<div class="report-section"><h3>敏感信息详情</h3><div class="sensitive-list">';
      report.items.forEach(function (item) {
        const riskClass = item.risk === '高' ? 'risk-high' : item.risk === '中' ? 'risk-mid' : 'risk-low';
        html += '<div class="sensitive-item ' + riskClass + '">';
        html += '<div class="sensitive-header">';
        html += '<span class="sensitive-type">' + escapeHtml(item.type) + '</span>';
        html += '<span class="risk-level">' + escapeHtml(item.risk) + '风险</span>';
        html += '</div>';
        html += '<div class="sensitive-detail">';
        html += '<div class="sensitive-content">内容：' + escapeHtml(item.content || '') + '</div>';
        html += '<div class="sensitive-masked">脱敏示例：' + escapeHtml(item.masked || '') + '</div>';
        html += '<div class="sensitive-suggestion">' + escapeHtml(item.suggestion || '') + '</div>';
        html += '</div></div>';
      });
      html += '</div></div>';
    }

    if (report.conclusion) {
      html += '<div class="report-section report-conclusion"><h3>安全建议</h3><p>' + escapeHtml(report.conclusion) + '</p></div>';
    }

    return html;
  }

  // 简单的 Markdown 渲染
  function formatMarkdown(text) {
    if (!text) return '';
    return escapeHtml(text)
      .replace(/### (.+)/g, '<h4>$1</h4>')
      .replace(/## (.+)/g, '<h3>$1</h3>')
      .replace(/# (.+)/g, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/- (.+)/g, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^<li>/, '<ul><li>')
      .replace(/<\/li>\n<li>/g, '</li><li>')
      .replace(/<\/li>$/, '</li></ul>');
  }

})();
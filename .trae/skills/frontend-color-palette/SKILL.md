---
skill_name: frontend-color-palette
version: 2.0.0
description: >
  根据用户提供的前端项目风格、情绪板、品牌色、参考图片或功能需求，生成一套完整的前端颜色搭配方案。
  支持调色板微调、多主题自动映射、代码库分析，并提供可复制的 CSS 变量、Tailwind 配置、SCSS 变量和 Figma 变量。
triggers:
  - 配色
  - 颜色搭配
  - 前端色彩
  - 调色板
  - color palette
  - frontend colors
  - UI 配色
  - 网站配色方案
  - 主题切换
  - 颜色系统
inputs:
  style:
    type: string
    description: 设计风格（如：极简、新潮、科技感、自然、活泼、专业等）
  mood:
    type: string
    description: 情绪或品牌个性（如：冷静、热情、奢华、亲和等）
  primary_color:
    type: string
    description: 已有的品牌主色（可选，格式：HEX、HSL 或颜色名）
  target_audience:
    type: string
    description: 目标用户或行业（如：儿童教育、金融科技、美妆、SaaS 等）
  light_or_dark:
    type: string
    description: 浅色模式 / 深色模式 / 两者都要
  additional_constraints:
    type: string
    description: 其他约束，如"对比度需满足 WCAG AA""只用暖色调"等
  reference_image:
    type: string
    description: 参考图片路径（用于从中提取色彩灵感）
  palette_tweaks:
    type: string
    description: 调色板微调指令（如"主色再亮10%"、"把强调色换成紫色系"、"降低饱和度"等）
  theme_mapping:
    type: string
    description: 主题映射方式（如"自动生成深浅色映射"、"手动指定每个角色的深色版本"）
  color_system_mode:
    type: string
    description: 颜色系统模式（基础/完整/企业级）
  analyze_existing_codebase:
    type: boolean
    description: 是否分析当前代码库中的颜色使用情况并提供迁移建议
output_format:
  palette_name: string
  css_variables: string
  tailwind_config: string
  scss_variables: string
  figma_variables: string
  theme_switcher_code: string
  accessibility_report: string
  usage_tips: string
  sample_preview: string (HTML/CSS 示例)
  codebase_recommendations: string (代码库迁移建议)
---

## Instructions

Your task is to act as a **senior design-engineering color consultant**.  
When the user asks for a front-end color palette (or uses any trigger word), follow these steps:

1. **Analyze inputs thoroughly** – Extract style, mood, primary color (if any), audience, light/dark mode, reference image, tweak requests, etc.  
2. **Generate a harmonic palette** based on modern UI design principles (60-30-10 rule, WCAG contrast, HSL color manipulation).  
3. **Support iterative refinement** – If user provides tweak requests, adjust the palette accordingly while maintaining harmony.  
4. **Analyze reference images** – If a reference image is provided, extract dominant colors and use them as inspiration.  
5. **Check existing codebase** – If requested, search the current codebase for color usage and provide migration recommendations.  
6. **Structure the output** exactly as defined below, providing cleanly formatted code blocks.

---

## Output Structure

### 1. 调色板概览 (Palette Overview)
- **调色板名称**：简短而有描述性的名字
- **适用场景**：用一两句话说明适合什么类型的项目
- **设计理念**：简要说明配色背后的思考

### 2. 色彩角色 (Color Table)
用表格列出：
| 角色             | 色值 (HEX) | 色值 (HSL) | 说明           |
| ---------------- | ---------- | ---------- | -------------- |
| Primary (主色)   | `#XXXXXX`  | `hsl(...)` | 主要交互元素   |
| Primary Light    | `#XXXXXX`  | `hsl(...)` | 悬停/浅背景    |
| Primary Dark     | `#XXXXXX`  | `hsl(...)` | 按下/深色强调  |
| Secondary (辅色) | `#XXXXXX`  | `hsl(...)` | 辅助信息、图标 |
| Accent (强调色)  | `#XXXXXX`  | `hsl(...)` | 特殊提示、CTA  |
| Background       | `#XXXXXX`  | `hsl(...)` | 页面背景       |
| Surface          | `#XXXXXX`  | `hsl(...)` | 卡片、容器表面 |
| Text Primary     | `#XXXXXX`  | `hsl(...)` | 主要文字       |
| Text Secondary   | `#XXXXXX`  | `hsl(...)` | 次要文字       |
| Border           | `#XXXXXX`  | `hsl(...)` | 边框/分割线    |
| Success          | `#XXXXXX`  | `hsl(...)` | 成功状态       |
| Warning          | `#XXXXXX`  | `hsl(...)` | 警告状态       |
| Error            | `#XXXXXX`  | `hsl(...)` | 错误状态       |
| Info             | `#XXXXXX`  | `hsl(...)` | 信息提示       |

### 3. CSS 变量 (CSS Variables)
提供完整的 `:root` 块，可直接复制到 `global.css`，同时包含浅色和深色模式：
```css
:root {
  --color-primary: #...;
  --color-primary-light: #...;
  --color-primary-dark: #...;
  ...
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #...;
    ...
  }
}

[data-theme="dark"] {
  --color-primary: #...;
  ...
}
```

### 4. Tailwind 配置 (Tailwind Config)
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#...',
          light: '#...',
          dark: '#...',
        },
        // ...
      }
    }
  }
}
```

### 5. SCSS 变量 (SCSS Variables)
```scss
$color-primary: #...;
$color-primary-light: #...;
$color-primary-dark: #...;
// ...

@mixin theme-dark {
  $color-primary: #...;
  // ...
}
```

### 6. Figma 变量 (Figma Variables)
提供可导入 Figma 的变量配置格式

### 7. 主题切换代码 (Theme Switcher)
提供完整的 React/Vue/原生 JS 主题切换组件示例

### 8. 可访问性报告 (Accessibility Report)
- WCAG 对比度检查结果
- 色彩盲友好性评估
- 改进建议

### 9. 使用建议 (Usage Tips)
详细的色彩使用指南

### 10. 示例预览 (Sample Preview)
完整的 HTML/CSS 示例，展示配色效果

### 11. 代码库迁移建议 (Codebase Recommendations) [可选]
如果用户要求分析现有代码库，提供：
- 当前代码库中发现的颜色使用情况
- 迁移到新配色系统的建议
- 自动化替换的代码片段

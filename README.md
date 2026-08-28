# 测试 · 企业官网

玻璃拟态（Glassmorphism）风格的企业官网，静态纯前端项目。

## 项目概览

- 项目名称：ceshi
- 站点名称：测试（企业官网）
- 项目类型：静态项目（static，Nginx 直接托管静态文件）
- 访问地址：静态站点，部署到任意 Web 服务器（Nginx/Apache 等）后即可访问

## 技术栈

- 纯 HTML / CSS / 原生 JavaScript（无构建工具、无后端）
- 字体：Outfit（Google Fonts）
- 设计风格：玻璃拟态（Glassmorphism），核心视觉语言为 `backdrop-filter: blur` + 半透明磨砂卡片 + 1px 亮边

## 目录结构

```
ceshi/
├── index.html              # 首页（Hero Banner + 风格信息条 + 核心服务入口 + CTA）
├── about.html              # 关于我们（使命/愿景/价值观 + 里程碑 + 数据统计）
├── services.html           # 产品/服务列表页（云上服务 / 智能应用 / 战略咨询）
├── service-detail.html     # 产品/服务详情页（根据 ?id=cloud|ai|consult 动态渲染）
├── team.html               # 团队成员（6 名核心成员卡片）
├── assets/
│   ├── css/style.css       # 全局样式、设计系统变量、卡片光照效果
│   └── js/main.js          # 主题切换、卡片光照、汉堡菜单、导航高亮
└── README.md
```

## 核心功能

1. **首页 Banner**：Hero 区含 eyebrow、超大主标题、副标题与主/次 CTA，右侧玻璃视觉装饰。
2. **关于我们**：实体页面，含使命/愿景/价值观三卡片、发展历程时间线、数据统计。
3. **产品/服务展示**：列表页 + 详情页（`service-detail.html?id=cloud|ai|consult`），支持三个服务详情动态切换。
4. **团队成员**：实体页面，6 名成员卡片（内联 SVG 头像，渐变配色）。
5. **深浅色模式切换**：导航栏按钮切换 `data-theme="light" / "dark"`，使用 `localStorage`（键 `ceshi-theme`）持久化；默认深色。

## 卡片悬停光照效果实现

- 所有启用 `data-glow` 的卡片由 JS 自动注入 `.glow` 光斑层。
- `mousemove` 时用 `requestAnimationFrame` 节流，通过 `transform: translate(...)` 更新光斑位置（仅合成层、GPU 加速，避免重排）。
- 光斑为 `radial-gradient` 径向渐变，`mix-blend-mode: screen`（浅色下为 normal）。
- 进入时 `opacity` 过渡为 1，移出时平滑过渡为 0，实现柔和出现与自然消失。
- 尊重 `prefers-reduced-motion: reduce`，减弱动效偏好下关闭光斑动画。

## 设计系统要点

- 主字体：Outfit；圆角：14px（标志性）；间距：8px 模数；容器最大宽度 1200px。
- 设计变量集中于 `style.css` 的 `:root` 与 `html[data-theme="..."]`，深浅色主题通过变量切换实现。

## 运行与部署

- 静态项目，由 Nginx 直接托管，无需进程、端口或启动命令。
- 修改后刷新浏览器即可生效；如改动样式/脚本注意浏览器缓存。

# Inkwell — HTML Native Notebook for Mac

Inkwell 是一个 macOS 桌面应用，让你能像读书一样浏览和管理本地的 **.html** 和 **.md** 文件。

AI 生成了大量 HTML 文件（投资报告、数据可视化、卡片笔记），但 Obsidian 打不开 HTML，Finder 看不了内容，浏览器开太多又乱。Inkwell 就是为解决这个问题做的。

## 一句话

**左边文件树，右边直接渲染。Markdown 能看，HTML 也能看，不用切浏览器。**

## 核心功能

- **原生 HTML 渲染** — HTML 文件的 CSS、SVG、图表、交互组件完整呈现，与浏览器效果一致
- **Markdown 渲染** — 支持 GFM 表格、YAML frontmatter、中文列表符号等常见格式
- **文件树导航** — 浏览文件夹结构，可按需展开子目录
- **HTML-only 过滤** — 一键只显示 HTML 文件，隐藏其他类型
- **快捷键** — `⌘K` 全局搜索，`J`/`K` 上下切换文件
- **隔离渲染** — HTML 文件在沙箱 iframe 中渲染，不与主应用样式冲突

## 安装

⚠️ **仅支持 macOS Apple Silicon (M1/M2/M3/M4)**，不支持 Intel Mac。

1. 从 [Releases](https://github.com/bellazhuang417-cyber/inkwell/releases) 下载 `Inkwell_0.1.0_aarch64.dmg`
2. 打开 DMG，将 Inkwell 拖入 Applications 文件夹
3. 首次启动时，系统会提示"无法验证开发者"
   - 打开 **系统设置 → 隐私与安全性 → 安全性**
   - 点击"仍要打开"
4. 启动后，选择你的笔记文件夹作为 vault（默认路径为 `~/Documents/Bella_AI_World/`）

## 使用

| 操作 | 方式 |
|------|------|
| 浏览文件 | 点击左侧文件树 |
| 全局搜索 | `⌘K` |
| 上一个文件 | `K` |
| 下一个文件 | `J` |
| 过滤 HTML | 左下角筛选按钮 |

## 当前局限 (v0.1.0)

- **只读** — 不能编辑文件，后续版本会增加编辑器
- **无 wiki 链接** — 不支持 `[[wikilink]]` 跳转
- **仅 ARM Mac** — 不支持 Intel Mac
- **UI 粗糙** — 功能优先，界面后续会优化

## 适合 / 不适合

**适合：** 有大量 AI 生成的 HTML 文件需要管理的用户（如投资报告、可视化卡片、阅读笔记）

**不适合：** 需要成熟笔记工具进行日常写作的用户

## 路线图

- **v0.2** — Wikilink 跳转 + 反向链接面板
- **v0.3** — 全文搜索 + 标签过滤
- **v1.0** — 编辑能力 + 插件系统

## 技术栈

- Tauri 2.0 (Rust backend)
- React + TypeScript (前端)
- CodeMirror 6 (代码编辑)
- SQLite + Tantivy (全文搜索)

## License

MIT

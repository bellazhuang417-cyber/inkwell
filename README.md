# Inkwell — HTML & Markdown Notebook for Mac

Inkwell is a macOS desktop app for browsing and managing local **.html** and **.md** files — render them natively, navigate with a file tree, and track backlinks between notes.

Built for people with large collections of AI-generated HTML files (reports, visualizations, card notes) that Obsidian can't open and Finder can't preview.

---

**左边文件树，右边直接渲染。Markdown 能看，HTML 也能看，不用切浏览器。**

---

## Features / 核心功能

- **Native HTML rendering** — CSS, SVG, charts, and interactive components render exactly as in a browser
- **Markdown rendering** — GFM tables, YAML frontmatter, and common formatting supported
- **File tree navigation** — Browse folder structure, expand subdirectories on demand
- **Backlinks panel** — See which files reference the current note
- **HTML-only filter** — One click to hide non-HTML files
- **Keyboard shortcuts** — `⌘K` global search, `J`/`K` to move between files
- **Sandboxed rendering** — HTML files render in an isolated iframe, no style conflicts

---

## Installation (macOS)

> ⚠️ **Apple Silicon only (M1/M2/M3/M4).** Intel Mac is not supported.
>
> Inkwell is not yet signed with an Apple Developer certificate. macOS may show a "cannot verify" warning — this is expected and safe to bypass.

### Option 1: One-command install (recommended)

Open **Terminal** and run:

```bash
curl -fsSL https://raw.githubusercontent.com/bellazhuang417-cyber/inkwell/main/install.sh | bash
```

Once done, find Inkwell in your Applications folder and double-click to open.

### Option 2: Manual install

1. Download `Inkwell_<version>_aarch64.tar.gz` from [Releases](https://github.com/bellazhuang417-cyber/inkwell/releases)
2. Double-click to extract — you'll get `Inkwell.app`
3. Drag `Inkwell.app` into your Applications folder
4. **Right-click** Inkwell.app → choose **Open** → click **Open** again in the dialog
5. After the first launch, you can open it by double-clicking as normal

### Still can't open it?

```bash
xattr -cr /Applications/Inkwell.app
```

---

## 安装（macOS）

> ⚠️ **仅支持 Apple Silicon（M1/M2/M3/M4）**，不支持 Intel Mac。
>
> Inkwell 目前没有 Apple 官方签名，macOS 会提示"无法验证"，这是正常现象，按下面步骤绕过即可。

### 方法一：一键安装（推荐）

打开「终端」，复制粘贴后回车：

```bash
curl -fsSL https://raw.githubusercontent.com/bellazhuang417-cyber/inkwell/main/install.sh | bash
```

完成后在「应用程序」文件夹找到 Inkwell，双击打开。

### 方法二：手动安装

1. 从 [Releases](https://github.com/bellazhuang417-cyber/inkwell/releases) 下载 `Inkwell_<版本号>_aarch64.tar.gz`
2. 双击解压，得到 `Inkwell.app`
3. 拖入「应用程序」文件夹
4. **右键点击** Inkwell.app → 选「打开」→ 弹窗里再点「打开」
5. 之后每次双击即可正常启动

### 还是打不开？

```bash
xattr -cr /Applications/Inkwell.app
```

---

## Usage / 使用

| Action | Shortcut / How |
|--------|----------------|
| Browse files | Click the file tree on the left |
| Open folder | Folder icon (top-left) |
| Global search | `⌘K` |
| Previous file | `K` |
| Next file | `J` |
| Filter HTML only | Filter button (top-left) |

On first launch, click the folder icon to choose your notes folder. Inkwell remembers it on future launches.

---

## Current Limitations / 当前局限 (v0.1.x)

- **Read-only** — editing is not yet supported（暂不支持编辑）
- **No wikilinks** — `[[wikilink]]` navigation not yet implemented（暂不支持 wikilink 跳转）
- **Apple Silicon only** — Intel Mac not supported（仅支持 M 系列芯片）

## Roadmap / 路线图

- **v0.2** — Wikilink navigation + backlink improvements
- **v0.3** — Full-text search + tag filtering
- **v1.0** — Editing support + plugin system

## Tech Stack

- Tauri 2.0 (Rust)
- React + TypeScript
- Vite

## License

MIT

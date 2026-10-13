<p align="center"><img src="icon.png" width="120" alt="PdfCraft Bridge 图标"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <b>简体中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  让 Claude 使用你电脑上安装的 <b>PdfCraft</b> 处理 PDF —— 支持 <b>Windows、macOS 和 Linux</b>：<br>
  读取、拆分、合并、整理、加水印、加密、涂黑删除、填写表单、签名、转换、压缩和 OCR。
</p>

---

## 为什么

[PdfCraft](https://github.com/storytold/pdfcraft) 是一款用 Rust 编写、对标 Acrobat 的开源 PDF 编辑器，自带无界面的命令行工具（`pdfcraft-cli`）和 131 个自动化工具。这个 [Model Context Protocol](https://modelcontextprotocol.io) 服务器把该引擎变成 Claude 可调用的 **"文件进、文件出" 工具**，例如你可以说：

> *"把 `D:\scans` 里的每个 PDF 每 10 页拆分一次，每个文件一个文件夹。"*
> *"给 `~/contracts/nda.pdf` 加上「机密」水印和「第 1 页，共 n 页」页脚。"*
> *"把这份报告里所有的邮箱和电话号码涂黑删除。"*
> *"用这些值填写这个表单并拼合，再把原件转换成 Word。"*

同系列项目：[filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) 和 [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server)。

## 平台

| 系统 | 需要安装的 PdfCraft 包 | 服务器会自动查找的位置（无需配置） | 状态 |
| --- | --- | --- | --- |
| **Windows** 10/11（x64、x86、arm64） | MSI 或便携版 zip | `C:\Program Files\PdfCraft`、`%LOCALAPPDATA%\Programs\PdfCraft`、`PATH` | ✅ 已验证（Windows 11） |
| **Linux**（x86_64、aarch64，glibc ≥ 2.35） | `.deb`、`.rpm` 或 `.tar.gz` | `/usr/bin`、`/usr/local/bin`、`/opt/pdfcraft/bin`、`~/.local/bin`、`PATH` | ✅ 已验证（Debian 12，无界面） |
| **macOS** 11+（Apple 芯片和 Intel） | `.dmg`（应用）**以及** `pdfcraft-cli-<版本>-macos-universal.zip` | `/Applications/PdfCraft.app`、`/usr/local/bin`、`/opt/homebrew/bin`、`~/.local/bin`、`~/bin`、`PATH` | 🟡 已支持，尚未在 Mac 上实测 |

下载：[PdfCraft 发布页](https://github.com/storytold/pdfcraft/releases)（另有 FreeBSD 的 tar.gz，用 `PDFCRAFT_DIR` 指向它即可）。若安装在其他位置，请设置 `PDFCRAFT_DIR`（文件夹、`.tar.gz` 解压根目录或 `PdfCraft.app`）或 `PDFCRAFT_CLI`。

- **macOS：** DMG 里只有应用本身。请解压单独提供的 `pdfcraft-cli` zip，把 `pdfcraft-cli` 移到 `/usr/local/bin`（或用 `PDFCRAFT_CLI` 指向它）。如果 macOS 阻止首次运行，请在 *系统设置 → 隐私与安全性* 中允许。
- **Linux：** AppImage 和 Flatpak 只包含应用，不含 `pdfcraft-cli`，请使用 deb、rpm 或 tar.gz。若应用是 AppImage，请设置 `PDFCRAFT_APP`，以便 `open_in_pdfcraft` 能启动它。在没有 GPU 的服务器上，经过验证的环境安装了 `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`。
- **OCR** 需要 PdfCraft 的文字识别模型（`get_pdfcraft_status` 会显示是否已安装）；其他所有工具无需模型即可使用。

## 工作原理

| 组成 | 说明 |
| --- | --- |
| **PdfCraft 引擎**（`pdfcraft-cli mcp`） | PdfCraft 自己的无界面引擎：解析、渲染、编辑、表单、涂黑删除、加密、签名和导出。每个任务都在独立的临时文件夹中重新启动。 |
| **MCP 服务器**（Node.js） | 21 个高层工具。在引擎中打开文档，逐个调用工具，校验路径，从不覆盖文件。 |

## 工具

| 工具 | 功能 |
| --- | --- |
| `get_pdf_info` | 页数与尺寸、元数据、版本、安全设置、表单字段、书签、注释、链接、附件、字体、签名 |
| `extract_text` | 按阅读顺序逐页提取文本，可另存为 `.txt` |
| `render_pages` | 将页面导出为 PNG / JPEG / TIFF（`<名称>_page_001.png`…），并附 Claude 可查看的预览图 |
| `split_pdf` | 每 N 页、在指定页之前、按书签或按大小拆分；每个文件一个文件夹 |
| `merge_pdfs` | 按页码范围（`"1-3, 6"`）合并 PDF |
| `extract_pages` | 把选定页面提取为新 PDF，或每页一个文件 |
| `edit_pages` | 插入文件或空白页、复制、旋转、移动、删除、裁剪、页面标签、元数据 |
| `create_pdf` | 由图片、文本或空白页创建新 PDF |
| `add_content` | 文字或图片水印、页眉页脚（页码、日期、Bates 编号）、背景、文本框、图片、链接 |
| `protect_pdf` | 打开密码 / 权限密码（AES-256），限制打印 / 复制 / 修改，或解除保护 |
| `redact_pdf` | 真正删除文字、模式（邮箱、电话、SSN、卡号、日期）、区域或整页，并可清除隐藏信息 |
| `fill_form` | 列出、自动识别、填写并拼合表单字段 |
| `sign_pdf` | 用 .p12/.pfx 数字证书签名（或先创建自签名证书） |
| `convert_pdf` | 转为 Word、HTML、RTF、文本、PNG / JPEG / TIFF、PDF/A-2b / 3b |
| `optimize_pdf` | 减小文件体积，可选清除隐藏信息 |
| `ocr_pdf` | 让扫描版 PDF 可搜索 |
| `compare_pdfs` | 对比两个版本的差异，生成 PDF 报告和标注副本 |
| `list_pdf_tools` | 引擎的 131 个工具及其参数结构 |
| `run_pdf_tools` | 在一个会话中运行任意引擎工具（支持 `$docs[0]`、`$steps[N].路径` 引用） |
| `open_in_pdfcraft` | 在 PdfCraft 应用中打开 PDF |
| `get_pdfcraft_status` | 平台、安装、版本、引擎工具数量、OCR |

位置和尺寸的单位是 **点**（1/72 英寸），原点在页面 **左上角**；`get_pdf_info` 会给出每页尺寸。

## 示例

```json
{
  "input_path": "/home/me/contracts/nda.pdf",
  "watermark": { "text": "机密", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Approved", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## 要求

- 带有 `pdfcraft-cli` 的 **PdfCraft**（已在 **0.4.0** 上测试），见 [平台](#平台)
- Node.js ≥ 20（通过 `.mcpb` 安装时 Claude Desktop 已自带）

## 安装

### Claude Desktop（推荐，所有平台）

1. 从 [最新发布](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest) 下载 `pdfcraft-mcp-server.mcpb`。
2. 双击它（或拖到 Claude Desktop → *设置 → 扩展*），然后点击 **安装**。
3. 可选：如果 PdfCraft 不在标准位置，请在扩展设置中填写它的文件夹或 `pdfcraft-cli` 的路径；也可以把访问限制在某个文件夹内。

### Codex（OpenAI）

**推荐 —— 插件市场（可获得更新）：** *插件 → 添加 → 添加插件市场*，来源 `jhonsu01/craft-marketplace`，引用 `main`，然后从 **Craft Bridges** 安装 **PdfCraft Bridge**（[craft-marketplace](https://github.com/jhonsu01/craft-marketplace)）。刷新插件市场即可获得新版本。或者上传 zip（Codex 会把它保存在你的账户中，并拒绝同名的新版 zip）：

1. 从[最新发布](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest)下载 `pdfcraft-mcp-server-<版本>-codex.zip`。
2. 在 Codex 中：*插件 → 添加 → 新插件*，选择该 zip，然后点击 **添加插件**。
3. Codex 用 `node` 启动服务器，因此 `PATH` 中必须有 Node.js ≥ 20。如果 PdfCraft 不在标准位置，请把 `PDFCRAFT_DIR` 或 `PDFCRAFT_CLI` 设为系统环境变量（Codex 没有本地插件的设置表单）。

### DeepSeek Harness

1. *Plugins → Add plugin*，输入 `github:jhonsu01/craft-marketplace#path:/plugins/pdfcraft-mcp-server`，点击 **Install**，再点击 **Enable now**。
2. Harness 用自带的 MCP 客户端和 `node`（`PATH` 中需有 Node.js ≥ 20）启动服务器；工具显示为 `mcp__pdfcraft__<工具>`，输出文件显示为可在 Harness 中打开的卡片。
3. Harness 目前不会自动更新插件：要更新，请卸载插件后用同一地址重新安装。

### Claude Code / 其他 MCP 客户端

```bash
git clone https://github.com/jhonsu01/pdfcraft-mcp-server.git
cd pdfcraft-mcp-server
npm install
npm run build
```

Windows：

```bash
claude mcp add pdfcraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux：

```bash
claude mcp add pdfcraft -- node "$PWD/dist/bundle.cjs"
```

## 配置

| 变量 | 含义 |
| --- | --- |
| `PDFCRAFT_DIR` | PdfCraft 安装文件夹、其中某个可执行文件、`.tar.gz` 解压根目录（含 `bin/`）或 `PdfCraft.app`。默认：自动检测 |
| `PDFCRAFT_CLI` | `pdfcraft-cli` / `pdfcraft-cli.exe` 的路径（优先于 `PDFCRAFT_DIR`） |
| `PDFCRAFT_APP` | 桌面应用在其他位置时的路径（例如 Linux 的 AppImage） |
| `PDFCRAFT_ROOT` | 只允许访问此文件夹内的文件（`pdfcraft-cli mcp --root`） |
| `PDFCRAFT_MCP_TIMEOUT` | 每次引擎调用的最长秒数（默认 3600） |

## 安全

- 除非设置 `overwrite: true`，否则**绝不覆盖**文件；输入文件永远不会被修改。
- 所有路径必须是绝对路径。密码绝不会出现在返回结果中。
- 一切都在本地运行，不访问网络。每个任务使用独立引擎和临时文件夹，结束后自动删除。

## 开发

```bash
npm run build       # TypeScript + 单文件打包（dist/bundle.cjs）
npm test            # 单元测试（Windows、macOS、Linux 路径逻辑）
npm run test:e2e    # 通过真实 MCP stdio 的 29 项端到端检查（合成 PDF）
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # Codex 插件 zip
```

在 Docker 中测试 Linux（先解压 `pdfcraft-<版本>-linux-x86_64.tar.gz`）：

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## 许可证

Apache-2.0。PdfCraft 版权归其作者（Storytold）所有，采用 Apache-2.0 许可。
本项目与 PdfCraft 和 Storytold 无关，也未获得其认可。Adobe Acrobat 是 Adobe 的商标。

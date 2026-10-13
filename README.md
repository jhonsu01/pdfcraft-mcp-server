<p align="center"><img src="icon.png" width="120" alt="PdfCraft Bridge icon"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <b>English</b> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Let Claude work on PDFs with the <b>PdfCraft</b> installed on your computer — <b>Windows, macOS and Linux</b>:<br>
  read, split, merge, organize, watermark, protect, redact, fill, sign, convert, compress and OCR.
</p>

---

## Why

[PdfCraft](https://github.com/storytold/pdfcraft) is an open-source, Acrobat-class PDF editor written in Rust, with a headless CLI (`pdfcraft-cli`) and 131 automation tools. This [Model Context Protocol](https://modelcontextprotocol.io) server turns that engine into **file-in / file-out tools** for Claude, so you can ask things like:

> *"Split every PDF in `D:\scans` every 10 pages, one folder per file."*
> *"Add a 'CONFIDENTIAL' watermark and 'Page 1 of n' footers to `~/contracts/nda.pdf`."*
> *"Black out every email address and phone number in this report."*
> *"Fill this form with these values and flatten it, then convert the original to Word."*

Sibling of [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) and [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Platforms

| OS | PdfCraft package to install | Where the server finds it (no setup needed) | Status |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI or portable zip | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ Verified (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` or `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ Verified (Debian 12, headless) |
| **macOS** 11+ (Apple silicon and Intel) | `.dmg` (the app) **plus** `pdfcraft-cli-<version>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Supported, not yet tested on a Mac |

All downloads: [PdfCraft releases](https://github.com/storytold/pdfcraft/releases) (there is also a FreeBSD tar.gz; set `PDFCRAFT_DIR` to it). Anywhere else: set `PDFCRAFT_DIR` (folder, `.tar.gz` root or `PdfCraft.app`) or `PDFCRAFT_CLI`.

- **macOS:** the DMG contains only the app. Unzip the separate `pdfcraft-cli` zip and move `pdfcraft-cli` to `/usr/local/bin` (or point `PDFCRAFT_CLI` at it). If macOS blocks its first run, allow it in *System Settings → Privacy & Security*.
- **Linux:** the AppImage and Flatpak contain only the app, not `pdfcraft-cli`; use the deb, rpm or tar.gz. For an AppImage app, set `PDFCRAFT_APP` so `open_in_pdfcraft` can start it. On a server without a GPU, the verified setup used `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`.
- **OCR** needs PdfCraft's text-recognition models (`get_pdfcraft_status` tells you whether they are installed); every other tool works without them.

## How it works

| Part | What it is |
| --- | --- |
| **PdfCraft engine** (`pdfcraft-cli mcp`) | PdfCraft's own headless engine: parsing, rendering, editing, forms, redaction, encryption, signatures, exporters. Started fresh for each job in a private temp folder. |
| **MCP server** (Node.js) | 21 high-level tools. Opens documents in the engine, runs the tools one at a time, validates paths and never overwrites. |

## Tools

| Tool | What it does |
| --- | --- |
| `get_pdf_info` | Pages and sizes, metadata, version, security, fields, bookmarks, comments, links, attachments, fonts, signatures |
| `extract_text` | Text by page in reading order, optionally saved as `.txt` |
| `render_pages` | Pages as PNG / JPEG / TIFF (`<name>_page_001.png`…), with a preview Claude can see |
| `split_pdf` | Every N pages, before given pages, by bookmarks or by size — one folder per input |
| `merge_pdfs` | Combine PDFs with page ranges (`"1-3, 6"`) |
| `extract_pages` | Chosen pages into a new PDF, or one file per page |
| `edit_pages` | Insert files or blank pages, duplicate, rotate, move, delete, crop, page labels, metadata |
| `create_pdf` | New PDF from images, text or blank pages |
| `add_content` | Text/picture watermarks, headers & footers (page numbers, dates, Bates), backgrounds, text boxes, images, links |
| `protect_pdf` | Open / permissions passwords (AES-256), printing / copying / changes restrictions, or unlock |
| `redact_pdf` | True redaction of words, patterns (email, phone, SSN, card, date), areas or pages, plus sanitize |
| `fill_form` | List, auto-detect, fill and flatten form fields |
| `sign_pdf` | Digital signature with a .p12/.pfx ID (or create a self-signed one) |
| `convert_pdf` | Word, HTML, RTF, text, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | Reduce file size, optionally remove hidden information |
| `ocr_pdf` | Make scanned PDFs searchable |
| `compare_pdfs` | Differences between two versions, report PDF, marked copy |
| `list_pdf_tools` | The 131 engine tools, with schemas |
| `run_pdf_tools` | Any engine tools in one session (`$docs[0]`, `$steps[N].path` references) |
| `open_in_pdfcraft` | Open PDFs in the PdfCraft app |
| `get_pdfcraft_status` | Platform, install, version, engine tools, OCR |

Positions and sizes are in **points** (1/72 inch) from the **top-left** of the page; `get_pdf_info` gives each page size.

## Example

```json
{
  "input_path": "/home/me/contracts/nda.pdf",
  "watermark": { "text": "CONFIDENTIAL", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Approved", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## Requirements

- **PdfCraft** with `pdfcraft-cli` (tested with **0.4.0**) — see [Platforms](#platforms)
- Node.js ≥ 20 (bundled with Claude Desktop for `.mcpb` installs)

## Installation

### Claude Desktop (recommended, all platforms)

1. Download `pdfcraft-mcp-server.mcpb` from the [latest release](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. Double-click it (or drag it onto Claude Desktop → *Settings → Extensions*) and click **Install**.
3. Optional: if PdfCraft is not in a standard place, set its folder or the `pdfcraft-cli` path in the extension settings. You can also limit it to one folder.

### Codex (OpenAI)

**Recommended — the marketplace (gets updates):** *Plugins → Add → Add marketplace*, source `jhonsu01/craft-marketplace`, reference `main`, then install **PdfCraft Bridge** from **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). New versions arrive by refreshing the marketplace. Or upload the zip (Codex then keeps it in your account and refuses a newer zip with the same name):

1. Download `pdfcraft-mcp-server-<version>-codex.zip` from the [latest release](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. In Codex: *Plugins → Add → New plugin*, choose the zip and click **Add plugin**.
3. Codex starts the server with `node`, so Node.js ≥ 20 must be on `PATH`. If PdfCraft is not in a standard location, set `PDFCRAFT_DIR` or `PDFCRAFT_CLI` as system environment variables (Codex has no settings form for local plugins).

### DeepSeek Harness

1. *Plugins → Add plugin*, enter `github:jhonsu01/craft-marketplace#path:/plugins/pdfcraft-mcp-server` and click **Install**, then **Enable now**.
2. Harness runs the server with its own MCP client and `node` (Node.js ≥ 20 on `PATH`); the tools appear as `mcp__pdfcraft__<tool>` and the output files as cards that open in Harness.
3. Harness does not update plugins by itself yet: to upgrade, uninstall the plugin and install it again with the same address.

### Claude Code / other MCP clients

```bash
git clone https://github.com/jhonsu01/pdfcraft-mcp-server.git
cd pdfcraft-mcp-server
npm install
npm run build
```

Windows:

```bash
claude mcp add pdfcraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux:

```bash
claude mcp add pdfcraft -- node "$PWD/dist/bundle.cjs"
```

## Configuration

| Variable | Meaning |
| --- | --- |
| `PDFCRAFT_DIR` | PdfCraft install folder, one of its executables, a `.tar.gz` root (with `bin/`) or `PdfCraft.app`. Default: auto-detect |
| `PDFCRAFT_CLI` | Path of `pdfcraft-cli` / `pdfcraft-cli.exe` (wins over `PDFCRAFT_DIR`) |
| `PDFCRAFT_APP` | Path of the desktop app when it lives elsewhere (e.g. a Linux AppImage) |
| `PDFCRAFT_ROOT` | Only allow files inside this folder (`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | Max seconds per engine call (default 3600) |

## Safety

- Files are **never overwritten** unless `overwrite: true`; inputs are never modified.
- All paths must be absolute. Passwords are never echoed back in results.
- Everything runs locally with no network access. Each job uses a private engine in a temp folder that is removed afterwards.

## Development

```bash
npm run build       # TypeScript + single-file bundle (dist/bundle.cjs)
npm test            # unit tests (Windows, macOS and Linux path logic)
npm run test:e2e    # 29 end-to-end checks over real MCP stdio (synthetic PDFs)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # Codex plugin zip
```

Linux check in Docker (unpack `pdfcraft-<version>-linux-x86_64.tar.gz` first):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## License

Apache-2.0. PdfCraft is © its authors (Storytold), Apache-2.0.
This project is not affiliated with or endorsed by PdfCraft or Storytold. Adobe Acrobat is a trademark of Adobe.

<p align="center"><img src="icon.png" width="120" alt="PdfCraft Bridge のアイコン"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  お使いのパソコンにインストールした <b>PdfCraft</b> で Claude に PDF を扱わせましょう —— <b>Windows・macOS・Linux</b> 対応：<br>
  読み取り、分割、結合、整理、透かし、保護、墨消し、フォーム入力、署名、変換、圧縮、OCR。
</p>

---

## なぜ

[PdfCraft](https://github.com/storytold/pdfcraft) は Rust で書かれた、Acrobat クラスのオープンソース PDF エディターです。画面なしで動く CLI（`pdfcraft-cli`）と 131 個の自動化ツールが付属しています。この [Model Context Protocol](https://modelcontextprotocol.io) サーバーは、そのエンジンを Claude 向けの **「ファイルを渡してファイルを受け取る」ツール** に変えます。たとえば次のように頼めます。

> *「`D:\scans` の PDF をすべて 10 ページごとに分割して、ファイルごとにフォルダーを分けて」*
> *「`~/contracts/nda.pdf` に『社外秘』の透かしと『1 / n ページ』のフッターを入れて」*
> *「このレポートのメールアドレスと電話番号をすべて墨消しして」*
> *「このフォームにこの値を入力してフラット化し、元のファイルを Word に変換して」*

姉妹プロジェクト：[filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server)、[audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server)。

## 対応プラットフォーム

| OS | インストールする PdfCraft パッケージ | サーバーが自動で探す場所（設定不要） | 状況 |
| --- | --- | --- | --- |
| **Windows** 10/11（x64、x86、arm64） | MSI またはポータブル zip | `C:\Program Files\PdfCraft`、`%LOCALAPPDATA%\Programs\PdfCraft`、`PATH` | ✅ 検証済み（Windows 11） |
| **Linux**（x86_64、aarch64、glibc ≥ 2.35） | `.deb`、`.rpm` または `.tar.gz` | `/usr/bin`、`/usr/local/bin`、`/opt/pdfcraft/bin`、`~/.local/bin`、`PATH` | ✅ 検証済み（Debian 12、画面なし） |
| **macOS** 11 以降（Apple シリコン・Intel） | `.dmg`（アプリ）**と** `pdfcraft-cli-<バージョン>-macos-universal.zip` | `/Applications/PdfCraft.app`、`/usr/local/bin`、`/opt/homebrew/bin`、`~/.local/bin`、`~/bin`、`PATH` | 🟡 対応済み、Mac 実機では未検証 |

ダウンロード：[PdfCraft のリリース](https://github.com/storytold/pdfcraft/releases)（FreeBSD 用の tar.gz もあります。`PDFCRAFT_DIR` で指定してください）。それ以外の場所に置いた場合は `PDFCRAFT_DIR`（フォルダー、`.tar.gz` のルート、または `PdfCraft.app`）か `PDFCRAFT_CLI` を設定してください。

- **macOS：** DMG にはアプリしか入っていません。別配布の `pdfcraft-cli` の zip を展開し、`pdfcraft-cli` を `/usr/local/bin` に移動してください（または `PDFCRAFT_CLI` でその場所を指定）。初回起動が macOS にブロックされたら、*システム設定 → プライバシーとセキュリティ* で許可してください。
- **Linux：** AppImage と Flatpak にはアプリのみで `pdfcraft-cli` は含まれません。deb、rpm、tar.gz のいずれかを使ってください。アプリが AppImage の場合は、`open_in_pdfcraft` が起動できるよう `PDFCRAFT_APP` を設定してください。GPU のないサーバーでは、検証済み環境で `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2` を入れました。
- **OCR** には PdfCraft の文字認識モデルが必要です（`get_pdfcraft_status` でインストール状況を確認できます）。ほかのツールはモデルなしで動きます。

## しくみ

| 構成要素 | 内容 |
| --- | --- |
| **PdfCraft エンジン**（`pdfcraft-cli mcp`） | PdfCraft 自身の画面なしエンジン：解析、レンダリング、編集、フォーム、墨消し、暗号化、署名、書き出し。ジョブごとに専用の一時フォルダーで新しく起動します。 |
| **MCP サーバー**（Node.js） | 21 個の高レベルツール。エンジンで文書を開き、ツールを 1 つずつ呼び出し、パスを検証し、上書きは一切しません。 |

## ツール

| ツール | 機能 |
| --- | --- |
| `get_pdf_info` | ページ数とサイズ、メタデータ、バージョン、セキュリティ、フォームフィールド、しおり、注釈、リンク、添付ファイル、フォント、署名 |
| `extract_text` | 読み順でページごとのテキストを取得（`.txt` 保存も可） |
| `render_pages` | ページを PNG / JPEG / TIFF に（`<名前>_page_001.png`…）、Claude が見られるプレビュー付き |
| `split_pdf` | N ページごと、指定ページの前、しおり単位、サイズ単位で分割。ファイルごとにフォルダー |
| `merge_pdfs` | ページ範囲（`"1-3, 6"`）を指定して PDF を結合 |
| `extract_pages` | 選んだページを新しい PDF に、または 1 ページ 1 ファイルで |
| `edit_pages` | ファイルや白紙ページの挿入、複製、回転、移動、削除、トリミング、ページラベル、メタデータ |
| `create_pdf` | 画像、テキスト、白紙から新しい PDF を作成 |
| `add_content` | テキスト / 画像の透かし、ヘッダー・フッター（ページ番号、日付、ベイツ番号）、背景、テキストボックス、画像、リンク |
| `protect_pdf` | 開くパスワード / 権限パスワード（AES-256）、印刷・コピー・変更の制限、または保護の解除 |
| `redact_pdf` | 語句、パターン（メール、電話、SSN、カード番号、日付）、範囲、ページの本当の墨消し。隠れた情報の削除も可 |
| `fill_form` | フォームフィールドの一覧、自動検出、入力、フラット化 |
| `sign_pdf` | .p12/.pfx のデジタル ID で署名（自己署名 ID の作成も可） |
| `convert_pdf` | Word、HTML、RTF、テキスト、PNG / JPEG / TIFF、PDF/A-2b / 3b |
| `optimize_pdf` | ファイルサイズを縮小（隠れた情報の削除も可） |
| `ocr_pdf` | スキャンした PDF を検索可能に |
| `compare_pdfs` | 2 つの版の差分、PDF レポート、差分を注釈で示したコピー |
| `list_pdf_tools` | エンジンの 131 ツールとスキーマ |
| `run_pdf_tools` | 1 つのセッションで任意のエンジンツールを実行（`$docs[0]`、`$steps[N].パス` で参照） |
| `open_in_pdfcraft` | PdfCraft アプリで PDF を開く |
| `get_pdfcraft_status` | プラットフォーム、インストール、バージョン、エンジンツール、OCR |

位置とサイズの単位は **ポイント**（1/72 インチ）で、ページの **左上** が原点です。各ページのサイズは `get_pdf_info` で確認できます。

## 例

```json
{
  "input_path": "/home/me/contracts/nda.pdf",
  "watermark": { "text": "社外秘", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Approved", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## 必要なもの

- `pdfcraft-cli` 付きの **PdfCraft**（**0.4.0** で検証）。[対応プラットフォーム](#対応プラットフォーム) を参照
- Node.js 20 以上（`.mcpb` でインストールする場合は Claude Desktop に同梱）

## インストール

### Claude Desktop（推奨、全プラットフォーム）

1. [最新リリース](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest) から `pdfcraft-mcp-server.mcpb` をダウンロードします。
2. ダブルクリック（または Claude Desktop → *設定 → 拡張機能* にドラッグ）して **インストール** をクリックします。
3. 任意：PdfCraft が標準の場所にない場合は、拡張機能の設定でフォルダーか `pdfcraft-cli` のパスを指定します。アクセスを 1 つのフォルダーに制限することもできます。

### Codex（OpenAI）

**推奨 — マーケットプレイス（更新を受け取れます）：** *プラグイン → 追加 → マーケットプレイスを追加* で、ソースに `jhonsu01/craft-marketplace`、参照に `main` を指定し、**Craft Bridges** から **PdfCraft Bridge** をインストールします（[craft-marketplace](https://github.com/jhonsu01/craft-marketplace)）。新しいバージョンはマーケットプレイスの更新で届きます。または zip をアップロードします（Codex はアカウントに保存し、同じ名前の新しい zip を拒否します）：

1. [最新リリース](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest)から `pdfcraft-mcp-server-<バージョン>-codex.zip` をダウンロードします。
2. Codex で *プラグイン → 追加 → 新しいプラグイン* を開き、zip を選んで **プラグインを追加** をクリックします。
3. Codex はサーバーを `node` で起動するため、`PATH` に Node.js ≥ 20 が必要です。PdfCraft が標準の場所にない場合は、`PDFCRAFT_DIR` または `PDFCRAFT_CLI` をシステムの環境変数として設定してください（Codex にはローカルプラグイン用の設定画面がありません）。

### Claude Code / その他の MCP クライアント

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

## 設定

| 変数 | 意味 |
| --- | --- |
| `PDFCRAFT_DIR` | PdfCraft のフォルダー、その実行ファイル、`.tar.gz` のルート（`bin/` を含む）、または `PdfCraft.app`。既定：自動検出 |
| `PDFCRAFT_CLI` | `pdfcraft-cli` / `pdfcraft-cli.exe` のパス（`PDFCRAFT_DIR` より優先） |
| `PDFCRAFT_APP` | デスクトップアプリが別の場所にある場合のパス（例：Linux の AppImage） |
| `PDFCRAFT_ROOT` | このフォルダー内のファイルだけを許可（`pdfcraft-cli mcp --root`） |
| `PDFCRAFT_MCP_TIMEOUT` | エンジン呼び出し 1 回あたりの最大秒数（既定 3600） |

## 安全性

- `overwrite: true` を指定しない限り、ファイルは**決して上書きされません**。入力ファイルも変更しません。
- パスはすべて絶対パスで指定します。パスワードが結果に表示されることはありません。
- すべてローカルで動作し、ネットワークには接続しません。ジョブごとに専用エンジンと一時フォルダーを使い、終了後に削除します。

## 開発

```bash
npm run build       # TypeScript + 単一ファイルバンドル（dist/bundle.cjs）
npm test            # 単体テスト（Windows・macOS・Linux のパス処理）
npm run test:e2e    # 実際の MCP stdio を通した 28 項目のエンドツーエンド検証（合成 PDF）
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # Codex 用プラグイン zip
```

Docker での Linux 検証（先に `pdfcraft-<バージョン>-linux-x86_64.tar.gz` を展開）：

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## ライセンス

Apache-2.0。PdfCraft の著作権はその作者（Storytold）にあり、Apache-2.0 ライセンスです。
本プロジェクトは PdfCraft および Storytold とは無関係で、承認も受けていません。Adobe Acrobat は Adobe の商標です。

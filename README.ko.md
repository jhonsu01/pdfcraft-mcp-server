<p align="center"><img src="icon.png" width="120" alt="PdfCraft Bridge 아이콘"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <b>한국어</b>
</p>

<p align="center">
  컴퓨터에 설치된 <b>PdfCraft</b>로 Claude가 PDF를 다루게 하세요 — <b>Windows, macOS, Linux</b> 지원:<br>
  읽기, 분할, 병합, 정리, 워터마크, 보호, 영구 삭제(교정), 양식 작성, 서명, 변환, 압축, OCR.
</p>

---

## 왜 필요한가

[PdfCraft](https://github.com/storytold/pdfcraft)는 Rust로 작성된 Acrobat급 오픈소스 PDF 편집기로, 화면 없이 동작하는 CLI(`pdfcraft-cli`)와 131개의 자동화 도구를 제공합니다. 이 [Model Context Protocol](https://modelcontextprotocol.io) 서버는 그 엔진을 Claude용 **"파일을 넣고 파일을 받는" 도구**로 바꿔 주므로, 다음처럼 요청할 수 있습니다.

> *"`D:\scans`의 모든 PDF를 10쪽마다 나누고, 파일마다 폴더를 따로 만들어 줘."*
> *"`~/contracts/nda.pdf`에 '대외비' 워터마크와 '1 / n 페이지' 바닥글을 넣어 줘."*
> *"이 보고서의 이메일 주소와 전화번호를 모두 영구 삭제해 줘."*
> *"이 양식에 이 값들을 채우고 평탄화한 뒤, 원본은 Word로 변환해 줘."*

자매 프로젝트: [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server), [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## 지원 플랫폼

| 운영체제 | 설치할 PdfCraft 패키지 | 서버가 자동으로 찾는 위치(설정 불필요) | 상태 |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI 또는 포터블 zip | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ 검증됨 (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` 또는 `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ 검증됨 (Debian 12, 화면 없음) |
| **macOS** 11 이상 (Apple 실리콘, Intel) | `.dmg`(앱) **그리고** `pdfcraft-cli-<버전>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 지원됨, Mac 실기기에서는 아직 미검증 |

다운로드: [PdfCraft 릴리스](https://github.com/storytold/pdfcraft/releases) (FreeBSD용 tar.gz도 있으니 `PDFCRAFT_DIR`로 지정하세요). 다른 위치에 설치했다면 `PDFCRAFT_DIR`(폴더, `.tar.gz` 루트 또는 `PdfCraft.app`)이나 `PDFCRAFT_CLI`를 설정하세요.

- **macOS:** DMG에는 앱만 들어 있습니다. 별도로 제공되는 `pdfcraft-cli` zip을 풀고 `pdfcraft-cli`를 `/usr/local/bin`으로 옮기세요(또는 `PDFCRAFT_CLI`로 위치를 지정). macOS가 첫 실행을 막으면 *시스템 설정 → 개인정보 보호 및 보안*에서 허용하세요.
- **Linux:** AppImage와 Flatpak에는 앱만 있고 `pdfcraft-cli`는 없습니다. deb, rpm, tar.gz 중 하나를 사용하세요. 앱이 AppImage라면 `open_in_pdfcraft`가 실행할 수 있도록 `PDFCRAFT_APP`을 설정하세요. GPU가 없는 서버에서는 검증된 환경에 `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`를 설치했습니다.
- **OCR**에는 PdfCraft의 문자 인식 모델이 필요합니다(`get_pdfcraft_status`로 설치 여부 확인). 나머지 도구는 모델 없이도 동작합니다.

## 동작 방식

| 구성 요소 | 설명 |
| --- | --- |
| **PdfCraft 엔진** (`pdfcraft-cli mcp`) | PdfCraft 자체의 화면 없는 엔진: 파싱, 렌더링, 편집, 양식, 영구 삭제, 암호화, 서명, 내보내기. 작업마다 전용 임시 폴더에서 새로 시작합니다. |
| **MCP 서버** (Node.js) | 고수준 도구 21개. 엔진에서 문서를 열고 도구를 하나씩 호출하며, 경로를 검증하고 절대 덮어쓰지 않습니다. |

## 도구

| 도구 | 기능 |
| --- | --- |
| `get_pdf_info` | 페이지 수와 크기, 메타데이터, 버전, 보안, 양식 필드, 책갈피, 주석, 링크, 첨부 파일, 글꼴, 서명 |
| `extract_text` | 읽는 순서대로 페이지별 텍스트(`.txt`로 저장 가능) |
| `render_pages` | 페이지를 PNG / JPEG / TIFF로(`<이름>_page_001.png`…), Claude가 볼 수 있는 미리보기 포함 |
| `split_pdf` | N쪽마다, 지정한 쪽 앞에서, 책갈피별 또는 크기별로 분할; 파일마다 폴더 |
| `merge_pdfs` | 페이지 범위(`"1-3, 6"`)를 지정해 PDF 병합 |
| `extract_pages` | 고른 페이지를 새 PDF로, 또는 페이지마다 파일 하나로 |
| `edit_pages` | 파일·빈 페이지 삽입, 복제, 회전, 이동, 삭제, 자르기, 페이지 레이블, 메타데이터 |
| `create_pdf` | 이미지, 텍스트, 빈 페이지로 새 PDF 만들기 |
| `add_content` | 텍스트·그림 워터마크, 머리글·바닥글(쪽 번호, 날짜, 베이츠 번호), 배경, 텍스트 상자, 이미지, 링크 |
| `protect_pdf` | 열기 암호 / 권한 암호(AES-256), 인쇄·복사·변경 제한, 또는 보호 해제 |
| `redact_pdf` | 단어, 패턴(이메일, 전화, SSN, 카드, 날짜), 영역, 페이지의 진짜 영구 삭제와 숨은 정보 제거 |
| `fill_form` | 양식 필드 목록, 자동 감지, 채우기, 평탄화 |
| `sign_pdf` | .p12/.pfx 디지털 ID로 서명(자체 서명 ID 생성 가능) |
| `convert_pdf` | Word, HTML, RTF, 텍스트, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | 파일 크기 줄이기, 숨은 정보 제거(선택) |
| `ocr_pdf` | 스캔한 PDF를 검색 가능하게 |
| `compare_pdfs` | 두 버전의 차이, PDF 보고서, 차이를 주석으로 표시한 사본 |
| `list_pdf_tools` | 엔진의 131개 도구와 스키마 |
| `run_pdf_tools` | 한 세션에서 엔진 도구 아무거나 실행(`$docs[0]`, `$steps[N].경로` 참조) |
| `open_in_pdfcraft` | PdfCraft 앱에서 PDF 열기 |
| `get_pdfcraft_status` | 플랫폼, 설치, 버전, 엔진 도구, OCR |

위치와 크기의 단위는 **포인트**(1/72인치)이며 페이지 **왼쪽 위**가 기준점입니다. 각 페이지 크기는 `get_pdf_info`로 확인할 수 있습니다.

## 예시

```json
{
  "input_path": "/home/me/contracts/nda.pdf",
  "watermark": { "text": "대외비", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Approved", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## 요구 사항

- `pdfcraft-cli`가 포함된 **PdfCraft**(**0.4.0**에서 검증), [지원 플랫폼](#지원-플랫폼) 참고
- Node.js 20 이상(`.mcpb`로 설치하면 Claude Desktop에 포함)

## 설치

### Claude Desktop (권장, 모든 플랫폼)

1. [최신 릴리스](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest)에서 `pdfcraft-mcp-server.mcpb`를 내려받습니다.
2. 더블 클릭하거나 Claude Desktop → *설정 → 확장 프로그램*으로 끌어다 놓고 **설치**를 누릅니다.
3. 선택: PdfCraft가 표준 위치에 없다면 확장 프로그램 설정에서 폴더나 `pdfcraft-cli` 경로를 지정합니다. 접근을 한 폴더로 제한할 수도 있습니다.

### Codex (OpenAI)

**권장 — 마켓플레이스(업데이트 받음):** *플러그인 → 추가 → 마켓플레이스 추가*에서 소스 `jhonsu01/craft-marketplace`, 참조 `main`을 지정한 뒤 **Craft Bridges**에서 **PdfCraft Bridge**를 설치합니다([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). 마켓플레이스를 새로 고치면 새 버전이 설치됩니다. 또는 zip을 업로드합니다(Codex는 계정에 저장하고 같은 이름의 새 zip은 거부합니다):

1. [최신 릴리스](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest)에서 `pdfcraft-mcp-server-<버전>-codex.zip`을 내려받습니다.
2. Codex에서 *플러그인 → 추가 → 새 플러그인*을 열고 zip을 선택한 뒤 **플러그인 추가**를 누릅니다.
3. Codex는 `node`로 서버를 시작하므로 `PATH`에 Node.js ≥ 20이 있어야 합니다. PdfCraft가 표준 위치에 없다면 `PDFCRAFT_DIR` 또는 `PDFCRAFT_CLI`를 시스템 환경 변수로 설정하세요(Codex에는 로컬 플러그인용 설정 화면이 없습니다).

### Claude Code / 기타 MCP 클라이언트

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

## 설정

| 변수 | 의미 |
| --- | --- |
| `PDFCRAFT_DIR` | PdfCraft 설치 폴더, 그 안의 실행 파일, `.tar.gz` 루트(`bin/` 포함) 또는 `PdfCraft.app`. 기본값: 자동 감지 |
| `PDFCRAFT_CLI` | `pdfcraft-cli` / `pdfcraft-cli.exe` 경로(`PDFCRAFT_DIR`보다 우선) |
| `PDFCRAFT_APP` | 데스크톱 앱이 다른 곳에 있을 때의 경로(예: Linux AppImage) |
| `PDFCRAFT_ROOT` | 이 폴더 안의 파일만 허용(`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | 엔진 호출 한 번당 최대 초(기본값 3600) |

## 안전

- `overwrite: true`가 아니면 파일을 **절대 덮어쓰지 않으며**, 입력 파일도 바꾸지 않습니다.
- 모든 경로는 절대 경로여야 합니다. 암호는 결과에 절대 표시되지 않습니다.
- 모든 작업은 네트워크 없이 로컬에서 실행됩니다. 작업마다 전용 엔진과 임시 폴더를 쓰고 끝나면 삭제합니다.

## 개발

```bash
npm run build       # TypeScript + 단일 파일 번들(dist/bundle.cjs)
npm test            # 단위 테스트(Windows, macOS, Linux 경로 처리)
npm run test:e2e    # 실제 MCP stdio를 통한 29개 엔드투엔드 검사(합성 PDF)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # Codex 플러그인 zip
```

Docker에서 Linux 검증(먼저 `pdfcraft-<버전>-linux-x86_64.tar.gz`를 풀어 두세요):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/path/to/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## 라이선스

Apache-2.0. PdfCraft의 저작권은 그 저자(Storytold)에게 있으며 Apache-2.0 라이선스입니다.
이 프로젝트는 PdfCraft 및 Storytold와 관련이 없으며 그들의 승인을 받지 않았습니다. Adobe Acrobat은 Adobe의 상표입니다.

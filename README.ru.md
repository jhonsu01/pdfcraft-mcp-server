<p align="center"><img src="icon.png" width="120" alt="Значок PdfCraft Bridge"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <b>Русский</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Позвольте Claude работать с PDF в <b>PdfCraft</b>, установленном на вашем компьютере, — <b>Windows, macOS и Linux</b>:<br>
  чтение, разделение, объединение, упорядочивание, водяные знаки, защита, удаление данных, формы, подпись, конвертация, сжатие и OCR.
</p>

---

## Зачем

[PdfCraft](https://github.com/storytold/pdfcraft) — PDF-редактор с открытым исходным кодом уровня Acrobat, написанный на Rust, с консольным инструментом без интерфейса (`pdfcraft-cli`) и 131 инструментом автоматизации. Этот сервер [Model Context Protocol](https://modelcontextprotocol.io) превращает движок в **инструменты «файл → файл»** для Claude, и можно просить, например:

> *«Раздели каждый PDF из `D:\scans` по 10 страниц, по папке на файл».*
> *«Добавь водяной знак „КОНФИДЕНЦИАЛЬНО“ и нижний колонтитул „Страница 1 из n“ в `~/contracts/nda.pdf`».*
> *«Удали из этого отчёта все адреса почты и номера телефонов».*
> *«Заполни эту форму этими данными и сведи её, а оригинал преобразуй в Word».*

Родственные проекты: [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) и [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Платформы

| Система | Какой пакет PdfCraft установить | Где сервер его находит (без настройки) | Статус |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI или портативный zip | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ Проверено (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` или `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ Проверено (Debian 12, без графики) |
| **macOS** 11+ (Apple silicon и Intel) | `.dmg` (приложение) **и** `pdfcraft-cli-<версия>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Поддерживается, на Mac ещё не проверено |

Загрузки: [релизы PdfCraft](https://github.com/storytold/pdfcraft/releases) (есть и tar.gz для FreeBSD — укажите его в `PDFCRAFT_DIR`). Если установлено в другом месте, задайте `PDFCRAFT_DIR` (папка, корень `.tar.gz` или `PdfCraft.app`) или `PDFCRAFT_CLI`.

- **macOS:** в DMG только приложение. Распакуйте отдельный zip с `pdfcraft-cli` и переместите `pdfcraft-cli` в `/usr/local/bin` (или укажите путь в `PDFCRAFT_CLI`). Если macOS блокирует первый запуск, разрешите его в *Системных настройках → Конфиденциальность и безопасность*.
- **Linux:** AppImage и Flatpak содержат только приложение, без `pdfcraft-cli`; используйте deb, rpm или tar.gz. Если приложение — AppImage, задайте `PDFCRAFT_APP`, чтобы `open_in_pdfcraft` мог его запустить. На сервере без GPU в проверенной конфигурации использовались `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`.
- **OCR** требует модели распознавания текста PdfCraft (`get_pdfcraft_status` показывает, установлены ли они); остальные инструменты работают без них.

## Как это работает

| Часть | Что это |
| --- | --- |
| **Движок PdfCraft** (`pdfcraft-cli mcp`) | Собственный движок PdfCraft без интерфейса: чтение, рендер, редактирование, формы, удаление данных, шифрование, подписи, экспорт. Для каждой задачи запускается заново во временной папке. |
| **MCP-сервер** (Node.js) | 21 высокоуровневый инструмент. Открывает документы в движке, вызывает инструменты по одному, проверяет пути и никогда ничего не перезаписывает. |

## Инструменты

| Инструмент | Что делает |
| --- | --- |
| `get_pdf_info` | Страницы и размеры, метаданные, версия, защита, поля, закладки, комментарии, ссылки, вложения, шрифты, подписи |
| `extract_text` | Текст по страницам в порядке чтения, при желании с сохранением в `.txt` |
| `render_pages` | Страницы в PNG / JPEG / TIFF (`<имя>_page_001.png`…) с превью, которое видит Claude |
| `split_pdf` | Каждые N страниц, перед заданными страницами, по закладкам или по размеру; по папке на файл |
| `merge_pdfs` | Объединяет PDF с диапазонами страниц (`"1-3, 6"`) |
| `extract_pages` | Выбранные страницы в новый PDF или по файлу на страницу |
| `edit_pages` | Вставка файлов или пустых страниц, дублирование, поворот, перемещение, удаление, обрезка, метки страниц, метаданные |
| `create_pdf` | Новый PDF из изображений, текста или пустых страниц |
| `add_content` | Текстовые или графические водяные знаки, колонтитулы (номера страниц, даты, Бейтс), фон, текстовые блоки, изображения, ссылки |
| `protect_pdf` | Пароль на открытие / права (AES-256), запрет печати / копирования / изменений, или снятие защиты |
| `redact_pdf` | Настоящее удаление слов, шаблонов (почта, телефон, SSN, карта, дата), областей или страниц, плюс очистка скрытых данных |
| `fill_form` | Список, автопоиск, заполнение и сведение полей формы |
| `sign_pdf` | Цифровая подпись ID-файлом .p12/.pfx (или создание самоподписанного) |
| `convert_pdf` | Word, HTML, RTF, текст, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | Уменьшает размер, при желании удаляет скрытые данные |
| `ocr_pdf` | Делает отсканированные PDF доступными для поиска |
| `compare_pdfs` | Различия между двумя версиями, отчёт в PDF, размеченная копия |
| `list_pdf_tools` | 131 инструмент движка со схемами |
| `run_pdf_tools` | Любые инструменты движка в одной сессии (ссылки `$docs[0]`, `$steps[N].путь`) |
| `open_in_pdfcraft` | Открывает PDF в приложении PdfCraft |
| `get_pdfcraft_status` | Платформа, установка, версия, инструменты движка, OCR |

Координаты и размеры — в **пунктах** (1/72 дюйма) от **левого верхнего угла** страницы; `get_pdf_info` даёт размер каждой страницы.

## Пример

```json
{
  "input_path": "/home/me/contracts/nda.pdf",
  "watermark": { "text": "КОНФИДЕНЦИАЛЬНО", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Одобрено", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## Требования

- **PdfCraft** с `pdfcraft-cli` (проверено на **0.4.0**); см. [Платформы](#платформы)
- Node.js ≥ 20 (входит в Claude Desktop при установке `.mcpb`)

## Установка

### Claude Desktop (рекомендуется, все платформы)

1. Скачайте `pdfcraft-mcp-server.mcpb` из [последнего релиза](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. Дважды щёлкните по нему (или перетащите в Claude Desktop → *Настройки → Расширения*) и нажмите **Установить**.
3. Необязательно: если PdfCraft установлен не в стандартное место, укажите его папку или путь к `pdfcraft-cli` в настройках расширения. Также можно ограничить его одной папкой.

### Codex (OpenAI)

**Рекомендуется — маркетплейс (получает обновления):** *Плагины → Добавить → Добавить маркетплейс*, источник `jhonsu01/craft-marketplace`, ссылка `main`, затем установите **PdfCraft Bridge** из **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Новые версии приходят при обновлении маркетплейса. Или загрузите zip (Codex сохранит его в вашей учётной записи и отклонит более новый zip с тем же именем):

1. Скачайте `pdfcraft-mcp-server-<версия>-codex.zip` из [последнего релиза](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. В Codex: *Плагины → Добавить → Новый плагин*, выберите zip и нажмите **Добавить плагин**.
3. Codex запускает сервер через `node`, поэтому Node.js ≥ 20 должен быть в `PATH`. Если PdfCraft установлен не в стандартное место, задайте `PDFCRAFT_DIR` или `PDFCRAFT_CLI` как системные переменные окружения (у Codex нет формы настроек для локальных плагинов).

### DeepSeek Harness

1. *Plugins → Add plugin*, введите `github:jhonsu01/craft-marketplace#path:/plugins/pdfcraft-mcp-server` и нажмите **Install**, затем **Enable now**.
2. Harness запускает сервер через свой MCP-клиент и `node` (Node.js ≥ 20 в `PATH`); инструменты появляются как `mcp__pdfcraft__<инструмент>`, а выходные файлы — как карточки, которые открываются в Harness.
3. Harness пока не обновляет плагины сам: чтобы обновить, удалите плагин и установите его снова по тому же адресу.

### Claude Code / другие MCP-клиенты

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

## Настройка

| Переменная | Значение |
| --- | --- |
| `PDFCRAFT_DIR` | Папка PdfCraft, один из его исполняемых файлов, корень `.tar.gz` (с `bin/`) или `PdfCraft.app`. По умолчанию: автоопределение |
| `PDFCRAFT_CLI` | Путь к `pdfcraft-cli` / `pdfcraft-cli.exe` (важнее, чем `PDFCRAFT_DIR`) |
| `PDFCRAFT_APP` | Путь к настольному приложению, если оно в другом месте (например, AppImage в Linux) |
| `PDFCRAFT_ROOT` | Разрешить только файлы внутри этой папки (`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | Максимум секунд на один вызов движка (по умолчанию 3600) |

## Безопасность

- Файлы **никогда не перезаписываются** без `overwrite: true`; исходные файлы не изменяются.
- Все пути должны быть абсолютными. Пароли никогда не попадают в результаты.
- Всё работает локально, без доступа к сети. Каждая задача использует отдельный движок во временной папке, которая затем удаляется.

## Разработка

```bash
npm run build       # TypeScript + бандл в один файл (dist/bundle.cjs)
npm test            # модульные тесты (логика путей Windows, macOS и Linux)
npm run test:e2e    # 29 сквозных проверок через реальный MCP stdio (синтетические PDF)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # zip-плагин для Codex
```

Проверка Linux в Docker (сначала распакуйте `pdfcraft-<версия>-linux-x86_64.tar.gz`):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/путь/к/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## Лицензия

Apache-2.0. PdfCraft © его авторы (Storytold), Apache-2.0.
Проект не связан с PdfCraft и Storytold и не одобрен ими. Adobe Acrobat — товарный знак Adobe.

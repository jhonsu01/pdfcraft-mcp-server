# Changelog

## [1.0.0] - 2026-10-09
### Added
- MCP server on PdfCraft's own headless engine (`pdfcraft-cli mcp`), one private engine per job, calls sent
  one at a time so document ids carry from one call to the next.
- 21 tools: `get_pdf_info`, `extract_text`, `render_pages`, `split_pdf`, `merge_pdfs`, `extract_pages`,
  `edit_pages`, `create_pdf`, `add_content` (watermarks, headers/footers, backgrounds, text, images, links),
  `protect_pdf`, `redact_pdf`, `fill_form`, `sign_pdf`, `convert_pdf` (Word, HTML, RTF, text, images, PDF/A),
  `optimize_pdf`, `ocr_pdf`, `compare_pdfs`, `list_pdf_tools`, `run_pdf_tools` (any of the 131 engine tools,
  `$docs` / `$steps` references), `open_in_pdfcraft`, `get_pdfcraft_status`.
- Windows, macOS and Linux: the installation is found without setup (Program Files, deb/rpm in /usr/bin,
  tar.gz in /opt/pdfcraft/bin, PdfCraft.app plus the CLI zip, PATH); `PDFCRAFT_DIR`, `PDFCRAFT_CLI`,
  `PDFCRAFT_APP`, `PDFCRAFT_ROOT` settings.
- Input schemas use plain arrays only (no JSON Schema tuples), so APIs that reject tuples accept every tool.
- README in 9 languages.
### Verified
- Windows 11 and Debian 12 (Docker, headless, PdfCraft 0.4.0 tar.gz): 28/28 end-to-end checks each.
  macOS is supported by the same code paths but not yet tested on a Mac. OCR needs PdfCraft's models.

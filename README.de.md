<p align="center"><img src="icon.png" width="120" alt="PdfCraft-Bridge-Symbol"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <b>Deutsch</b> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Lass Claude mit dem auf deinem Rechner installierten <b>PdfCraft</b> an PDFs arbeiten — <b>Windows, macOS und Linux</b>:<br>
  lesen, teilen, zusammenfügen, ordnen, kennzeichnen, schützen, schwärzen, ausfüllen, signieren, konvertieren, komprimieren und OCR.
</p>

---

## Warum

[PdfCraft](https://github.com/storytold/pdfcraft) ist ein quelloffener PDF-Editor auf Acrobat-Niveau, geschrieben in Rust, mit einer CLI ohne Oberfläche (`pdfcraft-cli`) und 131 Automatisierungswerkzeugen. Dieser [Model Context Protocol](https://modelcontextprotocol.io)-Server macht aus dieser Engine **Datei-zu-Datei-Werkzeuge** für Claude, sodass du zum Beispiel fragen kannst:

> *„Teile jedes PDF in `D:\scans` alle 10 Seiten, ein Ordner pro Datei.“*
> *„Füge `~/vertraege/nda.pdf` das Wasserzeichen ‚VERTRAULICH‘ und die Fußzeile ‚Seite 1 von n‘ hinzu.“*
> *„Schwärze alle E-Mail-Adressen und Telefonnummern in diesem Bericht.“*
> *„Fülle dieses Formular mit diesen Werten aus und reduziere es, dann konvertiere das Original nach Word.“*

Geschwisterprojekt von [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) und [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plattformen

| System | Zu installierendes PdfCraft-Paket | Wo der Server es findet (ohne Einrichtung) | Status |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI oder portables Zip | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ Geprüft (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` oder `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ Geprüft (Debian 12, ohne Oberfläche) |
| **macOS** 11+ (Apple Silicon und Intel) | `.dmg` (die App) **plus** `pdfcraft-cli-<version>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Unterstützt, noch nicht auf einem Mac getestet |

Downloads: [PdfCraft-Releases](https://github.com/storytold/pdfcraft/releases) (es gibt auch ein tar.gz für FreeBSD; `PDFCRAFT_DIR` darauf setzen). An anderen Orten: `PDFCRAFT_DIR` (Ordner, Wurzel des `.tar.gz` oder `PdfCraft.app`) oder `PDFCRAFT_CLI` setzen.

- **macOS:** Das DMG enthält nur die App. Entpacke das separate `pdfcraft-cli`-Zip und verschiebe `pdfcraft-cli` nach `/usr/local/bin` (oder setze `PDFCRAFT_CLI` darauf). Blockiert macOS den ersten Start, erlaube ihn unter *Systemeinstellungen → Datenschutz & Sicherheit*.
- **Linux:** AppImage und Flatpak enthalten nur die App, kein `pdfcraft-cli`; nutze deb, rpm oder tar.gz. Ist die App ein AppImage, setze `PDFCRAFT_APP`, damit `open_in_pdfcraft` sie starten kann. Auf einem Server ohne GPU nutzte die geprüfte Umgebung `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`.
- **OCR** braucht die Texterkennungsmodelle von PdfCraft (`get_pdfcraft_status` zeigt, ob sie installiert sind); alle anderen Werkzeuge funktionieren ohne sie.

## Funktionsweise

| Teil | Was es ist |
| --- | --- |
| **PdfCraft-Engine** (`pdfcraft-cli mcp`) | PdfCrafts eigene Engine ohne Oberfläche: Lesen, Rendern, Bearbeiten, Formulare, Schwärzen, Verschlüsselung, Signaturen, Exporter. Für jeden Auftrag frisch gestartet, in einem privaten temporären Ordner. |
| **MCP-Server** (Node.js) | 21 Werkzeuge auf hoher Ebene. Öffnet die Dokumente in der Engine, führt die Werkzeuge nacheinander aus, prüft Pfade und überschreibt nie etwas. |

## Werkzeuge

| Werkzeug | Funktion |
| --- | --- |
| `get_pdf_info` | Seiten und Größen, Metadaten, Version, Sicherheit, Felder, Lesezeichen, Kommentare, Links, Anhänge, Schriften, Signaturen |
| `extract_text` | Text pro Seite in Lesereihenfolge, optional als `.txt` gespeichert |
| `render_pages` | Seiten als PNG / JPEG / TIFF (`<name>_page_001.png`…), mit einer Vorschau, die Claude sieht |
| `split_pdf` | Alle N Seiten, vor bestimmten Seiten, nach Lesezeichen oder nach Größe; ein Ordner pro Datei |
| `merge_pdfs` | PDFs mit Seitenbereichen (`"1-3, 6"`) zusammenfügen |
| `extract_pages` | Gewählte Seiten in ein neues PDF oder eine Datei pro Seite |
| `edit_pages` | Dateien oder leere Seiten einfügen, duplizieren, drehen, verschieben, löschen, beschneiden, Seitenbeschriftungen, Metadaten |
| `create_pdf` | Neues PDF aus Bildern, Text oder leeren Seiten |
| `add_content` | Text- oder Bild-Wasserzeichen, Kopf- und Fußzeilen (Seitenzahlen, Datum, Bates), Hintergründe, Textfelder, Bilder, Links |
| `protect_pdf` | Öffnungs- / Berechtigungskennwort (AES-256), Einschränkungen für Drucken / Kopieren / Ändern, oder entsperren |
| `redact_pdf` | Echtes Schwärzen von Wörtern, Mustern (E-Mail, Telefon, SSN, Karte, Datum), Bereichen oder Seiten, plus Bereinigung versteckter Informationen |
| `fill_form` | Formularfelder auflisten, erkennen, ausfüllen und reduzieren |
| `sign_pdf` | Digitale Signatur mit einer .p12/.pfx-ID (oder eine selbstsignierte erstellen) |
| `convert_pdf` | Word, HTML, RTF, Text, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | Dateigröße reduzieren, optional versteckte Informationen entfernen |
| `ocr_pdf` | Gescannte PDFs durchsuchbar machen |
| `compare_pdfs` | Unterschiede zwischen zwei Versionen, Bericht als PDF, markierte Kopie |
| `list_pdf_tools` | Die 131 Engine-Werkzeuge mit Schemas |
| `run_pdf_tools` | Beliebige Engine-Werkzeuge in einer Sitzung (Verweise `$docs[0]`, `$steps[N].pfad`) |
| `open_in_pdfcraft` | Öffnet PDFs in der PdfCraft-App |
| `get_pdfcraft_status` | Plattform, Installation, Version, Engine-Werkzeuge, OCR |

Positionen und Größen in **Punkt** (1/72 Zoll) von der **oberen linken Ecke** der Seite; `get_pdf_info` liefert jede Seitengröße.

## Beispiel

```json
{
  "input_path": "/home/ich/vertraege/nda.pdf",
  "watermark": { "text": "VERTRAULICH", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Genehmigt", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## Voraussetzungen

- **PdfCraft** mit `pdfcraft-cli` (getestet mit **0.4.0**); siehe [Plattformen](#plattformen)
- Node.js ≥ 20 (bei `.mcpb`-Installationen in Claude Desktop enthalten)

## Installation

### Claude Desktop (empfohlen, alle Plattformen)

1. Lade `pdfcraft-mcp-server.mcpb` aus dem [neuesten Release](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest) herunter.
2. Doppelklicke darauf (oder ziehe es in Claude Desktop → *Einstellungen → Erweiterungen*) und klicke auf **Installieren**.
3. Optional: Liegt PdfCraft nicht an einem Standardort, gib den Ordner oder den Pfad von `pdfcraft-cli` in den Einstellungen der Erweiterung an. Du kannst es auch auf einen Ordner beschränken.

### Claude Code / andere MCP-Clients

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

## Konfiguration

| Variable | Bedeutung |
| --- | --- |
| `PDFCRAFT_DIR` | PdfCraft-Ordner, eine seiner ausführbaren Dateien, die Wurzel eines `.tar.gz` (mit `bin/`) oder `PdfCraft.app`. Standard: automatische Erkennung |
| `PDFCRAFT_CLI` | Pfad zu `pdfcraft-cli` / `pdfcraft-cli.exe` (hat Vorrang vor `PDFCRAFT_DIR`) |
| `PDFCRAFT_APP` | Pfad der Desktop-App, falls sie woanders liegt (z. B. ein Linux-AppImage) |
| `PDFCRAFT_ROOT` | Nur Dateien in diesem Ordner erlauben (`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | Maximale Sekunden pro Engine-Aufruf (Standard 3600) |

## Sicherheit

- Dateien werden **nie überschrieben**, außer mit `overwrite: true`; Eingaben werden nie verändert.
- Alle Pfade müssen absolut sein. Kennwörter erscheinen nie in den Ergebnissen.
- Alles läuft lokal ohne Netzwerkzugriff. Jeder Auftrag nutzt eine private Engine in einem temporären Ordner, der danach gelöscht wird.

## Entwicklung

```bash
npm run build       # TypeScript + Einzeldatei-Bundle (dist/bundle.cjs)
npm test            # Unit-Tests (Pfadlogik für Windows, macOS und Linux)
npm run test:e2e    # 28 End-to-End-Prüfungen über echtes MCP stdio (synthetische PDFs)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
```

Linux-Test in Docker (vorher `pdfcraft-<version>-linux-x86_64.tar.gz` entpacken):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/pfad/zu/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## Lizenz

Apache-2.0. PdfCraft ist © seiner Autoren (Storytold), Apache-2.0.
Dieses Projekt ist weder mit PdfCraft noch mit Storytold verbunden oder von ihnen unterstützt. Adobe Acrobat ist eine Marke von Adobe.

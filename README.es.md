<p align="center"><img src="icon.png" width="120" alt="Ícono de PdfCraft Bridge"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <b>Español</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Deja que Claude trabaje con PDF usando el <b>PdfCraft</b> instalado en tu equipo — <b>Windows, macOS y Linux</b>:<br>
  leer, dividir, unir, organizar, marcar, proteger, censurar, rellenar, firmar, convertir, comprimir y hacer OCR.
</p>

---

## Por qué

[PdfCraft](https://github.com/storytold/pdfcraft) es un editor de PDF de código abierto, al nivel de Acrobat, escrito en Rust, con una CLI sin interfaz (`pdfcraft-cli`) y 131 herramientas de automatización. Este servidor [Model Context Protocol](https://modelcontextprotocol.io) convierte ese motor en **herramientas de archivo a archivo** para Claude, para pedir cosas como:

> *"Divide cada PDF de `D:\escaneos` cada 10 páginas, una carpeta por archivo."*
> *"Ponle la marca de agua 'CONFIDENCIAL' y el pie 'Página 1 de n' a `~/contratos/nda.pdf`."*
> *"Censura todos los correos y teléfonos de este informe."*
> *"Rellena este formulario con estos datos y aplánalo; luego convierte el original a Word."*

Hermano de [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) y [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plataformas

| Sistema | Paquete de PdfCraft a instalar | Dónde lo encuentra el servidor (sin configurar) | Estado |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI o zip portable | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ Verificado (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` o `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ Verificado (Debian 12, sin interfaz) |
| **macOS** 11+ (Apple silicon e Intel) | `.dmg` (la app) **más** `pdfcraft-cli-<versión>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Soportado, aún sin probar en un Mac |

Descargas: [versiones de PdfCraft](https://github.com/storytold/pdfcraft/releases) (también hay un tar.gz para FreeBSD; apunta `PDFCRAFT_DIR` a él). En cualquier otra ubicación: define `PDFCRAFT_DIR` (carpeta, raíz del `.tar.gz` o `PdfCraft.app`) o `PDFCRAFT_CLI`.

- **macOS:** el DMG solo trae la app. Descomprime el zip aparte de `pdfcraft-cli` y mueve `pdfcraft-cli` a `/usr/local/bin` (o apunta `PDFCRAFT_CLI` a él). Si macOS bloquea su primera ejecución, permítela en *Ajustes del Sistema → Privacidad y seguridad*.
- **Linux:** el AppImage y el Flatpak solo traen la app, no `pdfcraft-cli`; usa el deb, el rpm o el tar.gz. Si la app es un AppImage, define `PDFCRAFT_APP` para que `open_in_pdfcraft` pueda iniciarla. En un servidor sin GPU, la configuración verificada usó `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`.
- **OCR** necesita los modelos de reconocimiento de texto de PdfCraft (`get_pdfcraft_status` indica si están instalados); todas las demás herramientas funcionan sin ellos.

## Cómo funciona

| Parte | Qué es |
| --- | --- |
| **Motor de PdfCraft** (`pdfcraft-cli mcp`) | El propio motor sin interfaz de PdfCraft: lectura, render, edición, formularios, censura, cifrado, firmas, exportadores. Se inicia limpio para cada trabajo en una carpeta temporal privada. |
| **Servidor MCP** (Node.js) | 21 herramientas de alto nivel. Abre los documentos en el motor, ejecuta las herramientas una a una, valida rutas y nunca sobrescribe. |

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `get_pdf_info` | Páginas y tamaños, metadatos, versión, seguridad, campos, marcadores, comentarios, enlaces, adjuntos, fuentes, firmas |
| `extract_text` | Texto por página en orden de lectura, opcionalmente guardado como `.txt` |
| `render_pages` | Páginas como PNG / JPEG / TIFF (`<nombre>_page_001.png`…), con una vista previa que Claude puede ver |
| `split_pdf` | Cada N páginas, antes de ciertas páginas, por marcadores o por tamaño; una carpeta por archivo |
| `merge_pdfs` | Une PDF con rangos de páginas (`"1-3, 6"`) |
| `extract_pages` | Páginas elegidas a un PDF nuevo, o un archivo por página |
| `edit_pages` | Insertar archivos o páginas en blanco, duplicar, rotar, mover, eliminar, recortar, etiquetas de página, metadatos |
| `create_pdf` | PDF nuevo desde imágenes, texto o páginas en blanco |
| `add_content` | Marcas de agua de texto o imagen, encabezados y pies (números de página, fechas, Bates), fondos, cuadros de texto, imágenes, enlaces |
| `protect_pdf` | Contraseñas de apertura / permisos (AES-256), restricciones de impresión / copia / cambios, o desbloquear |
| `redact_pdf` | Censura real de palabras, patrones (correo, teléfono, SSN, tarjeta, fecha), áreas o páginas, más limpieza de información oculta |
| `fill_form` | Listar, detectar, rellenar y aplanar campos de formulario |
| `sign_pdf` | Firma digital con un ID .p12/.pfx (o crea uno autofirmado) |
| `convert_pdf` | Word, HTML, RTF, texto, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | Reduce el tamaño, opcionalmente elimina información oculta |
| `ocr_pdf` | Hace buscables los PDF escaneados |
| `compare_pdfs` | Diferencias entre dos versiones, informe en PDF, copia marcada |
| `list_pdf_tools` | Las 131 herramientas del motor, con esquemas |
| `run_pdf_tools` | Cualquier herramienta del motor en una sesión (referencias `$docs[0]`, `$steps[N].ruta`) |
| `open_in_pdfcraft` | Abre PDF en la app de PdfCraft |
| `get_pdfcraft_status` | Plataforma, instalación, versión, herramientas del motor, OCR |

Las posiciones y tamaños van en **puntos** (1/72 de pulgada) desde la **esquina superior izquierda** de la página; `get_pdf_info` da el tamaño de cada página.

## Ejemplo

```json
{
  "input_path": "/home/yo/contratos/nda.pdf",
  "watermark": { "text": "CONFIDENCIAL", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Aprobado", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## Requisitos

- **PdfCraft** con `pdfcraft-cli` (probado con **0.4.0**); ver [Plataformas](#plataformas)
- Node.js ≥ 20 (incluido en Claude Desktop para instalaciones `.mcpb`)

## Instalación

### Claude Desktop (recomendado, todas las plataformas)

1. Descarga `pdfcraft-mcp-server.mcpb` de la [última versión](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. Haz doble clic (o arrástralo a Claude Desktop → *Configuración → Extensiones*) y pulsa **Instalar**.
3. Opcional: si PdfCraft no está en una ubicación estándar, indica su carpeta o la ruta de `pdfcraft-cli` en la configuración de la extensión. También puedes limitarlo a una sola carpeta.

### Codex (OpenAI)

**Recomendado — el marketplace (recibe actualizaciones):** *Complementos → Añadir → Añadir marketplace*, origen `jhonsu01/craft-marketplace`, referencia `main`, y luego instala **PdfCraft Bridge** desde **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Las versiones nuevas llegan al actualizar el marketplace. O sube el zip (Codex lo guarda en tu cuenta y rechaza un zip más nuevo con el mismo nombre):

1. Descarga `pdfcraft-mcp-server-<versión>-codex.zip` de la [última versión](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. En Codex: *Complementos → Añadir → Nuevo complemento*, elige el zip y pulsa **Añadir complemento**.
3. Codex arranca el servidor con `node`, así que Node.js ≥ 20 debe estar en el `PATH`. Si PdfCraft no está en una ubicación estándar, define `PDFCRAFT_DIR` o `PDFCRAFT_CLI` como variables de entorno del sistema (Codex no tiene formulario de configuración para complementos locales).

### DeepSeek Harness

1. *Plugins → Add plugin*, escribe `github:jhonsu01/craft-marketplace#path:/plugins/pdfcraft-mcp-server` y pulsa **Install** y luego **Enable now**.
2. Harness arranca el servidor con su propio cliente MCP y `node` (Node.js ≥ 20 en el `PATH`); las herramientas aparecen como `mcp__pdfcraft__<herramienta>` y los archivos de salida como tarjetas que se abren en Harness.
3. Harness aún no actualiza los plugins por sí solo: para actualizar, desinstala el plugin y vuelve a instalarlo con la misma dirección.

### Claude Code / otros clientes MCP

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

## Configuración

| Variable | Significado |
| --- | --- |
| `PDFCRAFT_DIR` | Carpeta de PdfCraft, uno de sus ejecutables, la raíz de un `.tar.gz` (con `bin/`) o `PdfCraft.app`. Por defecto: detección automática |
| `PDFCRAFT_CLI` | Ruta de `pdfcraft-cli` / `pdfcraft-cli.exe` (tiene prioridad sobre `PDFCRAFT_DIR`) |
| `PDFCRAFT_APP` | Ruta de la app de escritorio si está en otro lugar (p. ej. un AppImage de Linux) |
| `PDFCRAFT_ROOT` | Solo permite archivos dentro de esta carpeta (`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | Segundos máximos por llamada al motor (por defecto 3600) |

## Seguridad

- Los archivos **nunca se sobrescriben** salvo con `overwrite: true`; las entradas nunca se modifican.
- Todas las rutas deben ser absolutas. Las contraseñas nunca aparecen en los resultados.
- Todo se ejecuta en local, sin acceso a red. Cada trabajo usa un motor privado en una carpeta temporal que se borra al terminar.

## Desarrollo

```bash
npm run build       # TypeScript + bundle de un solo archivo (dist/bundle.cjs)
npm test            # pruebas unitarias (lógica de rutas de Windows, macOS y Linux)
npm run test:e2e    # 29 pruebas de extremo a extremo por MCP stdio real (PDF sintéticos)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # zip de complemento para Codex
```

Prueba de Linux en Docker (descomprime antes `pdfcraft-<versión>-linux-x86_64.tar.gz`):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/ruta/a/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## Licencia

Apache-2.0. PdfCraft es © de sus autores (Storytold), Apache-2.0.
Este proyecto no está afiliado ni respaldado por PdfCraft ni Storytold. Adobe Acrobat es una marca de Adobe.

import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAdvancedTools } from './tools/advanced.js';
import { registerContentTools } from './tools/content.js';
import { registerPageTools } from './tools/pages.js';

/** serverInfo.version comes from package.json (reachable as ../package.json from dist/ and src/). */
export function readPackageVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(dir, '../package.json'), 'utf-8')) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
  } catch {
    // package.json not shipped next to the bundle: still start
  }
  return '0.0.0-unknown';
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'pdfcraft-mcp-server', version: readPackageVersion() },
    {
      instructions:
        'Works on PDF files with the engine of the locally installed PdfCraft (Windows, macOS, Linux), an open-source Acrobat-class ' +
        'editor: info and text, page images, split / merge / extract / organize pages, watermarks, headers and footers, text and images, ' +
        'passwords, redaction, forms, digital signatures, conversion to Word / HTML / RTF / text / images / PDF/A, file-size reduction, ' +
        'OCR and comparison. All paths must be absolute; files are never overwritten unless overwrite is true. Positions are in points ' +
        '(1/72 inch) from the top-left of the page. Call get_pdfcraft_status first if unsure PdfCraft is installed; list_pdf_tools and ' +
        'run_pdf_tools reach all 131 engine tools (comments, bookmarks, links, accessibility, measurements, JavaScript...).',
    },
  );
  registerPageTools(server);
  registerContentTools(server);
  registerAdvancedTools(server);
  return server;
}

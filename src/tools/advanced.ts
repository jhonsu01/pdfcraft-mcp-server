import { spawn } from 'child_process';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { COMMAND_TIMEOUT_SEC, resolveInstall, resolveRoot } from '../config.js';
import { runCli, withSession } from '../engine.js';
import {
  READ, WRITE, collectInputs, errorResult, fileSize, inputsOf, inputsSchema, json, moveNumbered, nativePath, openDoc,
  outputFor, outputSchema, pagesSchema, passwordSchema, removeDir, requireEditable, saveAs, stagingDir, stemOf, toEnginePath,
} from './common.js';

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  read_only?: boolean;
  command?: string;
}

let toolCache: ToolDef[] | undefined;
export async function engineTools(): Promise<ToolDef[]> {
  if (!toolCache) toolCache = JSON.parse(await runCli(['tools'])) as ToolDef[];
  return toolCache;
}

/** Run fn over every input in its own session and shape single / batch results the same way. */
async function batch(inputs: string[], fn: (input: string) => Promise<Record<string, unknown>>) {
  const results: Record<string, unknown>[] = [];
  for (const input of inputs) {
    try {
      results.push(await fn(input));
    } catch (e) {
      results.push({ success: false, input, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const ok = results.filter((r) => r['success']).length;
  if (inputs.length === 1) return json(results[0], !ok);
  return json({ success: ok === inputs.length, total: inputs.length, succeeded: ok, results }, ok === 0);
}

export function registerAdvancedTools(server: McpServer): void {
  server.registerTool(
    'convert_pdf',
    {
      title: 'Convert PDF',
      description:
        'Convert one or many PDFs: to Word (.docx), HTML or RTF (paragraphs in reading order, headings, bold/italic, images), plain text ' +
        '(.txt), page images (png / jpeg / tiff into a folder) or PDF/A (pdfa-2b / pdfa-3b archival, reporting what could not be fixed, ' +
        'e.g. fonts that are not embedded).',
      inputSchema: {
        ...inputsSchema,
        to: z.enum(['docx', 'html', 'rtf', 'txt', 'png', 'jpeg', 'tiff', 'pdfa-2b', 'pdfa-3b']),
        pages: pagesSchema,
        dpi: z.number().min(18).max(1200).default(150).describe('Images only.'),
        ...outputSchema,
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path only works with one input; use output_dir.');
        return await batch(inputs, (input) =>
          withSession(async (s) => {
            const d = await openDoc(s, input, args.password);
            const scope = args.pages ? { pages: args.pages } : {};
            if (args.to === 'png' || args.to === 'jpeg' || args.to === 'tiff') {
              const stem = stemOf(input);
              const dir = args.output_dir ? (inputs.length > 1 ? path.join(args.output_dir, stem) : args.output_dir) : path.join(path.dirname(input), `${stem}_pages`);
              const staging = stagingDir(dir);
              try {
                const r = await s.json('doc_export_images', { doc: d.doc, folder: toEnginePath(staging), dpi: args.dpi, format: args.to, ...scope });
                const files = moveNumbered(((r['files'] ?? []) as string[]).map(nativePath), dir, `${stem}_page`, args.overwrite);
                return { success: true, input, output_dir: dir, count: files.length, files };
              } finally {
                removeDir(staging);
              }
            }
            if (args.to === 'pdfa-2b' || args.to === 'pdfa-3b') {
              requireEditable(d, input);
              const level = args.to.slice(5);
              const r = await s.json('pdfa_convert', { doc: d.doc, level });
              const out = outputFor(input, 'pdf', `_pdfa${level}`, args);
              const saved = await saveAs(s, d.doc, out);
              return { success: true, input, output: saved.path, level: `PDF/A-${level}`, compliant: r['compliant'], remaining_issues: r['issues'] };
            }
            const out = outputFor(input, args.to, '', args);
            if (args.to === 'txt') await s.json('doc_export_text', { doc: d.doc, path: toEnginePath(out), ...scope });
            else await s.json('doc_export_office', { doc: d.doc, path: toEnginePath(out) });
            return { success: true, input, output: out, bytes: fileSize(out) };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'optimize_pdf',
    {
      title: 'Reduce file size',
      description:
        'Write smaller copies of one or many PDFs (default <name>_reduced.pdf): Acrobat\'s Reduce File Size (images above 225 ppi ' +
        'downsampled to 150 ppi and JPEG-compressed, duplicate fonts/images merged, unused objects dropped). sanitize=true first removes ' +
        'hidden information (metadata, attachments, comments, scripts, hidden layers...). Returns the sizes before and after.',
      inputSchema: {
        ...inputsSchema,
        sanitize: z.boolean().default(false),
        ...outputSchema,
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path only works with one input; use output_dir.');
        return await batch(inputs, (input) =>
          withSession(async (s) => {
            const d = await openDoc(s, input, args.password);
            let removed: unknown;
            if (args.sanitize) {
              requireEditable(d, input);
              removed = await s.json('doc_remove_hidden', { doc: d.doc });
            }
            const out = outputFor(input, 'pdf', '_reduced', args);
            const r = await s.json('doc_reduce', { doc: d.doc, path: toEnginePath(out) });
            const before = fileSize(input);
            const after = Number(r['bytes_after'] ?? fileSize(out));
            return {
              success: true,
              input,
              output: out,
              bytes_before: before,
              bytes_after: after,
              saved_percent: before ? Math.round((1 - after / before) * 1000) / 10 : 0,
              ...(removed ? { sanitized: removed } : {}),
            };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'ocr_pdf',
    {
      title: 'OCR scanned PDFs',
      description:
        'Make scanned PDFs searchable: recognize the words on each page and add them as invisible text over the image (the image is ' +
        'unchanged). Pages that already have text are skipped. Saves <name>_ocr.pdf. Needs PdfCraft\'s OCR models; get_pdfcraft_status ' +
        'says whether they are installed.',
      inputSchema: {
        ...inputsSchema,
        pages: pagesSchema,
        dpi: z.number().min(72).max(600).optional().describe('Reading resolution (default 300).'),
        ...outputSchema,
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path only works with one input; use output_dir.');
        return await batch(inputs, (input) =>
          withSession(async (s) => {
            const st = await s.json('ocr_status');
            if (!st['available']) {
              throw new Error(
                `PdfCraft's OCR models are not installed (looked in ${(st['search_dirs'] ?? []).join(', ')}). Set PDFCRAFT_MODELS to a folder ` +
                  'with them (see https://github.com/storytold/pdfcraft).',
              );
            }
            const d = await openDoc(s, input, args.password);
            requireEditable(d, input);
            const r = await s.json('ocr_recognize', { doc: d.doc, ...(args.pages ? { pages: args.pages } : {}), ...(args.dpi ? { dpi: args.dpi } : {}) });
            const out = outputFor(input, 'pdf', '_ocr', args);
            const saved = await saveAs(s, d.doc, out);
            return { success: true, input, output: saved.path, pages: r['pages'] ?? r };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'compare_pdfs',
    {
      title: 'Compare two PDFs',
      description:
        'Compare the text of an older and a newer version: every replaced, inserted and deleted passage with its pages. Optionally write ' +
        'a summary report PDF and/or a copy of the newer PDF with the differences marked as comments. visual=true also finds regions ' +
        'that look different.',
      inputSchema: {
        old_path: z.string().describe('Absolute path of the older PDF.'),
        new_path: z.string().describe('Absolute path of the newer PDF.'),
        old_password: passwordSchema,
        new_password: passwordSchema,
        visual: z.boolean().default(false),
        limit: z.number().int().min(1).default(200).describe('Most changes listed.'),
        report_path: z.string().optional().describe('Absolute .pdf for the summary report.'),
        marked_path: z.string().optional().describe('Absolute .pdf: the newer PDF with the changes marked as comments.'),
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const [oldP, newP] = collectInputs([args.old_path, args.new_path]);
        return json(
          await withSession(async (s) => {
            const older = await openDoc(s, oldP, args.old_password);
            const newer = await openDoc(s, newP, args.new_password);
            const r = await s.json('doc_compare', { doc: newer.doc, other: older.doc, limit: args.limit, visual: args.visual });
            const out: Record<string, unknown> = { success: true, old: oldP, new: newP, ...r };
            if (args.report_path) {
              const p = outputFor(newP, 'pdf', '', { output_path: args.report_path, overwrite: args.overwrite });
              await s.json('doc_compare_report', { doc: newer.doc, other: older.doc, path: toEnginePath(p) });
              out['report'] = p;
            }
            if (args.marked_path) {
              const p = outputFor(newP, 'pdf', '', { output_path: args.marked_path, overwrite: args.overwrite });
              await s.json('doc_compare_mark', { doc: newer.doc, other: older.doc });
              await saveAs(s, newer.doc, p);
              out['marked'] = p;
            }
            return out;
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'list_pdf_tools',
    {
      title: 'List PdfCraft engine tools',
      description:
        'PdfCraft\'s 131 engine tools (comments, bookmarks, links, measurements, forms and their scripts, accessibility, layers, ' +
        'JavaScript, Action Wizard, printing...) with descriptions; schemas=true adds their JSON input schemas. Use them with run_pdf_tools.',
      inputSchema: {
        filter: z.string().optional().describe('Case-insensitive text to match in the name or description.'),
        schemas: z.boolean().default(false),
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const f = (args.filter ?? '').toLowerCase();
        const list = (await engineTools()).filter((t) => !f || t.name.toLowerCase().includes(f) || t.description.toLowerCase().includes(f));
        return json({
          success: true,
          count: list.length,
          tools: list.map((t) => ({ name: t.name, read_only: !!t.read_only, description: t.description, ...(args.schemas ? { input_schema: t.input_schema } : {}) })),
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'run_pdf_tools',
    {
      title: 'Run PdfCraft engine tools',
      description:
        'Advanced: open PDFs and run any of PdfCraft\'s 131 engine tools in order in one session (names and arguments from ' +
        'list_pdf_tools), e.g. comment_add, bookmark_add, link_add, accessibility_fix, form_set_props, js_set_document_script, ' +
        'measure_distance, doc_initial_view. Arguments can use "$docs[0]" for the id of the first opened file and ' +
        '"$steps[N].path.to[0]" for a value returned by step N (0-based). save writes documents to new files at the end.',
      inputSchema: {
        open_paths: z.array(z.string()).max(50).optional().describe('Absolute PDFs to open first ($docs[0], $docs[1]...).'),
        passwords: z.array(z.string()).optional().describe('Passwords for open_paths, in the same order (empty string for none).'),
        steps: z.array(z.object({ tool: z.string(), args: z.record(z.string(), z.any()).optional() })).max(500).default([]),
        stop_on_error: z.boolean().default(true),
        save: z
          .array(z.object({ doc: z.union([z.number().int(), z.string()]).describe('Document id or "$docs[0]".'), path: z.string().describe('Absolute output .pdf.') }))
          .optional(),
        overwrite: z.boolean().default(false),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const opens = args.open_paths?.length ? collectInputs(args.open_paths) : [];
        const outcome = await withSession(async (s) => {
          const docs: number[] = [];
          for (let i = 0; i < opens.length; i++) docs.push((await openDoc(s, opens[i], args.passwords?.[i] || undefined)).doc);
          const vars = { docs };
          const values: unknown[] = [];
          const results: Record<string, unknown>[] = [];
          let failed = 0;
          for (const step of args.steps) {
            try {
              const out = await s.call(step.tool, substitute(step.args ?? {}, vars, values) as Record<string, unknown>);
              values.push(out.value);
              const image = out.content.some((c) => c.type === 'image');
              results.push({ tool: step.tool, ok: true, result: out.value, ...(image ? { image: 'returned as an image (use page_render via render_pages to save it)' } : {}) });
            } catch (e) {
              failed++;
              values.push(undefined);
              results.push({ tool: step.tool, ok: false, error: e instanceof Error ? e.message : String(e) });
              if (args.stop_on_error) break;
            }
          }
          const saved: Record<string, unknown>[] = [];
          if (failed === 0 || !args.stop_on_error) {
            for (const sv of args.save ?? []) {
              const doc = Number(substitute(sv.doc, vars, values));
              const out = outputFor(sv.path + '.__src', 'pdf', '', { output_path: sv.path, overwrite: args.overwrite });
              saved.push({ doc, ...(await saveAs(s, doc, out)) });
            }
          }
          return { success: failed === 0, completed: results.length - failed, failed, docs, results, ...(saved.length ? { saved } : {}) };
        });
        return json(outcome, !outcome.success);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'open_in_pdfcraft',
    {
      title: 'Open in PdfCraft',
      description: 'Open PDFs in the PdfCraft desktop app for reading or manual editing.',
      inputSchema: { paths: z.array(z.string()).min(1).max(50).describe('Absolute PDF paths.') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const files = collectInputs(args.paths);
        const install = resolveInstall();
        if (!install.app) throw new Error('PdfCraft desktop app not found. Set PDFCRAFT_DIR (or PDFCRAFT_APP for an AppImage).');
        const child = spawn(install.app, files, { detached: true, stdio: 'ignore', windowsHide: false });
        child.on('error', () => undefined);
        child.unref();
        return json({ success: true, app: install.app, opened: files });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'get_pdfcraft_status',
    {
      title: 'PdfCraft status',
      description: 'Check the PdfCraft installation: platform, executables, version, number of engine tools, OCR availability and settings.',
      inputSchema: {},
      annotations: READ,
    },
    async () => {
      const install = resolveInstall();
      const status: Record<string, unknown> = {
        ready: !!install.cli,
        platform: `${install.platform} ${process.arch}`,
        install_dir: install.dir,
        cli: install.cli ?? null,
        app: install.app ?? null,
      };
      try {
        if (!install.cli) throw new Error(`pdfcraft-cli not found (searched ${install.searched.length} folders). Install PdfCraft or set PDFCRAFT_DIR / PDFCRAFT_CLI.`);
        status['version'] = (await runCli(['--version'])).split('\n')[0].trim();
        status['engine_tools'] = (await engineTools()).length;
        status['ocr'] = await withSession(async (s) => {
          const o = await s.json('ocr_status');
          return { available: o['available'], languages: (o['languages'] ?? []).map((l: any) => l.code ?? l), search_dirs: o['search_dirs'] };
        });
        status['root'] = resolveRoot() ?? null;
        status['timeout_sec'] = COMMAND_TIMEOUT_SEC;
        return json(status);
      } catch (e) {
        return json({ ...status, ready: false, error: e instanceof Error ? e.message : String(e) }, true);
      }
    },
  );
}

/**
 * Replace "$docs[0]" with the id of the first opened file and "$steps[2].files[0]" / "$steps[0].doc"
 * with values from the result of an earlier step.
 */
export function substitute(value: unknown, vars: { docs: number[] }, steps: unknown[] = []): unknown {
  if (typeof value === 'string') {
    const m = /^\$docs\[(\d+)\]$/.exec(value);
    if (m) {
      const v = vars.docs[Number(m[1])];
      if (v === undefined) throw new Error(`${value} is not available (opened ${vars.docs.length} documents).`);
      return v;
    }
    const st = /^\$steps\[(\d+)\]((?:\.[A-Za-z_]\w*|\[\d+\])*)$/.exec(value);
    if (st) {
      let cur: unknown = steps[Number(st[1])];
      for (const part of st[2].match(/\.[A-Za-z_]\w*|\[\d+\]/g) ?? []) {
        const key = part.startsWith('.') ? part.slice(1) : Number(part.slice(1, -1));
        cur = cur && typeof cur === 'object' ? (cur as Record<string | number, unknown>)[key] : undefined;
      }
      if (cur === undefined) throw new Error(`${value} is not available (step results so far: ${steps.length}).`);
      return cur;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars, steps));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars, steps)]));
  return value;
}

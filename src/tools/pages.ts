import { readdirSync } from 'fs';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withSession } from '../engine.js';
import {
  READ, WRITE, collectInputs, errorResult, inputsOf, inputsSchema, json, moveNumbered, nativePath, openDoc, outputFor,
  pagesSchema, passwordSchema, rect4, removeDir, requireEditable, saveAs, stagingDir, stemOf, toEnginePath,
} from './common.js';

export function registerPageTools(server: McpServer): void {
  server.registerTool(
    'get_pdf_info',
    {
      title: 'PDF info',
      description:
        'Summary of a PDF: page count and sizes, title/author/subject/keywords, PDF version, file size, security, form fields, ' +
        'bookmarks, comments, links, attachments, fonts (embedded or not), tagging, JavaScript, digital signatures and repair notes. ' +
        'full=true returns everything doc_info knows.',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        password: passwordSchema,
        full: z.boolean().default(false).describe('Return the complete doc_info result.'),
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const input = collectInputs([args.input_path])[0];
        return json(
          await withSession(async (s) => {
            const d = await openDoc(s, input, args.password);
            const info = await s.json('doc_info', { doc: d.doc });
            const signatures = await s.json('sign_list', { doc: d.doc });
            if (args.full) return { success: true, input, ...info, signatures };
            const pages = (info['pages'] ?? []) as { width: number; height: number; rotation: number; label: string }[];
            const sizes = [...new Set(pages.map((p) => `${Math.round(p.width)}x${Math.round(p.height)} pt`))];
            return {
              success: true,
              input,
              pages: pages.length,
              page_sizes: sizes,
              rotated_pages: pages.filter((p) => p.rotation).map((p, i) => i + 1),
              title: info['title'],
              author: info['author'],
              subject: info['subject'],
              keywords: info['keywords'],
              creator: info['creator'],
              producer: info['producer'],
              pdf_version: info['pdf_version'],
              file_size: info['file_size'],
              editable: d.editable,
              security: info['security'],
              tagged: info['tagged'],
              has_javascript: info['has_javascript'],
              form_fields: (info['fields'] ?? []).length,
              bookmarks: (info['outline'] ?? []).length,
              comments: (info['annotations'] ?? []).length,
              links: (info['links'] ?? []).length,
              attachments: (info['attachments'] ?? []).map((a: any) => a.name ?? a),
              layers: (info['layers'] ?? []).length,
              fonts: (info['fonts'] ?? []).map((f: any) => `${f.name}${f.embedded ? '' : ' (not embedded)'}`),
              signatures: { count: signatures['count'], all_valid: signatures['all_valid'] },
              warnings: info['warnings'],
              repairs: info['repairs'],
            };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'extract_text',
    {
      title: 'Extract text',
      description:
        'Text of some or all pages in reading order, page by page. Optionally also saved as a .txt file (pages separated by form feeds). ' +
        'Scanned pages without a text layer return nothing: run ocr_pdf first.',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        pages: pagesSchema,
        password: passwordSchema,
        output_path: z.string().optional().describe('Absolute .txt path to also write the text to.'),
        overwrite: z.boolean().default(false),
        max_chars: z.number().int().min(100).default(200000).describe('Cut the returned text after this many characters (the .txt file is complete).'),
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const input = collectInputs([args.input_path])[0];
        return json(
          await withSession(async (s) => {
            const d = await openDoc(s, input, args.password);
            const r = await s.json('text_extract', { doc: d.doc, ...(args.pages ? { pages: args.pages } : {}) });
            const pages = (r['pages'] ?? []) as { page: number; text: string }[];
            let saved: string | undefined;
            if (args.output_path) {
              saved = outputFor(input, 'txt', '', { output_path: args.output_path, overwrite: args.overwrite });
              await s.json('doc_export_text', { doc: d.doc, path: toEnginePath(saved), ...(args.pages ? { pages: args.pages } : {}) });
            }
            let budget = args.max_chars;
            const out = pages.map((p) => {
              const text = p.text.slice(0, Math.max(0, budget));
              budget -= text.length;
              return { page: p.page, text, ...(text.length < p.text.length ? { truncated: true } : {}) };
            });
            const chars = pages.reduce((n, p) => n + p.text.length, 0);
            return { success: true, input, page_count: d.pages, characters: chars, ...(saved ? { saved } : {}), pages: out };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'render_pages',
    {
      title: 'Render pages to images',
      description:
        'Render pages of one or many PDFs as PNG, JPEG or TIFF images (<name>_page_<n>.<ext>), at a resolution (default 150 dpi), ' +
        'into output_dir (default <input folder>/<name>_pages/). The first rendered page is also shown so you can see it.',
      inputSchema: {
        ...inputsSchema,
        pages: pagesSchema,
        dpi: z.number().min(18).max(1200).default(150),
        format: z.enum(['png', 'jpeg', 'tiff']).default('png'),
        quality: z.number().int().min(1).max(100).optional().describe('JPEG quality (default 85).'),
        output_dir: z.string().optional().describe('Absolute folder (a subfolder per input when several inputs).'),
        preview: z.boolean().default(true).describe('Return a small preview image of the first page.'),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        const results: Record<string, unknown>[] = [];
        let preview: { data: string; mimeType: string } | undefined;
        for (const input of inputs) {
          try {
            results.push(
              await withSession(async (s) => {
                const d = await openDoc(s, input, args.password);
                const stem = stemOf(input);
                const dir = args.output_dir
                  ? inputs.length > 1
                    ? path.join(args.output_dir, stem)
                    : args.output_dir
                  : path.join(path.dirname(input), `${stem}_pages`);
                const staging = stagingDir(dir);
                try {
                  const r = await s.json('doc_export_images', {
                    doc: d.doc,
                    folder: toEnginePath(staging),
                    dpi: args.dpi,
                    format: args.format,
                    ...(args.pages ? { pages: args.pages } : {}),
                    ...(args.quality ? { quality: args.quality } : {}),
                  });
                  const staged = ((r['files'] ?? []) as string[]).map(nativePath);
                  const files = moveNumbered(staged, dir, `${stem}_page`);
                  if (args.preview && !preview) {
                    const first = (args.pages ?? [1])[0];
                    const img = (await s.call('page_render', { doc: d.doc, page: first, dpi: 60 })).content.find((c) => c.type === 'image');
                    if (img?.data) preview = { data: img.data, mimeType: img.mimeType ?? 'image/png' };
                  }
                  return { success: true, input, output_dir: dir, count: files.length, files };
                } finally {
                  removeDir(staging);
                }
              }),
            );
          } catch (e) {
            results.push({ success: false, input, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const ok = results.filter((r) => r['success']).length;
        const body = inputs.length === 1 ? results[0] : { success: ok === inputs.length, total: inputs.length, succeeded: ok, results };
        const res = json(body, ok === 0);
        if (preview) res.content.push({ type: 'image', ...preview });
        return res;
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'split_pdf',
    {
      title: 'Split PDF',
      description:
        'Split one or many PDFs into several files: every N pages, before given pages, at top-level bookmarks, or by file size. ' +
        'Each input gets its own folder of numbered parts (<name>_part_001.pdf…): output_dir/<input name>/ when output_dir is given, ' +
        'otherwise <input folder>/<input name>_parts/. Give exactly one of every, before, bookmarks, max_mb.',
      inputSchema: {
        ...inputsSchema,
        every: z.number().int().min(1).optional().describe('Pages per part.'),
        before: z.array(z.number().int().min(1)).min(1).optional().describe('Page numbers that start a new part.'),
        bookmarks: z.boolean().optional().describe('One part per top-level bookmark.'),
        max_mb: z.number().positive().optional().describe('Largest part size in MB.'),
        output_dir: z.string().optional().describe('Absolute folder for the parts (a subfolder per input).'),
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const modes = [args.every, args.before, args.bookmarks, args.max_mb].filter((v) => v !== undefined && v !== false).length;
        if (modes !== 1) throw new Error('Give exactly one of every, before, bookmarks or max_mb.');
        const inputs = inputsOf(args);
        const results: Record<string, unknown>[] = [];
        let total = 0;
        for (const input of inputs) {
          try {
            const r = await withSession(async (s) => {
              const d = await openDoc(s, input, args.password);
              const stem = stemOf(input);
              const dir = args.output_dir ? path.join(args.output_dir, stem) : path.join(path.dirname(input), `${stem}_parts`);
              const staging = stagingDir(dir);
              try {
                const res = await s.json('doc_split', {
                  doc: d.doc,
                  out_dir: toEnginePath(staging),
                  ...(args.every ? { every: args.every } : {}),
                  ...(args.before ? { before: args.before } : {}),
                  ...(args.bookmarks ? { bookmarks: true } : {}),
                  ...(args.max_mb ? { max_mb: args.max_mb } : {}),
                });
                const parts = (res['files'] ?? []) as { path: string; first_page: number; last_page: number }[];
                const files = moveNumbered(parts.map((p) => nativePath(p.path)), dir, `${stem}_part`, args.overwrite);
                return {
                  success: true,
                  input,
                  output_dir: dir,
                  count: files.length,
                  files: files.map((f, i) => ({ path: f, first_page: parts[i].first_page, last_page: parts[i].last_page })),
                };
              } finally {
                removeDir(staging);
              }
            });
            total += Number(r['count']);
            results.push(r);
          } catch (e) {
            results.push({ success: false, input, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const ok = results.filter((r) => r['success']).length;
        return json({ success: ok === inputs.length, inputs: inputs.length, succeeded: ok, total_files: total, results }, ok === 0);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'merge_pdfs',
    {
      title: 'Merge PDFs',
      description:
        'Combine PDFs in order into one file, optionally choosing pages of each ("1-3, 6", "5-"). Bookmarks are kept under one entry per file.',
      inputSchema: {
        inputs: z
          .array(z.union([z.string(), z.object({ path: z.string(), pages: z.string().optional().describe('Page range, e.g. "1-3, 6".') })]))
          .min(2)
          .max(500)
          .describe('PDFs in order: paths or {path, pages}.'),
        output_path: z.string().describe('Absolute output .pdf.'),
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const items = args.inputs.map((i) => (typeof i === 'string' ? { path: i } : i));
        collectInputs(items.map((i) => i.path));
        const out = outputFor(items[0].path, 'pdf', '', { output_path: args.output_path, overwrite: args.overwrite });
        return json(
          await withSession(async (s) => {
            const r = await s.json('doc_combine', {
              paths: items.map((i) => toEnginePath(i.path)),
              ...(items.some((i) => i.pages) ? { pages: items.map((i) => i.pages ?? null) } : {}),
              out: toEnginePath(out),
            });
            const d = await openDoc(s, out);
            return { success: true, output: out, pages: d.pages, files: items.length, ...(r['bytes'] ? { bytes: r['bytes'] } : {}) };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'extract_pages',
    {
      title: 'Extract pages',
      description:
        'Copy chosen pages into a new PDF (links, bookmarks, fields and layers that belong to them come along), or with separate=true ' +
        'one PDF per page into a folder. The input is not changed.',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        pages: z.array(z.number().int().min(1)).min(1).describe('1-based page numbers, in the order wanted.'),
        separate: z.boolean().default(false).describe('One file per page into output_dir.'),
        output_path: z.string().optional().describe('Absolute output .pdf (default <name>_pages.pdf next to the input).'),
        output_dir: z.string().optional().describe('With separate: absolute folder (default <input folder>/<name>_pages/).'),
        password: passwordSchema,
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const input = collectInputs([args.input_path])[0];
        return json(
          await withSession(async (s) => {
            const d = await openDoc(s, input, args.password);
            const bad = args.pages.filter((p) => p > d.pages);
            if (bad.length) throw new Error(`Pages ${bad.join(', ')} do not exist (the PDF has ${d.pages}).`);
            if (args.separate) {
              const dir = args.output_dir ?? path.join(path.dirname(input), `${stemOf(input)}_pages`);
              const staging = stagingDir(dir);
              try {
                await s.json('page_extract', { doc: d.doc, pages: args.pages, separate: true, out_dir: toEnginePath(staging), open: false });
                const staged = readdirSync(staging)
                  .filter((f) => f.toLowerCase().endsWith('.pdf'))
                  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                  .map((f) => path.join(staging, f));
                const files = moveNumbered(staged, dir, `${stemOf(input)}_page`, args.overwrite);
                return { success: true, input, output_dir: dir, count: files.length, files };
              } finally {
                removeDir(staging);
              }
            }
            const out = outputFor(input, 'pdf', '_pages', args);
            await s.json('page_extract', { doc: d.doc, pages: args.pages, out: toEnginePath(out), open: false });
            return { success: true, input, output: out, pages: args.pages.length };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  const rotateSchema = z.object({
    degrees: z.number().int().describe('Multiple of 90; positive is clockwise.'),
    pages: pagesSchema,
    subset: z.enum(['all', 'even', 'odd']).optional(),
    orientation: z.enum(['all', 'landscape', 'portrait']).optional(),
  });

  server.registerTool(
    'edit_pages',
    {
      title: 'Organize pages',
      description:
        'Reorganize a PDF and save it as a new file (default <name>_edited.pdf): operations run in this order — insert_file, insert_blank, ' +
        'duplicate, rotate, move, delete, crop, page_labels, metadata. Page numbers refer to the document as it is when that step runs. ' +
        'Example: {"rotate":[{"pages":[2],"degrees":90}],"delete":[5],"move":{"pages":[4],"to":1},"metadata":{"title":"Report"}}.',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        insert_file: z
          .array(z.object({ path: z.string(), at: z.number().int().min(1), pages: z.array(z.number().int().min(1)).optional() }))
          .optional()
          .describe('Insert pages of another PDF so its first page becomes page `at`.'),
        insert_blank: z
          .array(z.object({ at: z.number().int().min(1), width: z.number().optional(), height: z.number().optional() }))
          .optional()
          .describe('Blank pages (size in points; default the neighbouring page).'),
        duplicate: z.array(z.number().int().min(1)).optional().describe('Pages to copy (inserted after the last of them).'),
        rotate: z.array(rotateSchema).optional(),
        move: z.object({ pages: z.array(z.number().int().min(1)).min(1), to: z.number().int().min(1) }).optional().describe('Move pages so the first lands at `to`.'),
        delete: z.array(z.number().int().min(1)).optional().describe('Pages to delete.'),
        crop: z
          .object({ margins: rect4.optional().describe('[left, bottom, right, top] points to cut.'), rect: rect4.optional(), pages: pagesSchema, box: z.enum(['crop', 'trim', 'bleed', 'art', 'media']).optional() })
          .optional(),
        page_labels: z
          .array(z.object({ from: z.number().int().min(1), to: z.number().int().min(1), style: z.enum(['decimal', 'upper-roman', 'lower-roman', 'upper-alpha', 'lower-alpha', 'none']).optional(), prefix: z.string().optional(), start: z.number().int().min(1).optional() }))
          .optional()
          .describe('Page labels, e.g. i–iv for front matter.'),
        metadata: z.object({ title: z.string().optional(), author: z.string().optional(), subject: z.string().optional(), keywords: z.string().optional() }).optional(),
        output_path: z.string().optional().describe('Absolute output .pdf.'),
        password: passwordSchema,
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const input = collectInputs([args.input_path])[0];
        for (const f of args.insert_file ?? []) collectInputs([f.path]);
        return json(
          await withSession(async (s) => {
            const d = await openDoc(s, input, args.password);
            requireEditable(d, input);
            const done: string[] = [];
            for (const f of args.insert_file ?? []) {
              await s.json('page_insert_file', { doc: d.doc, path: toEnginePath(f.path), at: f.at, ...(f.pages ? { pages: f.pages } : {}) });
              done.push(`insert ${path.basename(f.path)} at ${f.at}`);
            }
            for (const b of args.insert_blank ?? []) {
              await s.json('page_insert_blank', { doc: d.doc, ...b });
              done.push(`blank page at ${b.at}`);
            }
            if (args.duplicate?.length) {
              await s.json('page_duplicate', { doc: d.doc, pages: args.duplicate });
              done.push(`duplicate ${args.duplicate.join(',')}`);
            }
            for (const r of args.rotate ?? []) {
              await s.json('page_rotate', { doc: d.doc, ...r });
              done.push(`rotate ${r.degrees}°`);
            }
            if (args.move) {
              await s.json('page_move', { doc: d.doc, pages: args.move.pages, to: args.move.to });
              done.push(`move ${args.move.pages.join(',')} → ${args.move.to}`);
            }
            if (args.delete?.length) {
              await s.json('page_delete', { doc: d.doc, pages: args.delete });
              done.push(`delete ${args.delete.join(',')}`);
            }
            if (args.crop) {
              await s.json('page_set_box', { doc: d.doc, ...args.crop });
              done.push('crop');
            }
            for (const l of args.page_labels ?? []) {
              await s.json('page_number', { doc: d.doc, ...l });
              done.push(`labels ${l.from}-${l.to}`);
            }
            const keys: Record<string, string> = { title: 'Title', author: 'Author', subject: 'Subject', keywords: 'Keywords' };
            for (const [k, v] of Object.entries(args.metadata ?? {})) {
              if (v === undefined) continue;
              await s.json('doc_set_info', { doc: d.doc, key: keys[k], value: v });
              done.push(`${k}`);
            }
            if (!done.length) throw new Error('Nothing to do: give at least one operation.');
            const out = outputFor(input, 'pdf', '_edited', args);
            const saved = await saveAs(s, d.doc, out);
            const after = await s.json('doc_list');
            const pages = ((after['documents'] ?? after['docs'] ?? []) as any[]).find((x) => x.doc === d.doc)?.pages;
            return { success: true, input, output: saved.path, bytes: saved.bytes, ...(pages ? { pages } : {}), applied: done };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'create_pdf',
    {
      title: 'Create a PDF',
      description:
        'Make a new PDF from images (one page each: PNG, JPEG, TIFF with every page, GIF, BMP), from text (a .txt file or text given here), ' +
        'or blank pages.',
      inputSchema: {
        from: z.enum(['images', 'text', 'blank']),
        image_paths: z.array(z.string()).max(2000).optional().describe('from=images: absolute image paths, in page order.'),
        image_dir: z.string().optional().describe('from=images: every image directly inside this folder, sorted by name.'),
        dpi: z.number().min(1).max(1200).optional().describe('from=images: override the images\' resolution (72 = one point per pixel).'),
        text: z.string().optional().describe('from=text: the text (form feed \\f starts a new page).'),
        text_path: z.string().optional().describe('from=text: absolute .txt path.'),
        pages: z.number().int().min(1).max(10000).optional().describe('from=blank: number of pages (default 1).'),
        width: z.number().min(3).optional().describe('from=blank: points (default 612 = US Letter).'),
        height: z.number().min(3).optional().describe('from=blank: points (default 792).'),
        title: z.string().optional().describe('Document title.'),
        output_path: z.string().describe('Absolute output .pdf.'),
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const params: Record<string, unknown> = { from: args.from };
        let ref = args.output_path + '.__src';
        if (args.from === 'images') {
          const imgs = collectInputs(args.image_paths ?? [], args.image_dir, ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'gif', 'bmp']);
          params['paths'] = imgs.map((p) => toEnginePath(p));
          if (args.dpi) params['dpi'] = args.dpi;
          ref = imgs[0];
        } else if (args.from === 'text') {
          if (args.text_path) params['path'] = toEnginePath(collectInputs([args.text_path], undefined, ['txt'])[0]);
          else if (args.text) params['text'] = args.text;
          else throw new Error('from=text needs text or text_path.');
        } else {
          for (const k of ['pages', 'width', 'height'] as const) if (args[k] !== undefined) params[k] = args[k];
        }
        const out = outputFor(ref, 'pdf', '', { output_path: args.output_path, overwrite: args.overwrite });
        return json(
          await withSession(async (s) => {
            const d = await s.json('doc_create', params);
            if (args.title) await s.json('doc_set_info', { doc: d['doc'], key: 'Title', value: args.title });
            const saved = await saveAs(s, d['doc'], out);
            return { success: true, output: saved.path, bytes: saved.bytes, pages: d['pages'] };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}

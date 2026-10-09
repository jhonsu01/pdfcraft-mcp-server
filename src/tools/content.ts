import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withSession } from '../engine.js';
import {
  WRITE, collectInputs, errorResult, inputsOf, inputsSchema, json, openDoc, outputFor, outputSchema, pagesSchema,
  passwordSchema, point2, rect4, requireEditable, saveAs, toEnginePath,
} from './common.js';

const colorSchema = z.string().describe('"#RRGGBB" or a colour name.');

const watermarkSchema = z.object({
  text: z.string().min(1).optional().describe('Watermark text, e.g. "CONFIDENTIAL".'),
  image_path: z.string().optional().describe('Or a picture: absolute image path, or a PDF (page file_page).'),
  file_page: z.number().int().min(1).optional(),
  color: colorSchema.optional(),
  font_size: z.number().positive().optional().describe('Default: fitted to the page.'),
  opacity: z.number().min(0).max(1).optional().describe('Default 0.5.'),
  rotation: z.number().optional().describe('Degrees counter-clockwise (default 45).'),
  scale: z.number().positive().max(1).optional().describe('Picture size relative to the page (default 0.5).'),
  behind: z.boolean().optional().describe('Put it behind the page content.'),
  pages: pagesSchema,
});

const headerFooterSchema = z.object({
  header_left: z.string().optional(),
  header_center: z.string().optional(),
  header_right: z.string().optional(),
  footer_left: z.string().optional(),
  footer_center: z.string().optional(),
  footer_right: z.string().optional(),
  font_size: z.number().positive().optional(),
  color: colorSchema.optional(),
  margins: rect4.optional().describe('Top, bottom, left, right in points (default 36, 36, 72, 72).'),
  start_number: z.number().int().min(1).optional(),
  pages: pagesSchema,
});

const backgroundSchema = z.object({
  color: colorSchema.optional(),
  image_path: z.string().optional().describe('Absolute image path, or a PDF (page file_page).'),
  file_page: z.number().int().min(1).optional(),
  opacity: z.number().min(0).max(1).optional(),
  scale: z.number().positive().max(1).optional(),
  pages: pagesSchema,
});

const textItemSchema = z.object({
  page: z.number().int().min(1),
  text: z.string().min(1).describe('The text (\\n for new lines).'),
  at: point2.optional().describe('[x, y] of the top-left corner, points from the top-left of the page.'),
  rect: rect4.optional().describe('Or a box [x0, y0, x1, y1] (points from the top-left).'),
  width: z.number().positive().optional().describe('Wrap width with `at` (default 200).'),
  size: z.number().min(1).max(500).optional(),
  font: z.enum(['helvetica', 'times', 'courier']).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: colorSchema.optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

const imageItemSchema = z.object({
  page: z.number().int().min(1),
  path: z.string().describe('Absolute PNG, JPEG, TIFF, GIF or BMP path.'),
  rect: rect4.optional().describe('[x0, y0, x1, y1] points from the top-left of the page; default centred at natural size.'),
});

const linkItemSchema = z.object({
  page: z.number().int().min(1),
  rect: rect4.describe('[x0, y0, x1, y1] points from the top-left of the page.'),
  url: z.string().optional(),
  to_page: z.number().int().min(1).optional(),
});

export function registerContentTools(server: McpServer): void {
  server.registerTool(
    'add_content',
    {
      title: 'Watermark, header/footer, text, images',
      description:
        'Add to one or many PDFs and save each as a new file (default <name>_marked.pdf): a text or picture watermark, headers and footers ' +
        '(tokens: <<1>> page number, <<n>> page count, <<Page 1 of n>>, <<yyyy-mm-dd>>, Bates <<Bates Number#6#1#PREFIX#SUFFIX>>), a page ' +
        'background, editable text boxes, images, links, and clickable links from every URL in the text. Positions are in points ' +
        '(1/72 inch) from the top-left of the page; get_pdf_info gives page sizes.',
      inputSchema: {
        ...inputsSchema,
        watermark: watermarkSchema.optional(),
        header_footer: headerFooterSchema.optional(),
        background: backgroundSchema.optional(),
        texts: z.array(textItemSchema).max(200).optional(),
        images: z.array(imageItemSchema).max(200).optional(),
        links: z.array(linkItemSchema).max(500).optional(),
        links_from_urls: z.boolean().optional().describe('Make every http(s)/www address in the text clickable.'),
        replace: z.boolean().default(false).describe('Replace existing watermarks / headers / backgrounds instead of adding.'),
        suffix: z.string().default('_marked'),
        ...outputSchema,
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (args.output_path && inputs.length > 1) throw new Error('output_path only works with one input; use output_dir.');
        for (const i of args.images ?? []) collectInputs([i.path], undefined, ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'gif', 'bmp']);
        const results: Record<string, unknown>[] = [];
        for (const input of inputs) {
          try {
            results.push(
              await withSession(async (s) => {
                const d = await openDoc(s, input, args.password);
                requireEditable(d, input);
                const done: string[] = [];
                const rep = args.replace ? { replace: true } : {};
                if (args.background) {
                  const { image_path, ...b } = args.background;
                  await s.json('doc_background', { doc: d.doc, ...b, ...(image_path ? { file: toEnginePath(image_path) } : {}), ...rep });
                  done.push('background');
                }
                if (args.watermark) {
                  const { image_path, ...w } = args.watermark;
                  if (!w.text && !image_path) throw new Error('watermark needs text or image_path.');
                  await s.json('doc_watermark', { doc: d.doc, ...w, ...(image_path ? { file: toEnginePath(image_path) } : {}), ...rep });
                  done.push('watermark');
                }
                if (args.header_footer) {
                  await s.json('doc_header_footer', { doc: d.doc, ...args.header_footer, ...rep });
                  done.push('header/footer');
                }
                for (const t of args.texts ?? []) {
                  await s.json('page_add_text', { doc: d.doc, ...t });
                }
                if (args.texts?.length) done.push(`${args.texts.length} text(s)`);
                for (const i of args.images ?? []) {
                  await s.json('page_add_image', { doc: d.doc, page: i.page, path: toEnginePath(i.path), ...(i.rect ? { rect: i.rect } : {}) });
                }
                if (args.images?.length) done.push(`${args.images.length} image(s)`);
                for (const l of args.links ?? []) await s.json('link_add', { doc: d.doc, ...l });
                if (args.links?.length) done.push(`${args.links.length} link(s)`);
                if (args.links_from_urls) {
                  const r = await s.json('links_from_urls', { doc: d.doc });
                  done.push(`${(r['created'] ?? []).length} link(s) from URLs`);
                }
                if (!done.length) throw new Error('Nothing to add.');
                const out = outputFor(input, 'pdf', args.suffix, args);
                const saved = await saveAs(s, d.doc, out);
                return { success: true, input, output: saved.path, bytes: saved.bytes, added: done };
              }),
            );
          } catch (e) {
            results.push({ success: false, input, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const ok = results.filter((r) => r['success']).length;
        if (inputs.length === 1) return json(results[0], !ok);
        return json({ success: ok === inputs.length, total: inputs.length, succeeded: ok, results }, ok === 0);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'protect_pdf',
    {
      title: 'Password-protect / unlock',
      description:
        'Encrypt PDFs with an open password and/or a permissions password that restricts printing, changes and copying (AES-256 by ' +
        'default), or remove the protection (unprotect=true; open the input with `password`, its permissions password). Passwords are ' +
        'never echoed back. Saves new files (default <name>_protected.pdf / <name>_unlocked.pdf).',
      inputSchema: {
        ...inputsSchema,
        unprotect: z.boolean().default(false),
        open_password: z.string().min(1).optional().describe('Needed to open the result.'),
        permissions_password: z.string().min(1).optional().describe('Needed to change security; enables the restrictions below.'),
        printing: z.enum(['none', 'low', 'high']).optional().describe('Needs permissions_password.'),
        changes: z.enum(['none', 'pages', 'fill-sign', 'comment-fill-sign', 'any-except-extract']).optional().describe('Needs permissions_password.'),
        copy: z.boolean().optional().describe('Allow copying text and images (needs permissions_password).'),
        compatibility: z.enum(['aes-256', 'aes-128', 'rc4-128', 'rc4-40']).optional(),
        ...outputSchema,
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const inputs = inputsOf(args);
        if (!args.unprotect && !args.open_password && !args.permissions_password) throw new Error('Give open_password and/or permissions_password (or unprotect: true).');
        if (args.output_path && inputs.length > 1) throw new Error('output_path only works with one input; use output_dir.');
        const results: Record<string, unknown>[] = [];
        for (const input of inputs) {
          try {
            results.push(
              await withSession(async (s) => {
                const d = await openDoc(s, input, args.password);
                let security: unknown;
                if (args.unprotect) {
                  await s.json('doc_unprotect', { doc: d.doc });
                } else {
                  const r = await s.json('doc_protect', {
                    doc: d.doc,
                    ...(args.open_password ? { open_password: args.open_password } : {}),
                    ...(args.permissions_password ? { permissions_password: args.permissions_password } : {}),
                    ...(args.printing ? { printing: args.printing } : {}),
                    ...(args.changes ? { changes: args.changes } : {}),
                    ...(args.copy !== undefined ? { copy: args.copy } : {}),
                    ...(args.compatibility ? { compatibility: args.compatibility } : {}),
                  });
                  security = r['security'];
                }
                const out = outputFor(input, 'pdf', args.unprotect ? '_unlocked' : '_protected', args);
                const saved = await saveAs(s, d.doc, out);
                return { success: true, input, output: saved.path, bytes: saved.bytes, ...(security ? { security } : { protected: false }) };
              }),
            );
          } catch (e) {
            results.push({ success: false, input, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const ok = results.filter((r) => r['success']).length;
        if (inputs.length === 1) return json(results[0], !ok);
        return json({ success: ok === inputs.length, total: inputs.length, succeeded: ok, results }, ok === 0);
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'redact_pdf',
    {
      title: 'Redact',
      description:
        'Permanently remove content and black it out (Acrobat Redact): every match of words/phrases, patterns (phone, email, ' +
        'credit-card, ssn, date), rectangles, or whole pages. The text, images and vectors under the marks are deleted, not just ' +
        'covered. sanitize=true also removes hidden information (metadata, attachments, scripts, hidden layers...). Saves a new file ' +
        '(default <name>_redacted.pdf).',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        find: z.array(z.string().min(1)).max(200).optional().describe('Words or phrases to redact (case-insensitive).'),
        patterns: z.array(z.enum(['phone', 'email', 'credit-card', 'ssn', 'date'])).optional(),
        areas: z.array(z.object({ page: z.number().int().min(1), rect: rect4 })).optional().describe('Boxes in points from the top-left of the page.'),
        whole_pages: z.array(z.number().int().min(1)).optional().describe('Pages to black out completely.'),
        pages: pagesSchema,
        overlay: z.string().optional().describe('Text shown on each box, e.g. "[REDACTED]".'),
        fill: colorSchema.optional().describe('Box colour (default black).'),
        sanitize: z.boolean().default(false),
        password: passwordSchema,
        output_path: z.string().optional(),
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
            requireEditable(d, input);
            const style = { ...(args.overlay ? { overlay: args.overlay } : {}), ...(args.fill ? { fill: args.fill } : {}) };
            const scope = args.pages ? { pages: args.pages } : {};
            let marked = 0;
            const count = (r: Record<string, any>) => (marked += Number(r['marked'] ?? 0));
            for (const f of args.find ?? []) count(await s.json('redact_mark', { doc: d.doc, find: f, ...scope, ...style }));
            for (const p of args.patterns ?? []) count(await s.json('redact_mark', { doc: d.doc, pattern: p, ...scope, ...style }));
            for (const a of args.areas ?? []) count(await s.json('redact_mark', { doc: d.doc, page: a.page, rect: a.rect, ...style }));
            if (args.whole_pages?.length) count(await s.json('redact_mark', { doc: d.doc, whole_pages: true, pages: args.whole_pages, ...style }));
            if (!marked) return { success: true, input, marked: 0, note: 'Nothing matched: no file written.' };
            const applied = await s.json('redact_apply', { doc: d.doc });
            let removed: unknown;
            if (args.sanitize) removed = await s.json('doc_remove_hidden', { doc: d.doc });
            const out = outputFor(input, 'pdf', '_redacted', args);
            const saved = await saveAs(s, d.doc, out);
            return { success: true, input, output: saved.path, marked, applied: applied['applied'], ...(removed ? { sanitized: removed } : {}) };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'fill_form',
    {
      title: 'Fill a PDF form',
      description:
        'Without values: list the form fields (name, type, current value, options, page). With values: fill them (text → string, ' +
        'checkbox → true/false, radio/combo → option, multi-select list → array) and save a new file (default <name>_filled.pdf); ' +
        'flatten=true merges the values into the page so they can no longer be edited. detect=true first adds fields to a printed form ' +
        'that has none (blanks, lines, boxes).',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        values: z.record(z.string(), z.any()).optional().describe('Field name → value.'),
        flatten: z.boolean().default(false),
        detect: z.boolean().default(false).describe('Detect and add fields automatically before listing/filling.'),
        password: passwordSchema,
        output_path: z.string().optional(),
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
            let detected: unknown;
            if (args.detect) detected = await s.json('form_detect_fields', { doc: d.doc, add: true });
            const fields = await s.json('form_fields', { doc: d.doc });
            if (!args.values || !Object.keys(args.values).length) {
              if (!args.detect) return { success: true, input, ...fields };
            }
            requireEditable(d, input);
            let filled: unknown;
            if (args.values && Object.keys(args.values).length) filled = (await s.json('form_fill', { doc: d.doc, values: args.values }))['filled'];
            if (args.flatten) await s.json('doc_flatten', { doc: d.doc, fields: true });
            const out = outputFor(input, 'pdf', args.values ? '_filled' : '_form', args);
            const saved = await saveAs(s, d.doc, out);
            return { success: true, input, output: saved.path, ...(filled !== undefined ? { filled } : {}), flattened: args.flatten, ...(detected ? { detected } : {}), fields: fields['count'] };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'sign_pdf',
    {
      title: 'Digitally sign',
      description:
        'Sign a PDF with a digital ID (.p12/.pfx, or on macOS "keychain:<name>"), visibly in rect on page or in an existing signature ' +
        'field, and save it (default <name>_signed.pdf). create_id makes a self-signed ID first (saved as a password-protected .p12). ' +
        'certify=true certifies instead of approving. Passwords are never echoed back. Check signatures with get_pdf_info.',
      inputSchema: {
        input_path: z.string().describe('Absolute path of the PDF.'),
        id_path: z.string().describe('Digital ID: absolute .p12/.pfx path (created when create_id is given), or keychain:<name> on macOS.'),
        id_password: z.string().min(1).describe('Password of the digital ID.'),
        create_id: z
          .object({ name: z.string(), email: z.string().optional(), organization: z.string().optional(), unit: z.string().optional(), country: z.string().length(2).optional(), years: z.number().int().min(1).max(50).optional() })
          .optional(),
        page: z.number().int().min(1).optional().describe('Page of a visible signature.'),
        rect: rect4.optional().describe('Box of a visible signature, points from the top-left of the page.'),
        field: z.string().optional().describe('Existing signature field to sign.'),
        reason: z.string().optional(),
        location: z.string().optional(),
        contact: z.string().optional(),
        certify: z.boolean().optional(),
        password: passwordSchema,
        output_path: z.string().optional(),
        overwrite: z.boolean().default(false),
      },
      annotations: WRITE,
    },
    async (args) => {
      try {
        const input = collectInputs([args.input_path])[0];
        return json(
          await withSession(async (s) => {
            let created = false;
            if (args.create_id) {
              await s.json('sign_id_create', { ...args.create_id, path: toEnginePath(args.id_path), password: args.id_password });
              created = true;
            } else if (!/^keychain:/i.test(args.id_path)) {
              collectInputs([args.id_path], undefined, ['p12', 'pfx']);
            }
            const d = await openDoc(s, input, args.password);
            const out = outputFor(input, 'pdf', '_signed', args);
            const r = await s.json('sign_document', {
              doc: d.doc,
              id: /^keychain:/i.test(args.id_path) ? args.id_path : toEnginePath(args.id_path),
              password: args.id_password,
              out: toEnginePath(out),
              ...(args.page ? { page: args.page } : {}),
              ...(args.rect ? { rect: args.rect } : {}),
              ...(args.field ? { field: args.field } : {}),
              ...(args.reason ? { reason: args.reason } : {}),
              ...(args.location ? { location: args.location } : {}),
              ...(args.contact ? { contact: args.contact } : {}),
              ...(args.certify ? { certify: true } : {}),
            });
            const check = await s.json('doc_open', { path: toEnginePath(out) });
            const sigs = await s.json('sign_list', { doc: check['doc'] });
            return {
              success: true,
              input,
              output: out,
              id_created: created ? args.id_path : undefined,
              field: r['field'],
              signatures: sigs['signatures'],
            };
          }),
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}

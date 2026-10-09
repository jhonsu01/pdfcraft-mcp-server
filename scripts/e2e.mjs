// End-to-end test over real MCP stdio against dist/bundle.cjs (what the .mcpb runs).
// Needs PdfCraft installed. Usage: npm run build && npm run test:e2e
// E2E_BUNDLE=<path to bundle.cjs> tests another build (e.g. the contents of an unpacked .mcpb).
// Builds its own synthetic PDFs with the connector (no personal documents).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const out = mkdtempSync(join(tmpdir(), 'pc-e2e-'));
const src = join(out, 'Documentos ñandú');
mkdirSync(src, { recursive: true });

const client = new Client({ name: 'e2e', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [process.env.E2E_BUNDLE || 'dist/bundle.cjs'] }));

let failed = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const call = async (name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const body = JSON.parse(res.content.find((c) => c.type === 'text').text);
  if (res.isError) console.log('      ', JSON.stringify(body).slice(0, 400));
  return { ...body, _raw: res };
};
const text = async (p, password) => (await call('extract_text', { input_path: p, ...(password ? { password } : {}) })).pages?.map((x) => x.text).join('\n') ?? '';
const t0 = Date.now();

const { tools } = await client.listTools();
check(tools.length === 21, `21 tools exposed (${tools.map((t) => t.name).join(', ')})`);
const tuples = JSON.stringify(tools.map((t) => t.inputSchema)).match(/"items":\[/g);
check(!tuples, 'no JSON Schema tuples in any input schema (some model APIs reject them)');

const status = await call('get_pdfcraft_status', {});
check(status.ready && /pdfcraft-cli/.test(status.version) && status.engine_tools >= 100, `PdfCraft ready: ${status.version}, ${status.engine_tools} engine tools, OCR ${status.ocr?.available ? 'available' : 'not installed'} (${status.platform})`);

// --- synthetic source: 6 pages of text with an email, a phone and a URL
const pagesText = [1, 2, 3, 4, 5, 6].map((n) => `Página ${n}\nContrato de prueba ñandú\nContacto: juan.perez@example.com  Tel 555-123-4567\nWeb https://example.com/doc${n}`);
const base = join(src, 'contrato.pdf');
const created = await call('create_pdf', { from: 'text', text: pagesText.join('\f'), title: 'Contrato e2e', output_path: base });
check(created.success && existsSync(base) && created.pages === 6, `create_pdf from text: ${created.pages} pages`);

const info = await call('get_pdf_info', { input_path: base });
check(info.success && info.pages === 6 && info.title === 'Contrato e2e', `info: ${info.pages} pages, ${info.page_sizes}, title "${info.title}"`);

const txt = await call('extract_text', { input_path: base, pages: [2], output_path: join(out, 'p2.txt') });
check(txt.pages?.[0]?.text.includes('Página 2') && txt.pages[0].text.includes('ñandú') && existsSync(join(out, 'p2.txt')), 'extract_text page 2 (accents kept) + .txt saved');

const ren = await call('render_pages', { input_path: base, dpi: 40, output_dir: join(out, 'img') });
check(ren.count === 6 && ren._raw.content.some((c) => c.type === 'image'), `render_pages: ${ren.count} PNG + preview image`);

const split = await call('split_pdf', { input_path: base, every: 2, output_dir: join(out, 'split') });
const parts = split.results?.[0]?.files ?? [];
check(split.success && parts.length === 3 && parts[2].first_page === 5, `split every 2: ${parts.map((p) => p.path.split(/[\\/]/).pop()).join(', ')}`);
const split2 = await call('split_pdf', { input_path: base, before: [3, 5], output_dir: join(out, 'split2') });
check(split2.success && split2.total_files === 3, 'split before pages 3 and 5: 3 parts');

const merged = await call('merge_pdfs', { inputs: [{ path: parts[2].path }, { path: base, pages: '1-2' }, parts[0].path], output_path: join(out, 'merged.pdf') });
check(merged.success && merged.pages === 6, `merge with ranges: ${merged.pages} pages`);

const ext = await call('extract_pages', { input_path: base, pages: [6, 1] });
check(ext.success && existsSync(ext.output) && (await text(ext.output)).indexOf('Página 6') < (await text(ext.output)).indexOf('Página 1'), 'extract_pages [6,1] keeps the asked order');
const sep = await call('extract_pages', { input_path: base, pages: [1, 2, 3], separate: true, output_dir: join(out, 'sep') });
check(sep.success && sep.count === 3, `extract_pages separate: ${sep.count} files`);

const ed = await call('edit_pages', {
  input_path: base,
  insert_blank: [{ at: 1 }],
  rotate: [{ pages: [2], degrees: 90 }],
  move: { pages: [7], to: 2 },
  delete: [4],
  page_labels: [{ from: 1, to: 1, style: 'lower-roman' }],
  metadata: { title: 'Editado', author: 'e2e' },
});
const edInfo = ed.success ? await call('get_pdf_info', { input_path: ed.output }) : {};
check(ed.success && edInfo.pages === 6 && edInfo.title === 'Editado' && edInfo.rotated_pages?.length === 1, `edit_pages: ${ed.applied?.join(' · ')} → ${edInfo.pages} pages`);

const marked = await call('add_content', {
  input_path: base,
  watermark: { text: 'BORRADOR', opacity: 0.3 },
  header_footer: { footer_center: '<<Page 1 of n>>', header_right: 'Confidencial' },
  texts: [{ page: 1, text: 'Añadido por el e2e', at: [72, 400], size: 18, color: '#cc0000', bold: true }],
  images: [{ page: 2, path: ren.files[0], rect: [72, 300, 272, 560] }],
  links_from_urls: true,
});
const mt = marked.success ? await text(marked.output) : '';
check(marked.success && mt.includes('BORRADOR') && mt.includes('Page 1 of 6') && mt.includes('Añadido por el e2e'), `add_content: ${marked.added?.join(' · ')}`);

const prot = await call('protect_pdf', { input_path: base, open_password: 'clave-ñ', permissions_password: 'dueño', printing: 'low', copy: false });
const locked = await call('get_pdf_info', { input_path: prot.output });
const opened = await call('get_pdf_info', { input_path: prot.output, password: 'clave-ñ' });
check(prot.success && !JSON.stringify(prot).includes('clave-ñ') && !locked.success && opened.success && opened.security?.protected, 'protect: needs the password, never echoes it');
const unl = await call('protect_pdf', { input_path: prot.output, password: 'dueño', unprotect: true });
check(unl.success && (await call('get_pdf_info', { input_path: unl.output })).success, 'unprotect with the permissions password');

const red = await call('redact_pdf', { input_path: base, find: ['ñandú'], patterns: ['email'], overlay: '[X]', sanitize: true });
const rt = red.success ? await text(red.output) : 'ñandú';
check(red.success && red.marked >= 12 && !rt.includes('ñandú') && !rt.includes('juan.perez@example.com'), `redact: ${red.marked} marks applied, text and emails gone`);

const formSrc = join(out, 'form.pdf');
await call('run_pdf_tools', {
  open_paths: [base],
  steps: [
    { tool: 'form_add_field', args: { doc: '$docs[0]', page: 1, type: 'text', name: 'nombre', rect: [72, 500, 300, 525] } },
    { tool: 'form_add_field', args: { doc: '$docs[0]', page: 1, type: 'checkbox', name: 'acepta', rect: [72, 540, 90, 558] } },
  ],
  save: [{ doc: '$docs[0]', path: formSrc }],
});
const fl = await call('fill_form', { input_path: formSrc });
const filled = await call('fill_form', { input_path: formSrc, values: { nombre: 'José Ñúñez', acepta: true }, flatten: true });
check(fl.count === 2 && filled.success && filled.filled === 2 && (await text(filled.output)).includes('José Ñúñez'), 'fill_form: list 2 fields, fill + flatten');

const signed = await call('sign_pdf', {
  input_path: base,
  id_path: join(out, 'e2e-id.p12'),
  id_password: 'firma-123',
  create_id: { name: 'E2E Tester', organization: 'pdfcraft-mcp-server', country: 'CO', years: 1 },
  page: 1,
  rect: [350, 650, 550, 720],
  reason: 'Prueba',
});
check(signed.success && signed.signatures?.length === 1 && !JSON.stringify(signed).includes('firma-123'), `sign_pdf: ${signed.signatures?.[0]?.status ?? '?'} signature, self-signed ID created`);

const conv = await call('convert_pdf', { input_path: base, to: 'docx', output_dir: join(out, 'conv') });
const html = await call('convert_pdf', { input_path: base, to: 'html', output_dir: join(out, 'conv') });
const plain = await call('convert_pdf', { input_path: base, to: 'txt', output_dir: join(out, 'conv') });
check(conv.success && html.success && plain.success && readFileSync(plain.output, 'utf-8').includes('ñandú'), 'convert to docx, html and txt');
const jpg = await call('convert_pdf', { input_path: base, to: 'jpeg', pages: [1, 2], dpi: 40, output_dir: join(out, 'jpg') });
check(jpg.success && jpg.count === 2, 'convert pages 1-2 to JPEG');
const pdfa = await call('convert_pdf', { input_path: base, to: 'pdfa-2b' });
check(pdfa.success && existsSync(pdfa.output), `convert to PDF/A-2b (compliant: ${pdfa.compliant}, remaining: ${pdfa.remaining_issues?.length ?? 0})`);

const opt = await call('optimize_pdf', { input_path: marked.output, sanitize: true });
check(opt.success && opt.bytes_after > 0, `optimize: ${opt.bytes_before} → ${opt.bytes_after} bytes`);

const ocr = await call('ocr_pdf', { input_path: base });
check(ocr.success || /OCR models/.test(ocr.error ?? ''), `ocr_pdf: ${ocr.success ? 'recognized' : 'clear error, models not installed'}`);

const cmp = await call('compare_pdfs', { old_path: base, new_path: marked.output, report_path: join(out, 'diff-report.pdf') });
check(cmp.success && existsSync(join(out, 'diff-report.pdf')) && (cmp.changes?.length ?? 0) > 0, `compare: ${cmp.changes?.length} changes + report`);

const fromImgs = await call('create_pdf', { from: 'images', image_paths: ren.files.slice(0, 3), output_path: join(out, 'from-images.pdf') });
check(fromImgs.success && fromImgs.pages === 3, 'create_pdf from 3 images');

const again = await call('merge_pdfs', { inputs: [base, base], output_path: join(out, 'merged.pdf') });
check(!again.success && /already exists/.test(again.error ?? ''), 'refuses to overwrite without overwrite:true');

const lt = await call('list_pdf_tools', { filter: 'bookmark', schemas: true });
check(lt.count >= 5 && lt.tools[0].input_schema, `list_pdf_tools bookmark: ${lt.count} with schemas`);

const adv = await call('run_pdf_tools', {
  open_paths: [base],
  steps: [
    { tool: 'bookmark_add', args: { doc: '$docs[0]', title: 'Inicio', page: 1 } },
    { tool: 'comment_add', args: { doc: '$docs[0]', page: 1, type: 'note', at: [100, 100], contents: 'Revisar ñ' } },
    { tool: 'doc_info', args: { doc: '$docs[0]' } },
  ],
  save: [{ doc: '$docs[0]', path: join(out, 'advanced.pdf') }],
});
const advInfo = await call('get_pdf_info', { input_path: join(out, 'advanced.pdf') });
check(adv.success && advInfo.bookmarks === 1 && advInfo.comments === 1, `run_pdf_tools: bookmark + comment saved (${adv.results?.map((r) => r.tool).join(', ')})`);

check(!readdirSync(join(out, 'split', 'contrato')).some((f) => f.startsWith('.pdfcraft-staging')), 'no staging folders left behind');

await client.close();
console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)} s · output in ${out}`);
process.exit(failed ? 1 : 0);

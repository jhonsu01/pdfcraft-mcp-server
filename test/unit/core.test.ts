import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { cleanEnv, resolveInstall, resolveInt } from '../../src/config.js';
import { resolveOutputPath, sameFile, stemOf, toEnginePath } from '../../src/paths.js';
import { substitute } from '../../src/tools/advanced.js';
import { collectInputs, moveNumbered } from '../../src/tools/common.js';

describe('config', () => {
  it('treats unfilled MCPB placeholders as unset', () => {
    expect(cleanEnv('${user_config.pdfcraft_dir}')).toBeUndefined();
    expect(cleanEnv('  "D:\\Apps\\PdfCraft" ')).toBe('D:\\Apps\\PdfCraft');
  });
  it('Windows: install folder, an .exe inside it, or nothing', () => {
    const exists = (p: string) => /^D:\\PC\\pdfcraft(-cli)?\.exe$/i.test(p);
    const r = resolveInstall({ PDFCRAFT_DIR: 'D:\\PC' }, exists, 'win32', 'C:\\Users\\u');
    expect([r.cli, r.app]).toEqual(['D:\\PC\\pdfcraft-cli.exe', 'D:\\PC\\pdfcraft.exe']);
    expect(resolveInstall({ PDFCRAFT_DIR: 'D:\\PC\\pdfcraft.exe' }, exists, 'win32').cli).toBe('D:\\PC\\pdfcraft-cli.exe');
    expect(resolveInstall({ PDFCRAFT_DIR: 'D:\\none' }, exists, 'win32').cli).toBeUndefined();
  });
  it('Windows: default Program Files install', () => {
    const exists = (p: string) => p === 'C:\\Program Files\\PdfCraft\\pdfcraft-cli.exe';
    expect(resolveInstall({ ProgramFiles: 'C:\\Program Files' }, exists, 'win32').cli).toBe('C:\\Program Files\\PdfCraft\\pdfcraft-cli.exe');
  });
  it('Linux: deb/rpm in /usr/bin, tar.gz root with bin/, PATH, AppImage app', () => {
    const deb = new Set(['/usr/bin/pdfcraft-cli', '/usr/bin/pdfcraft']);
    const r = resolveInstall({}, (p) => deb.has(p), 'linux', '/home/u');
    expect([r.cli, r.app]).toEqual(['/usr/bin/pdfcraft-cli', '/usr/bin/pdfcraft']);
    const tar = new Set(['/home/u/pdfcraft-0.4.0/bin/pdfcraft-cli']);
    expect(resolveInstall({ PDFCRAFT_DIR: '/home/u/pdfcraft-0.4.0' }, (p) => tar.has(p), 'linux', '/home/u').cli).toBe('/home/u/pdfcraft-0.4.0/bin/pdfcraft-cli');
    const onPath = new Set(['/srv/tools/pdfcraft-cli']);
    expect(resolveInstall({ PATH: '/usr/sbin:/srv/tools' }, (p) => onPath.has(p), 'linux', '/home/u').cli).toBe('/srv/tools/pdfcraft-cli');
    const img = '/home/u/Apps/pdfcraft-0.4.0-linux-x86_64.AppImage';
    expect(resolveInstall({ PDFCRAFT_APP: img }, (p) => p === img, 'linux', '/home/u').app).toBe(img);
  });
  it('macOS: PdfCraft.app plus the separate CLI zip', () => {
    const files = new Set(['/Applications/PdfCraft.app/Contents/MacOS/PdfCraft', '/opt/homebrew/bin/pdfcraft-cli']);
    const r = resolveInstall({}, (p) => files.has(p), 'darwin', '/Users/u');
    expect([r.cli, r.app]).toEqual(['/opt/homebrew/bin/pdfcraft-cli', '/Applications/PdfCraft.app/Contents/MacOS/PdfCraft']);
    const inApp = new Set(['/Apps/PdfCraft.app/Contents/MacOS/pdfcraft-cli']);
    expect(resolveInstall({ PDFCRAFT_DIR: '/Apps/PdfCraft.app' }, (p) => inApp.has(p), 'darwin', '/Users/u').cli).toBe('/Apps/PdfCraft.app/Contents/MacOS/pdfcraft-cli');
  });
  it('parses integers with a fallback', () => {
    expect(resolveInt('120', 5)).toBe(120);
    expect(resolveInt('x', 5)).toBe(5);
  });
});

describe('paths', () => {
  it('Windows: never overwrites by default, ignores case', () => {
    const exists = (p: string) => p === 'D:\\d\\report_marked.pdf';
    const w = { exists, platform: 'win32' as const };
    expect(resolveOutputPath({ inputPath: 'D:\\d\\report.pdf', ext: 'pdf', suffix: '_marked', ...w })).toEqual({ path: 'D:\\d\\report_marked_2.pdf' });
    expect(resolveOutputPath({ inputPath: 'D:\\d\\report.pdf', ext: 'pdf', outputPath: 'D:\\d\\out', ...w })).toEqual({ path: 'D:\\d\\out.pdf' });
    expect(resolveOutputPath({ inputPath: 'D:\\d\\report.pdf', ext: 'pdf', outputPath: 'D:\\d\\REPORT.pdf', ...w })).toHaveProperty('error');
    expect(resolveOutputPath({ inputPath: 'D:\\d\\report.pdf', ext: 'docx', outputPath: 'D:\\d\\x.pdf', ...w })).toHaveProperty('error');
    expect(sameFile('D:\\D\\A.pdf', 'd:\\d\\a.pdf', 'win32')).toBe(true);
    expect(toEnginePath('D:\\d\\a.pdf', 'win32')).toBe('D:/d/a.pdf');
  });
  it('Linux / macOS: POSIX paths, case-sensitive on Linux', () => {
    expect(resolveOutputPath({ inputPath: '/home/u/a.pdf', ext: 'pdf', suffix: '_x', exists: () => false, platform: 'linux' })).toEqual({ path: '/home/u/a_x.pdf' });
    expect(resolveOutputPath({ inputPath: '/v/a.pdf', ext: 'pdf', outputPath: 'rel.pdf', platform: 'darwin' })).toHaveProperty('error');
    expect(sameFile('/v/A.pdf', '/v/a.pdf', 'linux')).toBe(false);
    expect(stemOf('/a/b.c/contrato.final.pdf', 'linux')).toBe('contrato.final');
  });
});

describe('files', () => {
  it('collects only PDFs from a folder, numeric order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-unit-'));
    for (const f of ['b10.pdf', 'b2.pdf', 'notes.txt', 'C.PDF']) writeFileSync(join(dir, f), 'x');
    expect(collectInputs([], dir).map((p) => p.slice(dir.length + 1))).toEqual(['b2.pdf', 'b10.pdf', 'C.PDF']);
  });
  it('moves engine outputs to numbered names without replacing anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-unit-'));
    const st = mkdtempSync(join(tmpdir(), 'pc-stage-'));
    writeFileSync(join(dir, 'doc_part_001.pdf'), 'old');
    const staged = ['a-part1.pdf', 'a-part2.pdf'].map((f) => (writeFileSync(join(st, f), f), join(st, f)));
    const moved = moveNumbered(staged, dir, 'doc_part');
    expect(moved.map((p) => p.slice(dir.length + 1))).toEqual(['doc_part_001_2.pdf', 'doc_part_002.pdf']);
    expect(readdirSync(dir).sort()).toEqual(['doc_part_001.pdf', 'doc_part_001_2.pdf', 'doc_part_002.pdf']);
    expect(existsSync(staged[0])).toBe(false);
  });
});

describe('run_pdf_tools variables', () => {
  it('replaces $docs and $steps references', () => {
    const vars = { docs: [1, 2] };
    const steps = [{ doc: 3, files: ['/x/a.pdf'] }];
    expect(substitute({ doc: '$docs[1]', other: '$steps[0].doc', path: '$steps[0].files[0]', text: '$x' }, vars, steps)).toEqual({
      doc: 2,
      other: 3,
      path: '/x/a.pdf',
      text: '$x',
    });
    expect(() => substitute('$docs[4]', vars)).toThrow();
  });
});

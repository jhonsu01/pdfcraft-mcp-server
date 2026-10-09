import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { PdfCraftSession } from '../engine.js';
import { resolveOutputPath, stemOf, toEnginePath } from '../paths.js';

export type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
export type ToolResult = { content: Content[]; isError?: boolean };

export function json(obj: unknown, isError = false): ToolResult {
  const out: ToolResult = { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
  if (isError) out.isError = true;
  return out;
}

export function errorResult(e: unknown): ToolResult {
  return json({ success: false, error: e instanceof Error ? e.message : String(e) }, true);
}

export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
export const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

// ---------------------------------------------------------------- schemas

/** 1-based page list. Plain arrays only: some model APIs reject JSON Schema tuples. */
export const pagesSchema = z.array(z.number().int().min(1)).min(1).optional().describe('1-based page numbers (default: all pages).');
export const passwordSchema = z.string().optional().describe('Password of an encrypted input PDF (never echoed back).');
export const point2 = z.array(z.number()).length(2);
export const rect4 = z.array(z.number()).length(4);

export const inputsSchema = {
  input_path: z.string().optional().describe('Absolute path of one PDF.'),
  input_paths: z.array(z.string()).max(500).optional().describe('Absolute paths of several PDFs.'),
  input_dir: z.string().optional().describe('Absolute folder: every .pdf directly inside it (non-recursive).'),
  password: passwordSchema,
};

export const outputSchema = {
  output_path: z.string().optional().describe('Absolute output file (single input only).'),
  output_dir: z.string().optional().describe('Absolute folder for the results. Default: next to each input.'),
  overwrite: z.boolean().default(false).describe('Replace existing output files.'),
};

// ---------------------------------------------------------------- inputs

/** Absolute, existing files from explicit paths plus every file with one of exts directly inside dir. */
export function collectInputs(paths: string[], dir?: string, exts = ['pdf']): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (!path.isAbsolute(p)) throw new Error(`Paths must be absolute: ${p}`);
    if (!existsSync(p) || !statSync(p).isFile()) throw new Error(`File not found: ${p}`);
    out.push(p);
  }
  if (dir) {
    if (!path.isAbsolute(dir)) throw new Error(`input_dir must be an absolute path: ${dir}`);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`Folder not found: ${dir}`);
    for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      const full = path.join(dir, name);
      if (exts.includes(path.extname(name).slice(1).toLowerCase()) && statSync(full).isFile()) out.push(full);
    }
  }
  if (out.length === 0) throw new Error('No input files: give input_path, input_paths or input_dir.');
  return out;
}

export function inputsOf(a: { input_path?: string; input_paths?: string[]; input_dir?: string }): string[] {
  return collectInputs([...(a.input_path ? [a.input_path] : []), ...(a.input_paths ?? [])], a.input_dir);
}

// ---------------------------------------------------------------- documents

export interface OpenDoc {
  doc: number;
  pages: number;
  editable: boolean;
  encrypted: boolean;
}

export async function openDoc(s: PdfCraftSession, input: string, password?: string): Promise<OpenDoc> {
  const r = await s.json('doc_open', { path: toEnginePath(input), ...(password ? { password } : {}) });
  return { doc: r['doc'], pages: r['pages'], editable: r['editable'], encrypted: r['encrypted'] };
}

export function requireEditable(d: OpenDoc, input: string): void {
  if (!d.editable) throw new Error(`${input} can't be edited (it is protected against changes): open it with its permissions password.`);
}

/** Decide where a result goes (never overwriting unless asked). */
export function outputFor(
  input: string,
  ext: string,
  suffix: string,
  o: { output_path?: string; output_dir?: string; overwrite?: boolean },
): string {
  if (o.output_dir) mkdirSync(o.output_dir, { recursive: true });
  const r = resolveOutputPath({ inputPath: input, ext, suffix, outputPath: o.output_path, outputDir: o.output_dir, overwrite: o.overwrite });
  if ('error' in r) throw new Error(r.error);
  mkdirSync(path.dirname(r.path), { recursive: true });
  return r.path;
}

/** Full rewrite to a new file (atomic in the engine). */
export async function saveAs(s: PdfCraftSession, doc: number, out: string): Promise<{ path: string; bytes: number }> {
  const r = await s.json('doc_save', { doc, path: toEnginePath(out), full: true });
  return { path: out, bytes: r['bytes'] };
}

/**
 * The engine names split / export files itself and may replace files of the same name. Write into a
 * fresh folder and move the results to `dest` under `<prefix>_<NNN>.<ext>`, never replacing anything.
 */
export function stagingDir(dest: string): string {
  mkdirSync(dest, { recursive: true });
  const dir = path.join(dest, `.pdfcraft-staging-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function moveNumbered(
  staged: string[],
  dest: string,
  prefix: string,
  overwrite = false,
): string[] {
  const digits = Math.max(3, String(staged.length).length);
  return staged.map((src, i) => {
    const ext = path.extname(src).slice(1).toLowerCase();
    const r = resolveOutputPath({
      inputPath: path.join(dest, `${prefix}_${String(i + 1).padStart(digits, '0')}.__src`),
      ext,
      outputDir: dest,
      overwrite,
    });
    if ('error' in r) throw new Error(r.error);
    if (overwrite && existsSync(r.path)) rmSync(r.path, { force: true });
    renameSync(src, r.path);
    return r.path;
  });
}

export function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function fileSize(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

/** Engine paths come back with forward slashes and sometimes mixed separators: normalize for the OS. */
export function nativePath(p: string): string {
  return path.normalize(p);
}

export { stemOf, toEnginePath };

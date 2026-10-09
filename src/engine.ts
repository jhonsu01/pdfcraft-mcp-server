import { ChildProcessWithoutNullStreams, execFile, spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createInterface } from 'readline';
import { COMMAND_TIMEOUT_SEC, resolveInstall, resolveRoot } from './config.js';

/** A PdfCraft tool call the engine rejected (unknown tool, bad arguments, file problems...). */
export class PdfCraftToolError extends Error {
  constructor(
    public readonly tool: string,
    message: string,
  ) {
    super(`${tool}: ${message}`);
    this.name = 'PdfCraftToolError';
  }
}

let running = 0;
/** Engine sessions still open (index.ts waits for them before exiting). */
export function pendingRuns(): number {
  return running;
}

export function requireCli(): string {
  const install = resolveInstall();
  if (!install.cli) {
    throw new Error(
      `pdfcraft-cli not found (looked in ${install.searched.slice(0, 6).join(', ')} and PATH). Install PdfCraft ` +
        '(https://github.com/storytold/pdfcraft/releases; on macOS also the pdfcraft-cli zip) or set PDFCRAFT_DIR / PDFCRAFT_CLI.',
    );
  }
  return install.cli;
}

export interface ContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ToolOutput {
  /** The tool's JSON result (structuredContent, or the parsed text). */
  value: Record<string, any>;
  content: ContentItem[];
}

interface RpcResponse {
  result?: { content?: ContentItem[]; structuredContent?: Record<string, any>; isError?: boolean };
  error?: { message: string };
}

interface Pending {
  resolve: (v: RpcResponse) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * One PdfCraft engine: `pdfcraft-cli mcp` over stdio. Documents stay open in it, so the ids that
 * doc_open / doc_create return can be used by the next calls. Calls are sent one at a time.
 * Each session runs in its own temporary folder, removed when it closes.
 */
export class PdfCraftSession {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private stderr = '';
  private closed = false;
  private readonly workDir: string;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(cli: string) {
    this.workDir = mkdtempSync(path.join(os.tmpdir(), 'pcmcp-'));
    const args = ['mcp'];
    const root = resolveRoot();
    if (root) args.push('--root', root);
    this.proc = spawn(cli, args, { cwd: this.workDir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    running++;
    this.proc.stderr.setEncoding('utf-8');
    this.proc.stderr.on('data', (d: string) => {
      this.stderr = (this.stderr + d).slice(-4000);
    });
    createInterface({ input: this.proc.stdout }).on('line', (line) => this.onLine(line));
    this.proc.on('error', (e) => this.failAll(e));
    this.proc.on('exit', (code) => this.failAll(new Error(`PdfCraft engine exited (code ${code}). ${this.stderr.trim()}`.trim())));
  }

  static async open(): Promise<PdfCraftSession> {
    const s = new PdfCraftSession(requireCli());
    try {
      await s.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pdfcraft-mcp-server', version: '1' } });
      s.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    } catch (e) {
      s.close();
      throw e;
    }
    return s;
  }

  private send(msg: unknown): void {
    this.proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  private onLine(line: string): void {
    let msg: { id?: number } & RpcResponse;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof msg.id !== 'number') return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg);
  }

  private failAll(e: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(e);
    }
    this.pending.clear();
    this.finish();
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    running--;
    try {
      rmSync(this.workDir, { recursive: true, force: true });
    } catch {
      // still locked: the OS temp cleanup takes it later
    }
  }

  private rpc(method: string, params: unknown, timeoutSec = COMMAND_TIMEOUT_SEC): Promise<RpcResponse> {
    const run = () =>
      new Promise<RpcResponse>((resolve, reject) => {
        if (this.closed) return reject(new Error('PdfCraft engine is closed.'));
        const id = this.nextId++;
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`PdfCraft engine timed out after ${timeoutSec} s (${method}).`));
        }, timeoutSec * 1000);
        this.pending.set(id, { resolve, reject, timer });
        this.send({ jsonrpc: '2.0', id, method, params });
      });
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Call one of PdfCraft's automation tools (same names and arguments as `pdfcraft-cli tools`). */
  async call(tool: string, args: Record<string, unknown> = {}): Promise<ToolOutput> {
    const r = await this.rpc('tools/call', { name: tool, arguments: args });
    if (r.error) throw new PdfCraftToolError(tool, r.error.message);
    const result = r.result ?? {};
    const content = result.content ?? [];
    const text = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    if (result.isError) throw new PdfCraftToolError(tool, text || 'failed');
    let value: Record<string, any> = result.structuredContent ?? {};
    if (!result.structuredContent && text) {
      try {
        value = JSON.parse(text);
      } catch {
        value = { text };
      }
    }
    return { value, content };
  }

  /** The JSON result only. */
  async json<T = Record<string, any>>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    return (await this.call(tool, args)).value as T;
  }

  close(): void {
    if (this.closed) return;
    try {
      this.proc.stdin.end();
    } catch {
      // already gone
    }
    const p = this.proc;
    setTimeout(() => {
      if (p.exitCode === null) p.kill();
    }, 2000).unref();
    this.finish();
  }
}

/** Open a session, run fn, always close. */
export async function withSession<T>(fn: (s: PdfCraftSession) => Promise<T>): Promise<T> {
  const s = await PdfCraftSession.open();
  try {
    return await fn(s);
  } finally {
    s.close();
  }
}

/** One-shot CLI call (--version, tools): stdout as text. */
export function runCli(args: string[], timeoutSec = 120): Promise<string> {
  const cli = requireCli();
  return new Promise((resolve, reject) => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'pcmcp-'));
    execFile(
      cli,
      args,
      { cwd, windowsHide: true, timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf-8' },
      (err, stdout, stderr) => {
        try {
          rmSync(cwd, { recursive: true, force: true });
        } catch {
          // ignore
        }
        if (err) reject(new Error(`pdfcraft-cli ${args[0]}: ${(stderr || stdout || err.message).toString().trim()}`));
        else resolve(stdout);
      },
    );
  });
}

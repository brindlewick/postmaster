// Process and filesystem edges: temp directories the scripts clean up, and a
// spawn wrapper that returns exit code and output the way the bash versions read it.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RunResult {
  code: number;
  out: string;
  err: string;
}

/** Run a command; never throws on a non-zero exit.
 * A command that never starts reports the way a shell does: 127 with a
 * diagnostic when it is not found, 126 when it cannot be executed. `timeout`
 * is milliseconds, past which the child is killed and the run reports 128
 * with whatever output it produced. */
export function run(
  cmd: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    input?: string;
    timeout?: number;
  } = {},
): RunResult {
  let env: Record<string, string | undefined> = process.env;
  if (options.env !== undefined) {
    env = { ...process.env };
    for (const [k, v] of Object.entries(options.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
  const r = spawnSync(cmd, args, {
    cwd: options.cwd,
    env,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  });
  const error = r.error as NodeJS.ErrnoException | undefined;
  if (error && (r.status === null || r.status === undefined) && !r.signal) {
    if (error.code === "ENOENT") return { code: 127, out: "", err: `${cmd}: command not found\n` };
    if (error.code === "EACCES") return { code: 126, out: "", err: `${cmd}: permission denied\n` };
    return {
      code: 1,
      out: String(r.stdout ?? ""),
      err: String(r.stderr ?? "") || `${cmd}: ${error.message}\n`,
    };
  }
  return {
    code: r.status ?? (r.signal ? 128 : 1),
    out: String(r.stdout ?? ""),
    err: String(r.stderr ?? ""),
  };
}

/** This process's raw argv bytes, or null where the kernel does not expose
 * them (no /proc). Decoded arguments cannot tell a legitimate U+FFFD from
 * one the runtime substituted for undecodable bytes; these bytes can. */
export function rawArgvBytes(): Buffer | null {
  try {
    return readFileSync("/proc/self/cmdline");
  } catch {
    return null;
  }
}

/** Whether our own argv holds bytes that are not valid UTF-8. True only when
 * /proc proves it; without /proc there is nothing to check against, and a
 * U+FFFD in a decoded argument is a legitimate character, not evidence. */
export function argvHasUndecodableBytes(): boolean {
  const raw = rawArgvBytes();
  if (raw === null) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(raw);
    return false;
  } catch {
    return true;
  }
}

/** Decode bytes as UTF-8, dropping invalid sequences the way `iconv -c`
 * does: a byte that cannot start a valid sequence is skipped and decoding
 * resumes after it, so damaged input loses bytes and never gains a
 * replacement character. Overlongs, surrogates, strays past U+10FFFF and
 * truncated tails are all damage. */
export function decodeDropInvalid(bytes: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b < 0x80) {
      out.push(String.fromCharCode(b));
      i++;
      continue;
    }
    let len = 0;
    let min = 0;
    if (b >= 0xc2 && b <= 0xdf) {
      len = 2;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      len = 3;
      min = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      len = 4;
      min = 0x10000;
    } else {
      i++; // a stray continuation, C0/C1, F5+: drop one byte
      continue;
    }
    if (i + len > bytes.length) {
      i++; // truncated tail: drop, retry after
      continue;
    }
    let cp = b & (len === 2 ? 0x1f : len === 3 ? 0x0f : 0x07);
    let ok = true;
    for (let j = 1; j < len; j++) {
      const c = bytes[i + j]!;
      if (c < 0x80 || c > 0xbf) {
        ok = false;
        break;
      }
      cp = (cp << 6) | (c & 0x3f);
    }
    if (!ok || cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
      i++;
      continue;
    }
    out.push(String.fromCodePoint(cp));
    i += len;
  }
  return out.join("");
}

/** This process's arguments re-derived from the raw argv bytes, with invalid
 * sequences dropped the way `iconv -c` drops them. The raw bytes tell entry
 * by entry, so a bad byte in one argument never costs another its
 * characters. Without /proc, or when the raw entries do not align with the
 * decoded arguments, the runtime's decoding stands. */
export function argvDecoded(): string[] {
  const args = process.argv.slice(2);
  const raw = rawArgvBytes();
  if (raw === null) return args;
  const parts: Buffer[] = [];
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === 0) {
      parts.push(raw.subarray(start, i));
      start = i + 1;
    }
  }
  if (start < raw.length) parts.push(raw.subarray(start));
  if (parts.length !== args.length + 2) return args;
  return parts.slice(2).map((p) => decodeDropInvalid(p));
}

/** mkdir -d a temp dir and hand it to fn; remove it afterwards even if fn throws. */
export function withTempDir<T>(fn: (dir: string) => T, prefix = "postmaster-"): T {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const cleanup = (): void => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // cleanup is best-effort; a leftover temp dir is not a control failure
    }
  };
  try {
    const r = fn(dir);
    if (r instanceof Promise) {
      return r.finally(cleanup) as T;
    }
    cleanup();
    return r;
  } catch (e) {
    cleanup();
    throw e;
  }
}

/** Print to stderr and exit with the code, matching the bash `echo ... >&2; exit n` pattern. */
export function die(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
  throw new Error("unreachable");
}

/** Print to stdout and exit 0. */
export function say(message: string): never {
  process.stdout.write(`${message}\n`);
  process.exit(0);
  throw new Error("unreachable");
}

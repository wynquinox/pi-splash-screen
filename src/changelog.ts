import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ChangelogEntry {
  hash: string;
  date: string;
  subject: string;
}

export interface BootState {
  head: string;
  lastBootAt: string;
}

interface GitResult {
  stdout: string;
  code: number;
}

export type GitRunner = (args: readonly string[], cwd: string) => Promise<GitResult>;

export interface ChangelogSnapshot {
  entries: ChangelogEntry[];
  currentHead: string | undefined;
  markRead: () => Promise<void>;
}

const RECORD_SEPARATOR = "\u001e";
const FIELD_SEPARATOR = "\u001f";

export function parseGitLog(output: string): ChangelogEntry[] {
  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.split(FIELD_SEPARATOR))
    .filter((fields): fields is [string, string, string] => fields.length >= 3)
    .map(([hash, date, subject]) => ({
      hash: hash.trim(),
      date: date.trim(),
      subject: subject.trim(),
    }))
    .filter((entry) => entry.hash.length > 0 && entry.subject.length > 0);
}

export function defaultStateFile(cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const stateHome = env.XDG_STATE_HOME ?? join(env.HOME ?? process.cwd(), ".local", "state");
  const projectId = createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  return join(stateHome, "pi-splash-screen", `${projectId}.json`);
}

export function parseBootState(value: unknown): BootState | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const state = value as Partial<BootState>;
  if (typeof state.head !== "string" || typeof state.lastBootAt !== "string") return undefined;
  return { head: state.head, lastBootAt: state.lastBootAt };
}

async function readState(path: string): Promise<BootState | undefined> {
  try {
    const content = await readFile(path, "utf8");
    return parseBootState(JSON.parse(content) as unknown);
  } catch {
    return undefined;
  }
}

async function writeState(path: string, state: BootState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, new TextEncoder().encode(`${JSON.stringify(state)}\n`));
  await rename(temporaryPath, path);
}

export async function getChangelogSnapshot(
  cwd: string,
  statePath: string,
  runGit: GitRunner,
  now: () => Date = () => new Date(),
): Promise<ChangelogSnapshot> {
  const headResult = await runGit(["rev-parse", "HEAD"], cwd);
  if (headResult.code !== 0) {
    return { entries: [], currentHead: undefined, markRead: async () => undefined };
  }

  const currentHead = headResult.stdout.trim();
  if (!currentHead) {
    return { entries: [], currentHead: undefined, markRead: async () => undefined };
  }

  const previousState = await readState(statePath);
  let entries: ChangelogEntry[] = [];
  if (previousState?.head && previousState.head !== currentHead) {
    const logResult = await runGit(
      ["log", "--format=%H%x1f%cs%x1f%s%x1e", `${previousState.head}..${currentHead}`],
      cwd,
    );
    if (logResult.code === 0) entries = parseGitLog(logResult.stdout);
  }

  return {
    entries,
    currentHead,
    markRead: () => writeState(statePath, { head: currentHead, lastBootAt: now().toISOString() }),
  };
}

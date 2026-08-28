import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultStateFile,
  getChangelogSnapshot,
  parseBootState,
  parseGitLog,
  type GitRunner,
} from "../src/changelog.js";

describe("parseGitLog", () => {
  it("parses git records and trims fields", () => {
    const entries = parseGitLog(
      "abc\u001f2025-01-02\u001fAdd splash screen\u001e" +
        "def\u001f2025-01-01\u001fFix\u001fparser\u001e",
    );

    expect(entries).toEqual([
      { hash: "abc", date: "2025-01-02", subject: "Add splash screen" },
      { hash: "def", date: "2025-01-01", subject: "Fix" },
    ]);
  });

  it("drops malformed and empty records", () => {
    expect(parseGitLog("bad\u001frecord\u001e\u001e\u001f\u001f\u001f")).toEqual([]);
  });

  it("trims valid fields and ignores incomplete records", () => {
    expect(
      parseGitLog(
        " abc \u001f 2025-01-01 \u001f Fix it \u001e" +
          "bad\u001frecord\u001e" +
          "\u001f2025-01-01\u001fmissing hash\u001e" +
          "hash\u001f2025-01-01\u001f ",
      ),
    ).toEqual([{ hash: "abc", date: "2025-01-01", subject: "Fix it" }]);
  });
});

describe("getChangelogSnapshot", () => {
  it("shows no entries on first boot and records the current head", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    const runner: GitRunner = async (args) =>
      args[0] === "rev-parse" ? { stdout: "head-1\n", code: 0 } : { stdout: "", code: 0 };

    const snapshot = await getChangelogSnapshot("/project", statePath, runner, () => new Date("2025-01-02"));

    expect(snapshot.entries).toEqual([]);
    await snapshot.markRead();
    await expect(readFile(statePath, "utf8")).resolves.toContain('"head":"head-1"');
  });

  it("returns commits since the previous boot", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    const firstRunner: GitRunner = async () => ({ stdout: "head-1\n", code: 0 });
    const first = await getChangelogSnapshot("/project", statePath, firstRunner);
    await first.markRead();

    const calls: string[][] = [];
    const runner: GitRunner = async (args) => {
      calls.push([...args]);
      if (args[0] === "rev-parse") return { stdout: "head-2\n", code: 0 };
      return {
        stdout: "head-2\u001f2025-01-03\u001fNew feature\u001ehead-1\u001f2025-01-02\u001fOld feature\u001e",
        code: 0,
      };
    };
    const snapshot = await getChangelogSnapshot("/project", statePath, runner);

    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]?.subject).toBe("New feature");
    expect(calls).toEqual([
      ["rev-parse", "HEAD"],
      ["log", "--format=%H%x1f%cs%x1f%s%x1e", "head-1..head-2"],
    ]);
  });

  it("does not fail startup outside a git repository", async () => {
    const runner: GitRunner = async () => ({ stdout: "fatal: not a repo", code: 128 });

    await expect(
      getChangelogSnapshot("/not-a-repo", "/tmp/unused-state.json", runner),
    ).resolves.toMatchObject({ entries: [], currentHead: undefined });
  });

  it("does not query the log when the boot head has not changed", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    const first = await getChangelogSnapshot(
      "/project",
      statePath,
      async () => ({ stdout: "same-head\n", code: 0 }),
    );
    await first.markRead();
    const calls: string[][] = [];
    const runner: GitRunner = async (args) => {
      calls.push([...args]);
      return { stdout: "same-head\n", code: 0 };
    };

    const snapshot = await getChangelogSnapshot("/project", statePath, runner);

    expect(snapshot.entries).toEqual([]);
    expect(calls).toEqual([["rev-parse", "HEAD"]]);
  });

  it("ignores a failed git log and an invalid saved state", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    await writeFile(statePath, JSON.stringify({ head: 42, lastBootAt: "yesterday" }));
    const runner: GitRunner = async (args) =>
      args[0] === "rev-parse"
        ? { stdout: "new-head\n", code: 0 }
        : { stdout: "ignored", code: 1 };

    const snapshot = await getChangelogSnapshot("/project", statePath, runner);

    expect(snapshot.entries).toEqual([]);
  });

  it("ignores a failed git log when the saved state is valid", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    await writeFile(statePath, JSON.stringify({ head: "old-head", lastBootAt: "yesterday" }));
    const runner: GitRunner = async (args) =>
      args[0] === "rev-parse"
        ? { stdout: "new-head\n", code: 0 }
        : { stdout: "hash\u001f2025-01-01\u001fWould be shown\u001e", code: 1 };

    await expect(getChangelogSnapshot("/project", statePath, runner)).resolves.toMatchObject({
      entries: [],
      currentHead: "new-head",
    });
  });

  it("treats an empty git head as unavailable", async () => {
    const runner: GitRunner = async () => ({ stdout: "\n", code: 0 });

    await expect(
      getChangelogSnapshot("/project", "/tmp/unused-state.json", runner),
    ).resolves.toMatchObject({ entries: [], currentHead: undefined });
  });

  it("uses a stable state location derived from the project path", () => {
    expect(defaultStateFile("/project", { XDG_STATE_HOME: "/state" })).toMatch(
      /^\/state\/pi-splash-screen\/[a-f0-9]{16}\.json$/,
    );
    expect(defaultStateFile("/other-project", { XDG_STATE_HOME: "/state" })).not.toBe(
      defaultStateFile("/project", { XDG_STATE_HOME: "/state" }),
    );
    expect(defaultStateFile("/project", { HOME: "/home/test" })).toMatch(
      /^\/home\/test\/\.local\/state\/pi-splash-screen\//,
    );
  });

  it("does not use partially valid saved state", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    await writeFile(statePath, JSON.stringify({ head: 42, lastBootAt: "yesterday" }));
    const calls: string[][] = [];
    const runner: GitRunner = async (args) => {
      calls.push([...args]);
      return { stdout: "new-head\n", code: 0 };
    };

    await getChangelogSnapshot("/project", statePath, runner);

    expect(calls).toEqual([["rev-parse", "HEAD"]]);
  });

  it("does not use state with an invalid boot timestamp", async () => {
    const statePath = join(await mkdtemp(join(tmpdir(), "pi-splash-state-")), "state.json");
    await writeFile(statePath, JSON.stringify({ head: "old-head", lastBootAt: 42 }));
    const calls: string[][] = [];
    const runner: GitRunner = async (args) => {
      calls.push([...args]);
      return { stdout: "new-head\n", code: 0 };
    };

    await getChangelogSnapshot("/project", statePath, runner);

    expect(calls).toEqual([["rev-parse", "HEAD"]]);
  });
});

describe("parseBootState", () => {
  it("validates both state fields", () => {
    expect(parseBootState(undefined)).toBeUndefined();
    expect(parseBootState(null)).toBeUndefined();
    expect(parseBootState({ head: "head", lastBootAt: "now" })).toEqual({
      head: "head",
      lastBootAt: "now",
    });
    expect(parseBootState({ head: 42, lastBootAt: "now" })).toBeUndefined();
    expect(parseBootState({ head: "head", lastBootAt: 42 })).toBeUndefined();
  });
});

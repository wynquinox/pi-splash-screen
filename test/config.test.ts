import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PRO_TIP,
  DEFAULT_WELCOME,
  loadSplashConfig,
  parseConfigFile,
} from "../src/config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  temporaryDirectories.length = 0;
});

async function projectDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pi-splash-config-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("loadSplashConfig", () => {
  it("uses defaults when no project config or environment overrides exist", async () => {
    const config = await loadSplashConfig(await projectDirectory(), {});

    expect(config).toEqual({
      welcome: "Welcome to Pi",
      proTip: "Pro tip: use /help to discover Pi's commands and shortcuts.",
    });
    expect(DEFAULT_WELCOME).toBe("Welcome to Pi");
    expect(DEFAULT_PRO_TIP).toContain("Pro tip:");
  });

  it("loads project values and lets environment values take precedence", async () => {
    const cwd = await projectDirectory();
    await mkdir(join(cwd, ".pi"));
    await writeFile(
      join(cwd, ".pi", "splash-screen.json"),
      JSON.stringify({ welcome: "Project welcome", proTip: "Project tip" }),
    );

    await expect(loadSplashConfig(cwd, { PI_SPLASH_PROTIP: "Environment tip" })).resolves.toEqual({
      welcome: "Project welcome",
      proTip: "Environment tip",
    });
  });

  it("ignores malformed or blank project values", async () => {
    const cwd = await projectDirectory();
    await mkdir(join(cwd, ".pi"));
    await writeFile(join(cwd, ".pi", "splash-screen.json"), "{not json");

    await expect(loadSplashConfig(cwd, {})).resolves.toEqual({
      welcome: DEFAULT_WELCOME,
      proTip: DEFAULT_PRO_TIP,
    });
  });

  it("ignores non-object config files and blank environment overrides", async () => {
    const cwd = await projectDirectory();
    await mkdir(join(cwd, ".pi"));
    await writeFile(join(cwd, ".pi", "splash-screen.json"), "null");

    await expect(
      loadSplashConfig(cwd, { PI_SPLASH_WELCOME: "  ", PI_SPLASH_PROTIP: "\t" }),
    ).resolves.toEqual({
      welcome: DEFAULT_WELCOME,
      proTip: DEFAULT_PRO_TIP,
    });
  });

  it("trims configured values", async () => {
    const cwd = await projectDirectory();
    await mkdir(join(cwd, ".pi"));
    await writeFile(
      join(cwd, ".pi", "splash-screen.json"),
      JSON.stringify({ welcome: "  Hello  ", proTip: "\tUse /help\t" }),
    );

    await expect(loadSplashConfig(cwd, {})).resolves.toEqual({
      welcome: "Hello",
      proTip: "Use /help",
    });
  });

  it("falls back independently when one project value is absent", async () => {
    const cwd = await projectDirectory();
    await mkdir(join(cwd, ".pi"));
    await writeFile(join(cwd, ".pi", "splash-screen.json"), JSON.stringify({ welcome: "Hello" }));

    await expect(loadSplashConfig(cwd, {})).resolves.toEqual({
      welcome: "Hello",
      proTip: DEFAULT_PRO_TIP,
    });
  });
});

describe("parseConfigFile", () => {
  it("returns an empty config for non-object values", () => {
    expect(parseConfigFile(null)).toEqual({});
    expect(parseConfigFile("not an object")).toEqual({});
  });

  it("does not add absent optional values", () => {
    expect(parseConfigFile({ welcome: "Hello" })).toStrictEqual({ welcome: "Hello" });
    expect(parseConfigFile({ proTip: "Tip" })).toStrictEqual({ proTip: "Tip" });
  });
});

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_WELCOME = "Welcome to Pi";
export const DEFAULT_PRO_TIP = "Pro tip: use /help to discover Pi's commands and shortcuts.";

export interface SplashConfig {
  welcome: string;
  proTip: string;
}

interface ConfigFile {
  welcome?: unknown;
  proTip?: unknown;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function parseConfigFile(value: unknown): Partial<SplashConfig> {
  if (typeof value !== "object" || value === null) return {};

  const config = value as ConfigFile;
  const parsed: Partial<SplashConfig> = {};
  const welcome = nonEmptyString(config.welcome);
  const proTip = nonEmptyString(config.proTip);
  if (welcome) parsed.welcome = welcome;
  if (proTip) parsed.proTip = proTip;
  return parsed;
}

async function readProjectConfig(cwd: string): Promise<Partial<SplashConfig>> {
  try {
    const content = await readFile(join(cwd, ".pi", "splash-screen.json"), "utf8");
    return parseConfigFile(JSON.parse(content) as unknown);
  } catch {
    return {};
  }
}

export async function loadSplashConfig(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SplashConfig> {
  const fileConfig = await readProjectConfig(cwd);
  const welcome = nonEmptyString(env.PI_SPLASH_WELCOME) ?? fileConfig.welcome ?? DEFAULT_WELCOME;
  const proTip = nonEmptyString(env.PI_SPLASH_PROTIP) ?? fileConfig.proTip ?? DEFAULT_PRO_TIP;

  return { welcome, proTip };
}

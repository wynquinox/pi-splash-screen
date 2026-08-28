import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defaultStateFile, getChangelogSnapshot } from "./changelog.js";
import { loadSplashConfig } from "./config.js";
import { createSplashComponent } from "./splash.js";

export default function piSplashScreen(pi: ExtensionAPI): void {
  const runGit = async (args: readonly string[], cwd: string) => {
    const result = await pi.exec("git", [...args], { cwd });
    return { stdout: result.stdout, code: result.code };
  };

  pi.on("session_start", async (event, ctx) => {
    if (event.reason !== "startup" || ctx.mode !== "tui" || !ctx.hasUI) return;

    const statePath = process.env.PI_SPLASH_STATE_FILE ?? defaultStateFile(ctx.cwd);
    const [config, snapshot] = await Promise.all([
      loadSplashConfig(ctx.cwd),
      getChangelogSnapshot(ctx.cwd, statePath, runGit),
    ]);

    await ctx.ui.custom(
      (_tui, theme, _keybindings, done) =>
        createSplashComponent(
          { welcome: config.welcome, proTip: config.proTip, changelog: snapshot.entries },
          theme,
          () => done(undefined),
        ),
      {
        overlay: true,
        overlayOptions: {
          width: "90%",
          maxHeight: "80%",
          margin: 1,
        },
      },
    );

    await snapshot.markRead();
  });
}

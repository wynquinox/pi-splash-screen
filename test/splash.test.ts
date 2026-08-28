import { describe, expect, it, vi } from "vitest";
import { SplashScreen, type SplashTheme } from "../src/splash.js";

const theme: SplashTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe("SplashScreen", () => {
  it("keeps the welcome and pro tip visible while rendering a changelog", () => {
    const screen = new SplashScreen(
      {
        welcome: "Welcome",
        proTip: "Tip",
        changelog: [
          { hash: "123456789", date: "2025-01-01", subject: "Update one" },
          { hash: "abcdefghi", date: "2025-01-02", subject: "Update two" },
        ],
      },
      theme,
      vi.fn(),
    );

    const lines = screen.render(80);

    expect(lines.join("\n")).toContain("Welcome");
    expect(lines.join("\n")).toContain("Tip");
    expect(lines.join("\n")).toContain("Update one");
    expect(lines.join("\n")).toContain("Update two");
  });

  it("omits the changelog section when there are no updates", () => {
    const screen = new SplashScreen(
      { welcome: "Welcome", proTip: "Tip", changelog: [] },
      theme,
      vi.fn(),
    );

    expect(screen.render(80).join("\n")).not.toContain("What's new");
  });

  it("closes on Enter or Escape", () => {
    const close = vi.fn();
    const screen = new SplashScreen(
      { welcome: "Welcome", proTip: "Tip", changelog: [] },
      theme,
      close,
    );

    screen.handleInput("\r");
    screen.handleInput("\u001b");

    expect(close).toHaveBeenCalledTimes(2);
  });
});

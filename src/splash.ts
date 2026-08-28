import {
  Key,
  ScrollView,
  Text,
  VStack,
  type Component,
  matchesKey,
} from "@earendil-works/pi-tui";

import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ChangelogEntry } from "./changelog.js";

export type SplashTheme = Pick<Theme, "fg" | "bold">;

export interface SplashContent {
  welcome: string;
  proTip: string;
  changelog: ChangelogEntry[];
}

function changelogText(entries: ChangelogEntry[]): string {
  return entries.map((entry) => `${entry.date}  ${entry.subject}\n  ${entry.hash.slice(0, 8)}`).join("\n\n");
}

function changelogLineCount(entries: ChangelogEntry[]): number {
  return changelogText(entries).split("\n").length;
}

export class SplashScreen extends VStack {
  private readonly scrollView: ScrollView | undefined;
  private readonly close: () => void;
  private readonly welcomeText: Text;
  private readonly proTipText: Text;
  private readonly changelogHeading: Text | undefined;
  private readonly hintText: Text;
  private readonly theme: SplashTheme;
  private readonly content: SplashContent;

  constructor(content: SplashContent, theme: SplashTheme, close: () => void) {
    super([], { gap: 1 });
    this.content = content;
    this.theme = theme;
    this.close = close;

    this.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)), { shrink: 0 });
    this.welcomeText = new Text("", 1, 0);
    this.proTipText = new Text("", 1, 0);
    this.addChild(this.welcomeText, { shrink: 0 });
    this.addChild(this.proTipText, { shrink: 0 });

    if (content.changelog.length > 0) {
      this.changelogHeading = new Text("", 1, 0);
      this.addChild(this.changelogHeading, { shrink: 0 });
      const changelog = new Text(changelogText(content.changelog), 1, 0);
      this.scrollView = new ScrollView(changelog, {
        scrollbar: "always",
        overscroll: "contain",
      });
      this.addChild(this.scrollView, { grow: 1, minSize: 1, shrink: 1 });
    }

    const hint = content.changelog.length > 0
      ? `↑↓ scroll · PgUp/PgDn jump · Enter/Esc close · ${changelogLineCount(content.changelog)} lines`
      : "Enter/Esc close";
    this.hintText = new Text("", 1, 0);
    this.addChild(this.hintText, { shrink: 0 });
    this.addChild(new DynamicBorder((text) => theme.fg("borderAccent", text)), { shrink: 0 });
    this.refreshTheme(hint);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
      this.close();
      return;
    }

    if (!this.scrollView) return;
    const pageSize = Math.max(1, this.scrollView.viewportHeight - 1);
    if (matchesKey(data, Key.up)) this.scrollView.scrollBy(-1);
    else if (matchesKey(data, Key.down)) this.scrollView.scrollBy(1);
    else if (matchesKey(data, Key.pageUp)) this.scrollView.scrollBy(-pageSize);
    else if (matchesKey(data, Key.pageDown)) this.scrollView.scrollBy(pageSize);
    else if (matchesKey(data, Key.home)) this.scrollView.scrollToStart();
    else if (matchesKey(data, Key.end)) this.scrollView.scrollToEnd();
  }

  private refreshTheme(hint: string): void {
    this.welcomeText.setText(this.theme.fg("accent", this.theme.bold(this.content.welcome)));
    this.proTipText.setText(this.theme.fg("muted", this.content.proTip));
    this.changelogHeading?.setText(this.theme.fg("accent", this.theme.bold("What's new")));
    this.hintText.setText(this.theme.fg("dim", hint));
  }

  override invalidate(): void {
    super.invalidate();
    const hint = this.content.changelog.length > 0
      ? `↑↓ scroll · PgUp/PgDn jump · Enter/Esc close · ${changelogLineCount(this.content.changelog)} lines`
      : "Enter/Esc close";
    this.refreshTheme(hint);
  }
}

export function createSplashComponent(
  content: SplashContent,
  theme: SplashTheme,
  done: () => void,
): Component {
  return new SplashScreen(content, theme, done);
}

# Pi splash screen

An extension for the [Pi agentic coding harness](https://github.com/earendil-works/pi)
that shows a themed startup splash screen containing:

- A welcome message.
- A usage pro-tip.
- Git commit subjects added since the last boot, when there are any.

The welcome and pro-tip stay fixed. When updates exist, the changelog gets its
own scrollable viewport with arrow keys, PageUp/PageDown, Home, and End.
`Enter` or `Escape` closes the splash screen.

The changelog is based on the current project's Git history. On the first boot
the extension records the current `HEAD`, so the changelog starts with commits
made after that first boot rather than dumping the repository's entire history.

## Install

From this repository, install dependencies and run Pi with:

```sh
npm install
pi --extension ./src/index.ts
```

For automatic discovery, install this project as a Pi package or copy the
extension directory into `~/.pi/agent/extensions/`. Project-local discovery is
also supported from `.pi/extensions/`.

## Configuration

The defaults can be overridden with `.pi/splash-screen.json`:

```json
{
  "welcome": "Welcome back to Pi",
  "proTip": "Pro tip: keep prompts small and specific."
}
```

`PI_SPLASH_WELCOME` and `PI_SPLASH_PROTIP` environment variables override the
project file. Boot markers are stored under
`$XDG_STATE_HOME/pi-splash-screen/` (or `$HOME/.local/state/...`) and can be
relocated with `PI_SPLASH_STATE_FILE`.

## Quality checks

```sh
npm run lint
npm run build
npm test
npm run mutation
```

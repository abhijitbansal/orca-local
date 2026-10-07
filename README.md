<h1 align="center">
  <img src="resources/build/icon.png" alt="Orca" width="64" valign="middle" /> Orca
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="License: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="Supported platforms: macOS, Windows, and Linux" />
</p>

<p align="center">
  <sub><a href="docs/readme/README.zh-CN.md">中文</a> · <a href="docs/readme/README.ja.md">日本語</a> · <a href="docs/readme/README.ko.md">한국어</a> · <a href="docs/readme/README.es.md">Español</a> · <a href="docs/readme/README.fr.md">Français</a> · <a href="docs/readme/README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>The AI Orchestrator for 100x builders.</strong><br/>
  Run Codex, ClaudeCode, OpenCode or Pi side-by-side — each in its own worktree, tracked in one place.
</p>

> **Local-only fork.** This fork of [stablyai/orca](https://github.com/stablyai/orca) runs entirely on your machine. There are no cloud accounts, no mobile app, no auto-update, no telemetry upload, no SSH or remote Orca servers, and no network listener. A local usage record, on by default for new installs and off with one switch, is written to a file and never sent anywhere. Git works through your own `git` CLI against your own remotes. See [Download](#download), [What this fork changed](#what-this-fork-changed), [Build from source](#build-from-source) and [Updating from upstream](#updating-from-upstream).

## Features

<table>
<tr>
<td width="50%" valign="middle">

### Parallel Worktrees

Fan one prompt across five agents, each in its own isolated git worktree — compare the results and merge the winner.

[Docs →](docs/site/content/docs/model/worktrees.mdx)

</td>
<td width="50%">
  <a href="docs/site/content/docs/model/worktrees.mdx"><picture><source srcset="docs/site/public/docs/tab-split.gif" type="image/gif"><img src="docs/site/public/docs/posters/tab-split.jpg" alt="Parallel worktree orchestration" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Terminal Splits

Ghostty-class terminals with WebGL rendering, infinite splits, and scrollback that survives restarts.

[Docs →](docs/site/content/docs/terminal.mdx)

</td>
<td width="50%">
  <a href="docs/site/content/docs/terminal.mdx"><picture><source srcset="resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-02.poster.jpg" alt="Terminal splits" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Design Mode

Click any UI element in a real Chromium window to send its HTML, CSS, and a cropped screenshot straight into your agent's prompt.

[Docs →](docs/site/content/docs/browser/design-mode.mdx)

</td>
<td width="50%">
  <a href="docs/site/content/docs/browser/design-mode.mdx"><picture><source srcset="docs/site/public/docs/orca-design-mode.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-05.poster.jpg" alt="Embedded browser and Design Mode" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Annotate AI Diffs

Drop comments on any diff line and ship them back to the agent — review, edit, and commit without leaving Orca.

[Docs →](docs/site/content/docs/review/annotate-ai-diff.mdx)

</td>
<td width="50%">
  <a href="docs/site/content/docs/review/annotate-ai-diff.mdx"><picture><source srcset="docs/site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-08.poster.jpg" alt="Annotate AI-generated diffs" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Drag Files to Agents

VS Code's editor with autosave everywhere — drag files or images straight into an agent prompt.

[Docs →](docs/site/content/docs/editing/file-explorer.mdx)

</td>
<td width="50%">
  <a href="docs/site/content/docs/editing/file-explorer.mdx"><picture><source srcset="resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-07.poster.jpg" alt="Drag files and images into an agent prompt" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

Agents drive Orca too — script every workflow with `orca worktree create`, `snapshot`, `click`, and `fill`.

[Docs →](docs/site/content/docs/cli/overview.mdx)

</td>
<td width="50%">
  <a href="docs/site/content/docs/cli/overview.mdx"><picture><source srcset="resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="resources/onboarding/feature-wall/tile-09.poster.jpg" alt="Script Orca from the CLI" width="100%" /></picture></a>
</td>
</tr>
</table>

**Also in the box:**

- **[Quick open](docs/site/content/docs/model/quick-open.mdx)** — Search across worktrees, files, agents, commands, and repo context without leaving your flow.
- **[Account switcher &amp; usage tracking](docs/site/content/docs/agents/usage-tracking.mdx)** — See Claude and Codex usage from local session data, and hot-swap accounts without re-logging in.
- **[Rich repo previews](docs/site/content/docs/editing/markdown.mdx)** — Preview Markdown, images, PDFs, and repo docs in the workspace.
- **[Computer Use](docs/site/content/docs/cli/computer-use.mdx)** — Let agents operate desktop apps and visible UI when a workflow needs real interaction.
- **[Notifications and unread state](docs/site/content/docs/notifications.mdx)** — Know when an agent finishes or needs attention, then mark threads unread to come back later.
- **And many more** — upstream ships often, so this list lags. The [upstream changelog](https://github.com/stablyai/orca/releases) is the full feature list; features that need a cloud service are removed in this fork.

---

## Supported Agents

Works with **any CLI agent** — if it runs in a terminal, it runs in Orca.

<p>
  <a href="https://docs.anthropic.com/claude/docs/claude-code"><kbd><img src="docs/assets/claude-logo.svg" alt="Claude Code logo" width="16" valign="middle" /> Claude Code</kbd></a> &nbsp;
  <a href="https://github.com/openai/codex"><kbd><img src="https://www.google.com/s2/favicons?domain=openai.com&sz=64" alt="Codex logo" width="16" valign="middle" /> Codex</kbd></a> &nbsp;
  <a href="https://x.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=x.ai&sz=64" alt="Grok logo" width="16" valign="middle" /> Grok</kbd></a> &nbsp;
  <a href="https://cursor.com/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=cursor.com&sz=64" alt="Cursor logo" width="16" valign="middle" /> Cursor</kbd></a> &nbsp;
  <a href="https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=github.com&sz=64" alt="GitHub Copilot logo" width="16" valign="middle" /> GitHub Copilot</kbd></a> &nbsp;
  <a href="https://dev.meta.ai/docs/muse-code"><kbd><img src="src/shared/agent-icons/muse.png" alt="Muse logo" width="16" valign="middle" /> Muse</kbd></a> &nbsp;
  <a href="https://deepseek-harness.github.io/deepseek-harness/"><kbd><img src="src/shared/agent-icons/dsh.png" alt="DeepSeek Harness logo" width="16" valign="middle" /> DeepSeek Harness</kbd></a> &nbsp;
  <a href="https://zcode.z.ai/en/docs"><kbd><img src="src/shared/agent-icons/zcode.png" alt="ZCode logo" width="16" valign="middle" /> ZCode</kbd></a> &nbsp;
  <a href="https://opencode.ai/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=opencode.ai&sz=64" alt="OpenCode logo" width="16" valign="middle" /> OpenCode</kbd></a> &nbsp;
  <a href="https://mimo.xiaomi.com/coder"><kbd><img src="https://www.google.com/s2/favicons?domain=mimo.xiaomi.com&sz=64" alt="MiMo Code logo" width="16" valign="middle" /> MiMo Code</kbd></a> &nbsp;
  <a href="https://ampcode.com/manual#install"><kbd><img src="https://www.google.com/s2/favicons?domain=ampcode.com&sz=64" alt="Amp logo" width="16" valign="middle" /> Amp</kbd></a> &nbsp;
  <a href="https://openclaude.gitlawb.com/"><kbd><img src="resources/openclaude-logo.png" alt="OpenClaude logo" width="16" valign="middle" /> OpenClaude</kbd></a> &nbsp;
  <a href="https://antigravity.google/docs/cli-overview"><kbd><img src="https://www.google.com/s2/favicons?domain=antigravity.google&sz=64" alt="Antigravity logo" width="16" valign="middle" /> Antigravity</kbd></a> &nbsp;
  <a href="https://pi.dev"><kbd><img src="https://pi.dev/favicon.svg" alt="Pi logo" width="16" valign="middle" /> Pi</kbd></a> &nbsp;
  <a href="https://omp.sh"><kbd><img src="https://omp.sh/favicon.svg" alt="oh-my-pi logo" width="16" valign="middle" /> oh-my-pi</kbd></a> &nbsp;
  <a href="https://hermes-agent.nousresearch.com/docs/"><kbd><img src="https://www.google.com/s2/favicons?domain=nousresearch.com&sz=64" alt="Hermes Agent logo" width="16" valign="middle" /> Hermes Agent</kbd></a> &nbsp;
  <a href="https://devin.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=devin.ai&sz=64" alt="Devin logo" width="16" valign="middle" /> Devin</kbd></a> &nbsp;
  <a href="https://block.github.io/goose/docs/quickstart/"><kbd><img src="https://www.google.com/s2/favicons?domain=goose-docs.ai&sz=64" alt="Goose logo" width="16" valign="middle" /> Goose</kbd></a> &nbsp;
  <a href="https://docs.augmentcode.com/cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=augmentcode.com&sz=64" alt="Auggie logo" width="16" valign="middle" /> Auggie</kbd></a> &nbsp;
  <a href="https://github.com/autohandai/code-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=autohand.ai&sz=64" alt="Autohand Code logo" width="16" valign="middle" /> Autohand Code</kbd></a> &nbsp;
  <a href="https://github.com/charmbracelet/crush"><kbd><img src="https://www.google.com/s2/favicons?domain=charm.sh&sz=64" alt="Charm logo" width="16" valign="middle" /> Charm</kbd></a> &nbsp;
  <a href="https://docs.cline.bot/cline-cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=cline.bot&sz=64" alt="Cline logo" width="16" valign="middle" /> Cline</kbd></a> &nbsp;
  <a href="https://www.codebuddy.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=codebuddy.ai&sz=64" alt="CodeBuddy logo" width="16" valign="middle" /> CodeBuddy</kbd></a> &nbsp;
  <a href="https://www.codebuff.com/docs/help/quick-start"><kbd><img src="https://www.google.com/s2/favicons?domain=codebuff.com&sz=64" alt="Codebuff logo" width="16" valign="middle" /> Codebuff</kbd></a> &nbsp;
  <a href="https://freebuff.com"><kbd><img src="src/shared/agent-icons/freebuff.png" alt="Freebuff logo" width="16" valign="middle" /> Freebuff</kbd></a> &nbsp;
  <a href="https://commandcode.ai/docs/quickstart"><kbd><img src="https://www.google.com/s2/favicons?domain=commandcode.ai&sz=64" alt="Command Code logo" width="16" valign="middle" /> Command Code</kbd></a> &nbsp;
  <a href="https://docs.continue.dev/guides/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=continue.dev&sz=64" alt="Continue logo" width="16" valign="middle" /> Continue</kbd></a> &nbsp;
  <a href="https://docs.factory.ai/cli/getting-started/quickstart"><kbd><img src="docs/assets/droid-logo.svg" alt="Droid logo" width="16" valign="middle" /> Droid</kbd></a> &nbsp;
  <a href="https://kilo.ai/docs/cli"><kbd><img src="https://raw.githubusercontent.com/Kilo-Org/kilocode/main/packages/kilo-vscode/assets/icons/kilo-light.svg" alt="Kilocode logo" width="16" valign="middle" /> Kilocode</kbd></a> &nbsp;
  <a href="https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html"><kbd><img src="https://www.google.com/s2/favicons?domain=moonshot.cn&sz=64" alt="Kimi logo" width="16" valign="middle" /> Kimi</kbd></a> &nbsp;
  <a href="https://kiro.dev/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=kiro.dev&sz=64" alt="Kiro logo" width="16" valign="middle" /> Kiro</kbd></a> &nbsp;
  <a href="https://github.com/mistralai/mistral-vibe"><kbd><img src="https://www.google.com/s2/favicons?domain=mistral.ai&sz=64" alt="Mistral Vibe logo" width="16" valign="middle" /> Mistral Vibe</kbd></a> &nbsp;
  <a href="https://github.com/QwenLM/qwen-code"><kbd><img src="https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=64" alt="Qwen Code logo" width="16" valign="middle" /> Qwen Code</kbd></a> &nbsp;
  <a href="https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/"><kbd><img src="https://www.google.com/s2/favicons?domain=atlassian.com&sz=64" alt="Rovo Dev logo" width="16" valign="middle" /> Rovo Dev</kbd></a> &nbsp;
  <kbd>+ any CLI agent</kbd>
</p>

---

## What this fork changed

Compared with upstream Orca, this fork **removes** everything that let Orca's own code reach the cloud, or let anything on the network reach Orca:

| Area                     | Removed                                                                                                                                                                                                           | Kept                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Telemetry and support    | PostHog upload; feedback, crash-report and diagnostics upload; the GitHub star prompt                                                                                                                             | A local, consent-gated usage record (`telemetry.ndjson`); local crash capture and "copy report"                           |
| Updates and distribution | The auto-updater, release channels, the publish config and Homebrew casks                                                                                                                                         | Signed macOS releases on GitHub (no updater); building from source                                                        |
| Accounts and sharing     | Orca Cloud sign-in and profile sync; skill and artifact share links; the `orca://` deep links; `npx skills` registry installs; the plugin marketplace seed and kill list                                          | Local profiles, local skills and local plugins                                                                            |
| Mobile and remote access | The Orca Mobile app, its relay and push service; the runtime WebSocket listener; the browser web client; pairing; `orca serve` network mode                                                                       | `orca serve` as a local headless runtime, reached by the `orca` CLI over a local socket                                   |
| Remote execution         | SSH remotes, the SSH relay, remote Orca runtime environments, orcad, ephemeral VMs and VM recipes, the skill-transfer rails and pinned Node downloads                                                             | Local and WSL execution; `git` over SSH to your own remotes through your own git client                                   |
| Integrations             | GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Jira and Linear API integrations (PR/issue panels, the Tasks view, `gh`/`glab`), vendor usage and quota polling, Claude OAuth refresh, OpenAI cloud transcription | Local diff and source control, AI commit messages, local Claude usage from statusline posts, and on-device speech-to-text |
| Renderer                 | Remote favicon and avatar loads                                                                                                                                                                                   | A strict Content-Security-Policy on app windows; the embedded browser pane is unrestricted by design                      |

Old profiles upgrade cleanly. SSH and remote-runtime projects, tabs and leases are dropped when the profile loads, and no local data is lost. A guard script (`pnpm run check:local-only`, part of `pnpm lint`) fails the build if a cloud host, cloud SDK, publish block, deep-link protocol, wildcard bind or `ssh2`/`tweetnacl` value import comes back.

More detail:

- What changed and the before/after test and security results: [Spec A summary](docs/local-only/2026-10-01-spec-a-change-summary.md) (cloud, mobile, telemetry, updater, integrations) and [Spec B summary](docs/local-only/2026-10-02-spec-b-change-summary.md) (SSH, remote runtimes, orcad, VMs).
- The invariants, the sockets that remain, and the few places that still reach the network: [local-only architecture](docs/reference/local-only-architecture.md).
- An index of all fork docs: [docs/local-only/README.md](docs/local-only/README.md).

---

## Download

Signed and notarized macOS builds are on the [Releases page](https://github.com/abhijitbansal/orca-local/releases/latest). Download `orca-local-macos-arm64.dmg` for an Apple Silicon (M-series) Mac, or `orca-local-macos-x64.dmg` for an Intel Mac. Open the DMG and drag **Orca Local** to Applications. There is no auto-update, so download a new release to upgrade. Linux and Windows users build from source, as described below.

Each push to `main` publishes a release through [`.github/workflows/orca-local-release.yml`](.github/workflows/orca-local-release.yml). The workflow builds, signs and notarizes the app, then attaches both DMGs, a `SHA256SUMS.txt` and notes listing the commits since the previous release. It needs five repository secrets, listed at the top of the workflow file. Until all five are set, it skips the build.

## Build from source

This fork has no Homebrew cask and no auto-update. Linux and Windows builds always come from source.

**Prerequisites**

- Node.js 24 (`node -v`).
- pnpm 12, which is pinned in `package.json`. Enable it with `corepack enable`. If corepack cannot fetch pnpm 12, run every `pnpm` command below as `npx -y pnpm@12.0.0 …`.
- macOS: Xcode Command Line Tools (`xcode-select --install`), because the build compiles small Swift helpers.
- Linux and Windows: the native build toolchain listed in [CONTRIBUTING.md](.github/CONTRIBUTING.md).

**Run from source (no packaging)**

```bash
pnpm install
pnpm dev
```

**Package an installable app**

```bash
# macOS: produces dist/orca-macos-arm64.dmg and dist/orca-macos-x64.dmg (plus .zip)
pnpm install:release      # installs native modules for both CPU architectures
pnpm build:mac

# Linux: produces dist/orca-linux.AppImage, plus .deb and .rpm
pnpm install
pnpm build:linux

# Windows: produces dist/orca-windows-setup.exe
pnpm install
pnpm build:win
```

**App identity.** The packaged app is **Orca Local** (`Orca Local.app`, bundle id `com.abhijitbansal.orca-local`). Its profile lives in `~/Library/Application Support/orca-local` (`%APPDATA%\orca-local` on Windows, `~/.config/orca-local` on Linux). That keeps it apart from upstream Orca, which uses `com.stablyai.orca` and the `orca` folder. The two apps can be installed side by side. They never share a profile, macOS permission grants, the Keychain item, the Windows daemon host (`%LOCALAPPDATA%\Orca Local`) or the Linux package (`orca-local`, installed to `/opt/Orca Local`).

Some state is still shared with upstream Orca:

- the agent hook scripts and the MiniMax stores in `~/.orca`
- the WSL-side state in `~/.local/share/orca`
- the `orca` shell command (`/usr/local/bin/orca`). Installing the CLI from either app takes the command over.
- the `/usr/bin/orca-ide` link on Linux
- the `Orca.exe` process name on Windows. Uninstalling the fork stops running `Orca.exe` processes, including upstream's.
- the `orca-dev` profile used by `pnpm dev`. Dev builds now encrypt with an `Orca Local Dev Safe Storage` Keychain item. Secrets already saved in `orca-dev` under the old `Orca Dev` key cannot be decrypted, so enter them again once.

**Moving from an earlier build of this fork.** Builds before this change used upstream's identity and the `orca` profile folder. To keep your projects and settings, copy the old profile once, before you first launch Orca Local. If `orca-local` already exists, `cp` nests the copy inside it instead of replacing it. Quit both apps first:

```bash
cp -R ~/Library/Application\ Support/orca ~/Library/Application\ Support/orca-local
```

Only do this if no upstream Orca install uses that folder. Grant macOS permissions again on first launch.

**Signed and notarized macOS builds (for sharing).** Use this build when you send the DMG to other people. It opens without a Gatekeeper warning, and permission grants survive updates.

1. Once only, create a **Developer ID Application** certificate. Only the Apple Developer account holder can do this, and the App Store Connect API key is refused. In Xcode, go to Settings → Accounts, select your team, choose Manage Certificates, then click **+** → **Developer ID Application**. An "Apple Distribution" certificate does not work, because it is for the App Store only.
2. Put the App Store Connect API key in `~/.app-store-connect/`: the `AuthKey_<KEY_ID>.p8` file, plus a `config` file containing `KEY_ID=` and `ISSUER_ID=` lines.
3. Build:

   ```bash
   pnpm install:release
   pnpm build:mac:release:local
   ```

The script finds the Developer ID certificate in your keychain and passes it to electron-builder and `codesign` by its SHA-1 hash. Passing the hash avoids the "ambiguous identity" failure that duplicate certificates cause. The script then notarizes the app with the API key. After that it signs, notarizes and staples each `dist/orca-macos-*.dmg`, so the DMG passes Gatekeeper when it is mounted as well as when the app opens. If a notarization request fails partway through, run `node config/scripts/build-mac-release-local.mjs --dmg-only` to repeat only the DMG step. To pick a specific certificate, set `CSC_NAME=<sha1>`. To keep the key somewhere else, set `ORCA_ASC_DIR`.

**Unsigned macOS builds.** Without a Developer ID certificate, build unsigned:

```bash
ORCA_COMPUTER_MACOS_SIGN_IDENTITY=- CSC_IDENTITY_AUTO_DISCOVERY=false pnpm build:mac
```

This build is fine for your own Mac. A recipient who downloads it sees "Apple could not verify…". They can open it through System Settings → Privacy & Security → **Open Anyway**, or by running `xattr -dr com.apple.quarantine "/Applications/Orca Local.app"`. Each new build also makes them grant permissions again. You also need these variables if your keychain holds duplicate "Apple Development" certificates, which make `codesign` fail with "ambiguous".

**The `orca` CLI.** The packaged app installs it from Settings → General → CLI. From a source checkout, run `pnpm build:cli`, then `node out/cli/index.js status`.

**Verify a build.** Before you rely on a build, run:

```bash
pnpm tc && pnpm test && pnpm lint   # lint includes the local-only guard
```

---

## Updating from upstream

Updates arrive by merging upstream and rebuilding:

```bash
git remote add upstream https://github.com/stablyai/orca.git   # once
git fetch upstream
git merge upstream/main
pnpm install
pnpm tc && pnpm run check:local-only && pnpm test
```

If a merge reintroduces a removed feature, `check:local-only` names the exact file and line. Resolve modify/delete conflicts on removed files with `git rm`. The per-file conflict playbook is in [local-only-upstream-sync.md](docs/reference/local-only-upstream-sync.md).

The documentation under `docs/site/content/docs/` is upstream's docs site. This fork does not publish it; read the pages in the repo.

---

## Privacy

Orca's own code makes no connection to a cloud service, apart from the exceptions listed in [the architecture notes](docs/reference/local-only-architecture.md): your git CLI against your own remotes, the embedded browser pane, links handed to your OS browser, and speech-model and scrcpy downloads you start yourself. A local usage record is on by default for new installs: validated product events are appended to `telemetry.ndjson` under the app's `logs` folder, size-capped and never uploaded. Turn it off in Settings → Privacy, or launch with `ORCA_TELEMETRY_DISABLED=1`. See [Privacy & telemetry](docs/site/content/docs/telemetry.mdx). The agent CLIs you run in Orca (Claude Code, Codex, ...) talk to their own vendors; that traffic is theirs.

---

## Developing

Want to contribute or run locally? See [CONTRIBUTING.md](.github/CONTRIBUTING.md), and run `pnpm run check:local-only` before opening a change. Upstream: [stablyai/orca](https://github.com/stablyai/orca).

## License

Orca is free and open source under the [MIT License](LICENSE).

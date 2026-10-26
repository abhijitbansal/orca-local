# Local-only fork

This fork runs entirely on the local machine: no cloud accounts, no mobile app, no auto-update, no telemetry upload, no network listener. Telemetry is written to a local file only. Before adding anything that opens a network connection, binds a socket, or reads a cloud service, read [`docs/reference/local-only-architecture.md`](./docs/reference/local-only-architecture.md) (invariants, remaining listeners, egress exceptions). `pnpm run check:local-only` enforces it (rules in `config/scripts/check-local-only.mjs`, exemptions in `config/local-only-allowlist.txt`) and runs in `pnpm lint`; do not widen the allowlist to make a new cloud call pass. Merging a new upstream release follows [`docs/reference/local-only-upstream-sync.md`](./docs/reference/local-only-upstream-sync.md). SSH remotes, remote runtimes, orcad and ephemeral VMs are removed; WSL stays. A legacy `ssh:`/`runtime:` host id reaching a seam fails closed with a typed "unsupported in this build" error and never falls back to local.

# Design System

All UI work — layout, color, typography, spacing, component selection, UX behavior — must follow [`docs/STYLEGUIDE.md`](./docs/STYLEGUIDE.md). Use the tokens defined in `src/renderer/src/assets/main.css` (the canonical source) and the shadcn primitives in `src/renderer/src/components/ui/`. Don't invent new color values, font sizes, or shadow tiers when a documented one already covers the role. When STYLEGUIDE.md is silent, follow the resolution order in its final section.

# Electron UI Validation

Always run tests and agent-launched apps in the background with `ORCA_BACKGROUND_LAUNCH=1`.
Never steal monitor focus or reveal test windows: no `show()`, `showInactive()`, `bringToFront()`,
`app.focus()`, or OS activation. Use CDP screenshots of hidden renderers. Keep native-focus and visible-window tests paused on the user's desktop; run them on an isolated display or CI.
Rebuild modified launch-policy code before running an app; stale build wrappers are not safe.

Use the `$electron` skill and Playwright CDP for rendered Orca UI checks. Do not use computer-use for Orca UI validation.

# Code Style

## Reuse Before Reimplementing

Before writing new logic at any scale — a function, component, IPC channel, state store, or whole subsystem/flow — check whether an existing implementation already does the job. Extend or generalize it instead of building a parallel version.

## Avoid Comments

## Lint Rules: Do Not Disable Max Lines

NEVER add a `max-lines` disable (`eslint-disable max-lines`, `oxlint-disable max-lines`, or line-specific variants).

## File and Module Naming

Never use vague names like `helpers`, `utils`, `common`, `misc`, or `shared-stuff` for files, folders, or modules. They carry zero info and tend to become dumping grounds. Name files after what they _actually_ contain — prefer the concrete domain concept (e.g. `tab-group-state.ts`, `terminal-orphan-cleanup.ts`) over the generic role (`tabs-helpers.ts`, `terminal-utils.ts`). If you find yourself reaching for `helpers`, the file probably has more than one responsibility and should be split, or there's a better name hiding in the code that describes what the functions operate on.

## Type Assertions: Prefer Checked Types

Avoid type assertions except `as const`. Unavoidable casts need a line-specific `SAFETY:` explanation:

# First Class Citizens

Every change must consider these areas:

## Cross-Platform Support

Orca targets macOS, Linux, and Windows. All code, commands, and scripts must be compatible with macOS, Linux, and Windows. Keep all platform-dependent behavior behind runtime checks:

- **Keyboard shortcuts**: Never hardcode `e.metaKey`. Use a platform check (`navigator.userAgent.includes('Mac')`) to pick `metaKey` on Mac and `ctrlKey` on Linux/Windows. Electron menu accelerators should use `CmdOrCtrl`.
- **Shortcut labels in UI**: Display `⌘` / `⇧` on Mac and `Ctrl+` / `Shift+` on other platforms.
- **File paths**: Use `path.join` or Electron/Node path utilities — never assume `/` or `\`.
- **Windows terminal shells**: `--shell` picks the shell a terminal _is_; `--command` is typed into whatever shell the host spawned, so a shell choice routed through `command` silently becomes a child process.
- **Windows setup scripts**: the setup/issue-command runner is a `.cmd` batch file unless the script starts with a `#!` line — never derive that from the user's terminal-shell preference, and never launch a `.cmd` runner with a bare `cmd.exe /c` from a Git Bash pane (MSYS rewrites the `/c`).
- **Windows child processes**: start them through `runProcess`/`spawnProcess` from `@orca/process-host` — never `child_process` directly. It pins `windowsHide`, refuses `shell: true`, and encodes `.cmd`/`.bat` arguments so neither `CommandLineToArgvW` nor `cmd.exe` mangles them. Recognised npm/pnpm `.cmd` shims are resolved to their real target so the spawn skips `cmd.exe` entirely.
- **Ripgrep**: Orca bundles `rg` for every platform and WSL. Spawn it through `spawnBundledRipgrep` (main) or `resolveRelayRipgrepCommand` (relay), never a bare `'rg'` — Windows resolves a bare name in the spawn cwd before PATH. Don't add git/readdir fallbacks locally; the WSL relay's chain exists only for distros an upload never reached.
- **Windows process enumeration**: read the table through `src/main/windows/windows-process-table.ts`, never by forking `powershell.exe`.
- **Windows MSYS/Git Bash panes**: their children break away from the per-PTY job unless it is created without `JOB_OBJECT_LIMIT_BREAKAWAY_OK`, and a `conpty.node` built before that fix passes every existing gate.
- **Windows daemon-host relocation**: the terminal daemon runs from a copy of the app runtime under `%LOCALAPPDATA%`, which is what survives an auto-update.
- **macOS daemon launch**: packaged macOS runs the terminal daemon from a copy of the signed terminal host helper through launchd, so an update cannot sever its privacy grants. Before touching that copy, its cleanup, or the fork fallback, read [`docs/reference/macos-daemon-tcc-attribution.md`](./docs/reference/macos-daemon-tcc-attribution.md).
- **Windows EDR signal**: don't add `-ExecutionPolicy Bypass`, `-EncodedCommand`, `cmd.exe /c` with escaped free text, per-operation interpreter spawning, or runtime `Add-Type` compilation without reviewing the EDR impact first — behavioural EDR scores each of those, and being signed does not clear them.
- **WSL commands**: build argv with `buildWslExecArgs` (always `--exec` — under `--`, `wsl.exe` expands `$name` in every argument and silently rewrites the script), and fence anything whose stdout you parse with `buildWslCapturedLoginShellCommand`, because the interactive login shell prints the distro banner to stdout.
- **Linux native modules**: keep the glibc floor at Ubuntu 20.04 / glibc 2.31. A module compiled from source on a newer runner can reference symbol versions absent on the floor and crash the app on startup. Packaging fails if a bundled native binary needs newer glibc.

Support remote execution as well as local. Clients and servers update independently; preserve compatibility across mixed versions.

## Mobile

## Folder Workspace Use Case

All changes must consider folder workspaces as well as git worktrees. Don't assume every workspace is a git worktree.

## Execution Verdicts

Anything that reports on, stops, or lists work running outside the current process (PTYs, the terminal daemon, WSL distros) uses one vocabulary: `live` / `unverifiable` / `exited`, with no synonyms. Loss of contact is never evidence of process death or absence: only the process's owner can say `exited`, so anything else is `unverifiable`, and `unverifiable` never authorizes a kill, delete, respawn or release. Examples: `src/main/worktree-removal-safety.ts`, `src/renderer/src/store/terminals/terminal-disowned-pty-sources.ts`.

## Agent Status

The execution host owns agent status in one store, the hook server's, and every reader (sidebar, `worktree ps`, dashboard) subscribes to it. New producers write into that store, and readers keep only presentation policy.

## Agent Terminal Screens

A rule that reads what an agent CLI paints on a terminal — readiness, blocked prompts, idle — must be written against a captured transcript, not a remembered screen. Use `config/scripts/capture-agent-pty-transcript.mjs` to keep escapes and wrapping intact and scrub account identifiers before they reach git.

## Git Binary Compatibility

Orca runs the user's Git binary on native and WSL hosts, which may have different versions. Treat Git 2.25 as the core-workflow baseline.

When adding or changing a Git command:

- Check when every subcommand and option was introduced. For newer behavior, keep a baseline-compatible fallback or degrade safely.
- Use `GitCapabilityCache` with a narrow unsupported-error predicate so recurring operations do not retry a known-invalid command. Do not rely only on `git --version`; wrappers such as `simple-git` do not remove host-version differences.
- Scope capability state to the host that executes Git: native or WSL distro. Cover the first fallback, later cached calls, concurrent probes, and relevant host isolation in tests.
- Keep the real-binary compatibility contract in PR CI current. When adopting a newer Git feature, add its version boundary so the preferred command and fallback both run against representative Git releases.
- Preserve commands that begin with global Git options such as `-c` before the subcommand, including auto-maintenance suppression used by worktree-create fetches.

## Git Scan Safety

- Never enumerate every ref and then run `git ls-tree -r` or `git show` once per ref. That ref × tree fan-out can retain gigabytes of output before a downstream `sort -u` or search can make progress.
- Prefer `rg` over the checked-out files for source searches. For history or refs, use a named ref, an explicit namespace/path, `--max-count`, and a bounded output; do not use an unqualified `--all` scan as a first diagnostic.
- Keep repository-wide commands targeted to the current repository and worktree. If an unbounded scan is genuinely required, measure the ref count first, explain the cost, and get confirmation before running it.

## Git Providers

Provider API integrations (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Jira, Linear) and the `gh`/`glab` runners are removed in this fork. Source control goes through the git CLI (fetch, push, clone against the user's own remotes, whichever host serves them). Do not reintroduce a provider API call; see the local-only architecture doc above.

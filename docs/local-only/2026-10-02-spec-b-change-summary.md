# Local-only Orca, Spec B: change summary

Branch: `local-only/spec-b`, 48 commits on top of `local-only/spec-a` including this summary. Spec A plus Spec B add up to 133 commits on top of `main` at `449b8ca17d`.
Spec: [`2026-10-02-local-only-spec-b-design.md`](./2026-10-02-local-only-spec-b-design.md) · Plan: [`2026-10-02-local-only-spec-b-plan.md`](./2026-10-02-local-only-spec-b-plan.md) · Spec A summary: [`2026-10-01-spec-a-change-summary.md`](./2026-10-01-spec-a-change-summary.md)
Architecture: [`docs/reference/local-only-architecture.md`](../reference/local-only-architecture.md) · Upstream sync: [`docs/reference/local-only-upstream-sync.md`](../reference/local-only-upstream-sync.md)

## Outcome

With Spec B on top of Spec A, the fork is local-only. Orca's own code reaches only loopback, plus the exceptions you chose to keep:

- your git CLI against your own remotes
- the embedded browser pane, unrestricted
- `openExternal` links, which open in your OS browser
- speech-model and scrcpy downloads that you start yourself

Nothing on the network can reach Orca. The agent CLIs that Orca launches still talk to their vendors themselves, which is out of scope.

Spec B removed:

- SSH remotes: connections, the relay deploy, the SSH relay daemon, port forwarding and SOCKS tunnels, SSH PTY/file/git providers, the UI, the CLI, CI and the e2e suites. The `ssh2` runtime dependency is gone.
- Remote runtime environments: the pairing client, E2EE (`tweetnacl`), the CLI remote dial, `orca environment`, the Remote Orca Servers UI, the paired-runtime browser, and orchestration federation.
- orcad, the serve-update handoff, and the `orca serve` VM-recipe flags (`orca serve` itself stays as a local headless runtime).
- Ephemeral VMs, VM recipes and the `orca vm` CLI.
- Skill-transfer rails (`storage.googleapis.com`), pinned Node runtime downloads (`nodejs.org`), and the WSL OpenCode vault reader.

Profiles from older or upstream builds load cleanly. SSH and remote-runtime repos, worktrees, sessions, leases and targets are stripped at load and never probed as local paths.

## Your Spec B decisions

| Topic | Decision |
|---|---|
| Depth | Remove the capability; keep the `ssh`/`runtime` members of the execution-host types as inert values. This keeps upstream merges far smaller. |
| WSL OpenCode vault reader (nodejs.org download) | Removed |
| Old SSH and remote data in profiles | Dropped at load |
| `orca serve` | Kept for local headless use |

## What changed

| Unit | What | Commits |
|---|---|---|
| B0 guard | Forbids non-type `ssh2`, `ssh2-*` and `tweetnacl` imports and the `nodejs.org/dist` and `storage.googleapis.com` hosts. Allowlist rows can name a single matched value. Any allowlist row whose file no longer exists now fails the guard. | e65c674d53, 9969991df4 |
| B1 VMs | Ephemeral VM UI, runtimes, recipes, the `orca vm` CLI and the serve recipe rail | 24d19e54a3 … 296633a1aa |
| B2/B3 | Serve-update handoff supervisor; the orcad runtime, its build pipeline and CI | 5657b13d8d, b66c9cf1f0 |
| B4 | WSL OpenCode reader and pinned Node download; the skill-transfer RPC family and rails | ccd82a7f2a, 9a8b9d3251 |
| B5 remote runtimes | CLI remote dial, Remote Servers UI, paired-runtime browser, federation, environment IPC, the shared client stack, pairing codec and E2EE | fc7e596584 … d3404c2483 |
| B7 hydration | Explicit strip of ssh/runtime persisted state at profile load, plus the repair of the persistence suite | 8e0c30eeb8, 185151e798, 5d822924e3, ef96d6040d |
| B6 SSH, main side | SSH relay down to the WSL relays only; registries stubbed to return `undefined`; connections, providers, IPC/RPC and tunnels removed; `ssh2` dependency removed | d5498899b9, 7e59be5328, 1a267eb1c6 |
| B6 SSH, UI/CLI/CI | Renderer reconnect and sync, settings/status/ports/overlays, sidebar host flows, the remote file browser, preload bridges, locales, the CLI, e2e and CI | 8561a32f58 … 578b854283 |
| Cleanup | Dead SSH git provider chain and file-stream readers, the last orcad files, stale locale keys and comments | 93b8e05c81, 61b90179e9, af52ced11e, f2056e2ae1 |
| Docs | AGENTS.md (SSH Use Case and Remote Wire sections removed; an "Execution Verdicts" rule added), docs-site SSH/orcad/remote pages, README privacy text, and the architecture and upstream-sync guides corrected to the final tree | 948cdcd800, 94afd95a01, 580bdf1c89, 6ef04930f7 |

Spec B diff against Spec A: 2,885 files changed, 7,320 insertions, 395,012 deletions. That includes `src/main` (−185K), `src/renderer` (−78K), `src/relay` (−67K) and `config` (−21K). The cumulative diff against `main` is 10,698 files, +17K and −2.12M lines.

## Before and after

All logs are in `notes/local-only/{before,after,after-b}/`, which is gitignored.

| Check | `main` | After Spec A | After Spec B |
|---|---|---|---|
| `pnpm tc` | pass | pass | pass |
| Failing test files | 24 | 13 | 12. The only one not in the baseline is `worktree-git-common-watch.test.ts`: this branch never touched it, and it passes 3/3 in isolation, so it is flaky under full-suite load. |
| `pnpm lint` (includes the guard) | pass | pass | pass |
| `typecheck:e2e` errors (not part of `tc`) | 276 | 166 | 153 |
| `check:local-only` | 151 violations | clean | clean, and no "Spec B" allowlist rows remain |
| gitleaks (git-tracked files) | 182 | 113 | 104, with 0 new findings |
| Cloud-host URL lines (`src`, `config`, `package.json`) | 163 (103 in `src`) | 106 (49 in `src`) | 100 (45 in `src`). Every `src` hit is an allowlisted link-out, a display string or a fixture |
| Listener/bind grep lines | 561 | 520 | 407 |
| Value imports of `posthog`, `electron-updater`, `@octokit`, `ssh2` or `tweetnacl` | 20+ files | 0 | 0. The `ssh2` hits left in 24 hook-installer files are `import type { SFTPWrapper }` only, which the guard exempts |
| `pnpm audit` | 0 critical / 9 high (Oct 1) | same | 1 critical / 12 high. **`main`'s lockfile audited the same day shows exactly the same counts**, so these are advisories published after Oct 1, not something these branches introduced. They are all third-party transitive dependencies: `proxy-addr` via express via the MCP SDK in `@anthropic-ai/claude-agent-sdk`, and `undici`, `brace-expansion`, `braces` and `source-map-js` via build and dev tooling. Fix them upstream by bumping dependencies. |

### Runtime and packaging acceptance

- **Clean `pnpm build:mac`.** Run with `rm -rf out dist`, then `ORCA_COMPUTER_MACOS_SIGN_IDENTITY=- CSC_IDENTITY_AUTO_DISCOVERY=false pnpm build:mac`. It succeeds and produces arm64 and x64 DMGs. The bundle's `Resources/relay/` contains only `wsl/wsl-agent-hook-relay.js` and `wsl/wsl-browser-network-relay.js`: no SSH relay and no orcad. `app.asar` contains no `ssh2`, `tweetnacl` or orcad code.
- **`orca serve` (headless), isolated profile:** it prints "Orca server ready" with no network listener, and `orca status` reports the runtime `ready` and reachable over the Unix socket. The serve process's only socket is a `127.0.0.1` loopback helper.
- **Hidden launch with an isolated profile.** `lsof` across the whole process tree shows only `127.0.0.1` sockets: two belong to Playwright's debug ports and one is Orca's loopback helper. CSP probes pass: blob workers and wasm work, a remote `fetch` is blocked, and there are no page errors. `orca status --json` over the Unix socket returns `ok: true`.

## Behaviour changes you will notice (in addition to Spec A's)

- There is no SSH host support anywhere. The CLI refuses `ssh:` hosts with an "unsupported in this build" error. `git` over SSH to your own remotes, using your own git and `GIT_SSH_COMMAND`, still works.
- There are no Remote Orca Servers, no paired runtimes, no `orca environment` and no cross-machine orchestration.
- There are no Cloud VMs or VM recipes, and no `orca vm`. `orca serve` still runs a local headless Orca without the recipe flags.
- On Windows, AI Vault no longer reads OpenCode sessions stored inside WSL. The other WSL features (terminals, agent hooks, the browser network relay) are kept. That is verified by `build:relay` producing both WSL bundles and by unit tests, but not exercised on a Windows machine in this session. Use the Windows item in the checklist.
- On first launch after upgrading, SSH and remote-runtime projects and their tabs disappear from the profile. They were only pointers to remote paths, so no local data is lost.

## Known residuals

These are also listed in the architecture doc:

- **Inert SSH/runtime type plumbing** is kept on purpose for merge-friendliness. It covers the `ssh`/`runtime` members of the execution-host unions, the SSH registry stubs, and the `if (connectionId)` branches that can no longer receive a value. About 120 dormant non-test files still have SSH names, among them the IPC PTY lease pipeline, `persistence/leasing-ssh-ptys/*` and `loading-store/ssh-*`. Their write paths are now unreachable, and the load-time strip removes anything they would persist. They were not deleted, because deleting them means editing about 20 kept hot files. A later optional cleanup could narrow the unions.
- **WSL transport files** that stay in `src/main/ssh`: `relay-protocol`, `ssh-channel-multiplexer` and `ssh-multiplexer-*`, used by the WSL hook relay. Some identity/persistence helpers also stay there. `@types/ssh2` stays as a devDependency for `SFTPWrapper` types.
- **Process notes.**
  - B7.2 briefly removed the at-rest encryption of SSH lease records while SSH writes were still possible. The reviewer caught it and it was restored in the next commit (`5d822924e3`), so no released state was affected.
  - Implementer commits carry `Co-Authored-By: Claude Sonnet 5.5`.
  - A stray local branch `backup-y3-tmp` from Spec A still needs `git branch -D backup-y3-tmp`.
- **Profile created outside the repo.** An earlier, non-isolated `orca serve` probe in this session launched the packaged Spec B app against your real `~/Library/Application Support/orca`. The directory existed since Oct 2 but held no profile. The probe created a fresh `profiles/local-default/profile-state.db` and set Orca's own app-scoped macOS default `com.stablyai.orca ApplePressAndHoldEnabled=0`, which Orca also sets on its own first launch. No existing data was there, so nothing was lost. To undo it, remove that directory and run `defaults delete com.stablyai.orca ApplePressAndHoldEnabled`.
- **Not done:** opening PRs. Both branches are pushed to your fork; merge `local-only/spec-a` and then `local-only/spec-b`, or merge `spec-b`, which contains both.

# Local-only Orca, Spec A: change summary

Branch: `local-only/spec-a` (83 commits on top of `main` at `449b8ca17d`, including this summary). Not pushed.
Spec: [`2026-10-01-local-only-spec-a-design.md`](./2026-10-01-local-only-spec-a-design.md) · Plan: [`2026-10-01-local-only-spec-a-plan.md`](./2026-10-01-local-only-spec-a-plan.md)
Architecture: [`docs/reference/local-only-architecture.md`](../reference/local-only-architecture.md) · Upstream sync: [`docs/reference/local-only-upstream-sync.md`](../reference/local-only-upstream-sync.md)

## Outcome

Orca's own code no longer talks to a cloud service, and nothing on the network can reach it:

- **No inbound path.** The runtime WebSocket listener, the paired web client, mobile pairing, the cloud relay, `orca serve` / `orcad` network mode and the `orca://` deep-link handler are gone. A runtime launch of the built app shows only `127.0.0.1` sockets (see "Runtime acceptance" below).
- **No Orca-initiated cloud egress.** The following are removed:
  - PostHog telemetry, feedback, crash-report and diagnostic uploads
  - the auto-updater and its release feed
  - Orca Cloud sign-in and profile sync
  - mobile push and relay
  - skill and artifact sharing, `npx skills` registry installs, and the plugin marketplace seed and kill list
  - vendor usage and quota polling, and the Claude OAuth refresh call
  - the GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Jira and Linear API integrations (including `gh`/`glab`)
  - OpenAI cloud transcription
  - remote favicon and avatar loads
- **Telemetry is local.** Validated, consent-gated events go to `<userData>/logs/telemetry.ndjson` (size-capped and rotated). Nothing reads that file over a socket.
- **Local functionality is kept.** That includes:
  - terminals, agents, worktrees and folder workspaces
  - the git CLI (fetch, push and clone against your own remotes)
  - the embedded browser pane (unrestricted, by your decision)
  - the Mobile Emulator dev tool and on-device speech, including model download
  - local usage stats from session files and local crash capture
  - WSL, and SSH (until Spec B)
- **Future updates.** Removals are mostly whole-file deletions. A guard script (`pnpm run check:local-only`) now runs as part of `pnpm lint` and names any cloud host, SDK, publish block, deep-link protocol or wildcard bind that an upstream merge brings back. The merge procedure and the per-file conflict playbook are in the upstream-sync doc.

## Your decisions (asked at the start)

| Topic | Decision |
|---|---|
| SSH remotes, remote runtimes, VMs | Remove, as a separate **Spec B** (not done yet) |
| Git | Keep the git CLI; remove provider API integrations |
| Fork strategy | Hard removal |
| Browser pane | Keep, unrestricted |
| Vendor usage polling and OAuth refresh | Remove |
| Speech-model and scrcpy downloads | Keep |
| `serve` / `orcad` network mode and web client | Remove |
| Staging | Spec A (this branch) first, Spec B after |

## What changed, by unit

| Unit | What | Commits |
|---|---|---|
| Guard | `config/scripts/check-local-only.mjs` plus tests, an allowlist with a justification per entry, and the guard wired into `pnpm lint` | 7b2e2ba404, 4db571bf8c, f0d2a965a6 |
| U12 cloud | `cloud/` workspace (relay and push backends, terraform), 26 cloud CI workflows, rollout-lease action, relay-region docs | 538888414a |
| U3 updater | electron-updater engine, nudge, changelog and build-list fetchers, updater IPC/RPC and menu, renderer update UI, release channels, `publish` block (now `publish: null`), `dev-app-update.yml`, Homebrew casks | c37d44604b … 5adf6cb72d |
| U7 network ingress | Web client, `serve`/`orcad` network flags, runtime WebSocket listener, pairing, E2EE, device registry, wide-bind paths | fc828ea521, 599d75ea86, e023007bb7 … 8c4e701865 |
| U6 mobile | `mobile/` app tree and CI, mobile web bundle RPC, mobile UI and IPC, push and relay startup | f30bd307d1 … f3c153885a, 3c42783fd8 |
| U1 telemetry | PostHog transport replaced by a local NDJSON sink, `posthog-node` removed, consent copy reworded | a503ffd291, e5e15306fb, 4ae1e4c905, 29547734d1 |
| U2 diagnostics | Feedback, crash-report submit and diagnostic-bundle upload (local capture and "copy report" kept) | 48b9053d7e, 0deb43feba |
| U4 star nag | GitHub star prompt service and all of its UI | bc0e0f3fe6, 92d475ea19 |
| U9 vendor polling | Usage fetchers replaced by a local holder fed by the statusline; Claude OAuth refresh and Codex reset-credit redemption removed | d9e3300801 … 901d71dc8e |
| U8 sharing | `npx skills` installs, plugin seed and kill list, skill and artifact cloud sharing, `orca://` protocol | 2c2c094297 … a60a7a5291 |
| U5 cloud account | Orca Cloud sign-in, PKCE callback, org members, cloud profile bridge | a415394b93 … c3679791b6 |
| U10 git providers | Renderer, preload, IPC, RPC and CLI surfaces and the provider libraries, `gh`/`glab` runners, hosted reviews, the `@linear/sdk` dependency, the `orca linear` CLI and the Linear skills | 8d66209008 … 17ff1e4c97, 658c54985e |
| U11 remote loads | Google favicon service and GitHub-avatar repo icons removed; strict CSP on app windows | b7b2c11673, 3f0af5979c, 9d9305ed05, a75f46fc46 |
| Cleanup | Review follow-ups, orphan-module deletion (~95 modules), locale pruning, CI wiring, e2e specs, Claude snapshot and usage-skeleton fixes, plugin legacy actions | fb0fb2a016 … 6911cf0f42, e82582d599 |
| Final egress | OpenAI cloud speech-to-text removed; `api.openai.com` added to the guard | 998db43328 |
| Docs | Architecture and upstream-sync guides, AGENTS.md "Local-only fork" section, README and 6 translations (build from source, privacy), docs-site pages trimmed | ba0f0af3f0, e6a16b3def, 3fc750cc35 |

Diff size: 8,039 files changed, 10,295 lines added, 1,723,391 lines deleted. Of the deletions, `mobile/` accounts for 990K lines and `cloud/` for 138K; `src/` lost about 504K lines.

## Before and after

All logs are under `notes/local-only/{before,after}/` (gitignored).

| Check | Before (`main`) | After (`local-only/spec-a`) |
|---|---|---|
| `pnpm tc` | pass | pass |
| `pnpm test`: failing test files | 24 (pre-existing, environment- or tag-dependent) | 13. **0 new**; 11 baseline failures went away with the code they covered |
| `pnpm lint` | pass | pass, now including `check:local-only` |
| `pnpm run typecheck:e2e` (not part of `tc`) | 276 errors | 166 errors, none new |
| `check:local-only` | 151 violations | **clean** |
| gitleaks, git-tracked files | 182 findings | 113 findings, **0 new**. The remaining hits are test fixtures, docs evidence and the `generic-api-key` heuristic; the Firebase key in `mobile/google-services.json` is gone with `mobile/` |
| `pnpm audit` | 0 critical / 9 high / 14 moderate / 5 low | unchanged. These are third-party dependency advisories, not touched by this work |
| Cloud-host URLs in `src`, `config` and `package.json` | 163 lines in 60 files (onorca 35, posthog 1, api.github 19, openai 10) | 106 lines in 31 files (onorca 21, posthog 0, api.github 17, openai 9). Every remaining `src/` hit is allowlisted (link-out, display string or fixture); `config/` hits are upstream-only release scripts |
| Forbidden imports (`posthog-node`, `electron-updater`, `@octokit`) | 20 files | 0 |
| Listener/bind lines | 561 | 520, no new listeners |

### Runtime acceptance

The app was built and launched hidden (`ORCA_BACKGROUND_LAUNCH=1`) with an isolated profile and home. The probe script is `notes/local-only/after/runtime-check.mjs`. Results:

- `lsof` on the whole process tree shows only `127.0.0.1` LISTEN and ESTABLISHED sockets. Two belong to Playwright's debug ports and one is Orca's loopback helper. There are no wildcard or non-loopback sockets.
- The CSP is present. Blob workers and WebAssembly work, a renderer `fetch('https://example.com')` is blocked, and there are no page errors.
- `orca status --json` over the local Unix socket returns `ok: true`, with the runtime `ready` and `connected`, so the CLI works without the WebSocket listener.

## Behaviour changes you will notice

- **Updates.** There is no in-app update. To update, merge upstream and rebuild from source (`pnpm install:release`, then `pnpm build:mac`, or `build:linux` / `build:win`).
- **Usage meters.** Only Claude shows usage, fed by live statusline posts; other providers show no data. Claude shows "no data" until the first post arrives.
- **Managed Claude accounts.** Orca no longer refreshes their OAuth tokens. The Claude CLI refreshes its own token.
- **Provider integrations.** There are no PR/MR or issue panels, no Tasks view, and no PR grouping. Old persisted `tasks` and `pr-status` views hydrate to `terminal` and `repo`. Creating a worktree for an existing review branch now gets a suffixed branch name, and the `git-username` branch prefix no longer falls back to the `gh` login.
- **Repo icons.** Remote favicon and owner-avatar icons are dropped, and repos fall back to the default glyph. Browser-pane tab favicons are blocked by the app-window CSP; this is cosmetic.
- **Feedback.** There is no feedback or crash "Send"; crash reports can still be copied locally. There is no star prompt and no share links.
- **Speech.** Speech-to-text is on-device only. A persisted `openai-*` model selection hydrates to "no model selected".
- **Telemetry.** The local record is on by default for new installs. Turn it off in Settings → Privacy or with `ORCA_TELEMETRY_DISABLED=1`.

## Known gaps and Spec B scope

These are also listed in the architecture doc under "Known residuals":

- **SSH works, but its network surfaces remain until Spec B:** the SSH relay deploy, pinned Node runtime downloads, the skill-transfer rails to `storage.googleapis.com` (nothing can mint a grant any more), and the outbound WebSocket dial from the CLI and desktop to *user-paired* remote runtimes (`src/shared/pairing.ts`, `src/cli/runtime/websocket-transport.ts`). The `orca serve --recipe-json` VM-recipe flow and the SSH orcad deploy are runtime-dead after U7.3, and their guide (`skill-guides/orca-per-workspace-env*`) is stale. Spec B deletes all of this.
- **Inert leftovers kept for hydration tolerance:** persisted settings keys (`showMobileButton`, `mobilePairing*`, `skipCodexRateLimitResetConfirm`, the Codex reset-credit ledger, `dismissedUpdateVersion`, the `tasks` view id), the stale encrypted key file `~/.orca/openai-speech-token.enc`, and the CLI `--issue` / `--linear-issue` flags and `issue:` selectors.
- **CI.** Upstream's release and docs workflows stay, but they are gated to `github.repository == 'stablyai/orca'` and do not run on the fork. Consider disabling GitHub Actions on the fork (a repo setting).
- **e2e.** UI e2e specs were not run locally; only `typecheck:e2e` was checked, and it shows no new errors.
- **Housekeeping.**
  - A stray local branch, `backup-y3-tmp`, was created by an implementer agent. Its commits were redone on this branch, it has no remote, and a hook blocked deleting it. Delete it with `git branch -D backup-y3-tmp`.
  - Several implementer commits carry `Co-Authored-By: Claude Sonnet 5.5`, matching the model that wrote them.
- **Not done yet:** pushing the branch, opening a PR, and Spec B.

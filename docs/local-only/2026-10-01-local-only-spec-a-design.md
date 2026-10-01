# Local-only Orca — Spec A: cloud, mobile, telemetry, updater, ingress

Status: approved for planning (2026-10-01)
Branch: `local-only/spec-a`
Follow-up: Spec B removes SSH remotes, remote runtimes, and ephemeral VMs (separate spec, branch, and plan).

## Goal

This fork of `stablyai/orca` runs entirely on the local machine:

- No Orca-owned code reaches a cloud service.
- No cloud or network peer can reach Orca.
- Telemetry stays on disk.
- There is no mobile phone support.

All local functionality is preserved, and pulling future upstream releases must stay a mechanical task.

## Decisions (from the user, 2026-10-01)

| Topic | Decision |
|---|---|
| Fork strategy | Hard removal of cloud-reaching code (no runtime flags). |
| Staging | Spec A (this doc) first; Spec B (SSH/remote/VM) after A is green. |
| Git | Keep git CLI fetch/push/clone. Remove Orca's provider API integrations. |
| Embedded browser pane | Keep, unrestricted (user-driven browsing). |
| Vendor usage/quota polling, Claude OAuth refresh | Remove. |
| Runtime downloads (speech models, scrcpy) | Keep (user-initiated). |
| `orca serve` / `orcad` network mode, browser web client | Remove. |
| Auto-update | Remove. Updates mean merging upstream and rebuilding from source. |

## Invariants (the acceptance contract)

- **I1, egress.** No Orca code opens a connection to a non-loopback host, with five exceptions:
  - the user's git CLI against their own remotes
  - the embedded browser pane
  - `shell.openExternal`, which hands off to the OS browser
  - user-initiated speech-model and scrcpy downloads
  - SSH, until Spec B lands

  Agent CLIs that Orca spawns (claude, codex, ...) talk to their vendors themselves. That traffic is out of scope.
- **I2, ingress.** Nothing binds a non-loopback address. These listeners remain:
  - the CLI runtime Unix socket or Windows named pipe
  - the PTY daemon socket
  - loopback-only helpers: the agent-hook HTTP server, the browser CDP proxy, and the label proxy

  There is no `orca://` protocol handler, no cloud relay socket, and no pairing.
- **I3, telemetry.** Events keep their schema validation and consent gate. The transport is a local JSONL file under `userData`. No code reads that file over a socket.

## Removal inventory

Choke points come from the read-only inventory (`notes/local-only/inventory.json`, gitignored). Each unit below is one commit.

| # | Unit | Primary sites |
|---|---|---|
| U1 | Telemetry transport becomes the local sink | `src/main/telemetry/client.ts` (PostHog to `observability/local-file-sink.ts`), `posthog-node` dependency, `ORCA_POSTHOG_WRITE_KEY`/`ORCA_BUILD_IDENTITY` defines, consent copy in the renderer |
| U2 | Feedback, crash-report submit, diagnostic bundle upload | `ipc/feedback-request.ts`, `observability/diagnostic-upload-*`, the renderer submit UI. Local crash capture and "copy report" stay. |
| U3 | Auto-updater | `src/main/updater*`, `updater-*.ts`, `updater/`, `electron-updater-loader.ts`, `rpc/methods/updater.ts`, the updater IPC and menu entries, nudge/changelog/listBuilds, `config/dev-app-update.yml`, `release-channel.ts`, the electron-builder `publish` block, `Casks/`, the `electron-updater` dependency, and the renderer update UI |
| U4 | Star nag | `src/main/star-nag/`, `main-process-ready-runtime.ts:56-58`, the renderer StarNag mounts |
| U5 | Orca Cloud account and profile sync | `orca-profiles/*cloud*`, PKCE loopback callback, org members, the renderer sign-in UI |
| U6 | Mobile: relay, push, pairing, mobile web bundle, UI | `src/main/runtime/relay/`, `runtime/push/`, `ipc/mobile.ts`, pairing RPC groups, `MOBILE_WEB_BUNDLE_METHODS`, the mobile settings pane, `mobile/` dir, mobile CI workflows. The Mobile Emulator (iOS Simulator / Android) is a local dev tool and is **kept**. |
| U7 | Runtime WebSocket listener, web client, `orca serve`/`orcad` network mode | `main-process-runtime-launch.ts:81` WS, `runtime-rpc-network-exposure.ts`, `ws-transport.ts`, the `ORCA_E2E_USER_DATA_DIR` widening, `vite.web.config.ts`, `src/renderer/src/web*`, `build:web-from-renderer`, serve paths, remote-runtime client pairing |
| U8 | Artifact and skill cloud sharing, `orca://` deep links, `npx skills` registry installs, plugin marketplace and kill list | `artifacts/*cloud*`, `skills` cloud IPC/RPC, `index.ts:97` open-url, electron-builder `protocols`, `skill-update-run`, `main-process-plugins.ts`. Local skill management stays. |
| U9 | Vendor usage/quota polling and Claude OAuth refresh | `rateLimits` service and IPC, `claude-accounts/oauth-refresh.ts`. Local session-file usage stats stay. |
| U10 | Git provider API integrations | `gh-exec-file.ts`, `glab-exec-file.ts`, GitHub/GitLab/Bitbucket/Azure DevOps/Gitea/Jira/Linear handlers and their renderer panels. The git CLI stays. |
| U11 | Renderer remote loads and CSP | `shared/repo-icon.ts` favicons, remote avatars, plus a strict CSP meta on `index.html` and `popout.html`. The browser-pane `<webview>` is exempt. |
| U12 | `cloud/` dir and cloud CI | `cloud/`, `.github/workflows/cloud-*`, lint/format ignore entries, test files importing from `cloud/` |

The plan may reorder or split units after reading the code. Every unit must leave typecheck and tests green against the baseline.

## Keeping upstream merges mechanical

1. **Tier 1, whole-unit deletes.** Prefer deleting entire files and directories. When upstream edits a file we deleted, resolve with `git rm`.
2. **Tier 2, hot-file line deletions.** Some files must be edited: registration sites such as `main-process-runtime-launch.ts`, `register-core-handlers.ts`, `rpc/methods/index.ts`, `main-process-ready-runtime.ts`, `AppRootSurfaces.tsx`, settings navigation, `electron-builder.config.cjs`, and `package.json`. In these files, delete lines and never rewrite surrounding code, so conflicts stay small and obvious.
3. **Tier 3, guard.** Add `config/scripts/check-local-only.mjs`, run from `pnpm lint` and testable on its own. It fails on:
   - forbidden hostnames (`onorca.dev`, `posthog`, `api.github.com`, `gitlab.com/api`, ...) in `src/`
   - forbidden imports (`posthog-node`, `electron-updater`, ...)
   - an electron-builder `publish` or `protocols` entry
   - any non-loopback listener bind, reusing `config/scripts/websocket-server-bind-scan.ts`

   After an upstream merge, run lint and remove whatever the guard names.
4. **Docs.**
   - `docs/reference/local-only-architecture.md` holds the invariants and the remaining listeners.
   - `docs/reference/local-only-upstream-sync.md` holds the merge procedure and a per-file conflict playbook.
   - AGENTS.md and README are updated. Their SSH sections wait for Spec B.
5. **Ratchets.** Count ratchets such as `global-fetch-call-site-audit.test.ts`, the max-lines ratchet, and `config/reliability-gates.jsonc` get their counts or entries updated. They are never deleted.

## Testing and security

- **Before** (done; in `notes/local-only/before/`, gitignored):
  - `pnpm tc` passes.
  - `pnpm test`: 24 files / 37 tests fail on pristine `main`. They are cross-version tests that need upstream tags, plus environment-dependent tests. The list is in `failing-files.txt`.
  - gitleaks: 182 hits.
- **Before, still to capture:** `pnpm audit`, a hostname-grep snapshot, and the bind scan.
- **During:** TDD for the guard and for the local telemetry sink. Each removal unit runs typecheck and the affected tests.
- **After:** re-run all of the above. There must be no new failing test files compared with the baseline, and no forbidden hostnames or binds. Then run a runtime check: build, launch with `ORCA_BACKGROUND_LAUNCH=1`, and confirm with `lsof -i -P -n` on the app's process tree that no socket is non-loopback.
- **Summary:** `docs/local-only/2026-10-01-spec-a-change-summary.md` lists every removed unit, the before/after scan deltas, and the remaining known network surfaces (git CLI, browser pane, downloads, SSH until Spec B).

## Out of scope

- SSH remotes, remote runtimes, ephemeral VMs (Spec B).
- Network traffic of the agent CLIs that Orca spawns.
- Rewriting upstream git history.
- Disabling GitHub Actions on the fork (repo setting, user action).

# Local-only architecture

This fork of `stablyai/orca` runs entirely on the local machine. This page is the
contract the tree is held to, the list of sockets that remain, and the places where
the fork still reaches the network. The enforcement lives in
`config/scripts/check-local-only.mjs` (run by `pnpm run check:local-only` and by
`pnpm lint`); the exemptions live in `config/local-only-allowlist.txt`. To keep the
fork current with upstream, follow [local-only-upstream-sync.md](./local-only-upstream-sync.md).

Design and plan: `docs/local-only/2026-10-01-local-only-spec-a-design.md` and
`docs/local-only/2026-10-01-local-only-spec-a-plan.md`, `docs/local-only/2026-10-02-local-only-spec-b-design.md` and its plan.

## Invariants

- **I1, egress.** No Orca code opens a connection to a non-loopback host, with four exceptions:
  - the user's git CLI against their own remotes (including its own `GIT_SSH_COMMAND` handling, which is git's SSH, not Orca's)
  - the embedded browser pane
  - `shell.openExternal`, which hands off to the OS browser
  - user-initiated speech-model and scrcpy downloads

  Agent CLIs that Orca spawns (claude, codex, ...) talk to their vendors themselves. That traffic is out of scope.

- **I2, ingress.** Nothing binds a non-loopback address. These listeners remain:
  - the CLI runtime Unix socket or Windows named pipe
  - the PTY daemon socket
  - loopback-only helpers: the agent-hook HTTP server, the browser CDP proxy, and the label proxy

  There is no `orca://` protocol handler, no cloud relay socket, and no inbound pairing.

- **I3, telemetry.** Events keep their schema validation and consent gate. The transport is a local JSONL file under `userData`. No code reads that file over a socket.

- **I4, no remote execution.** No code path can create an `ssh:` or `runtime:` execution host, open an SSH connection, deploy a relay or orcad to another machine, or dial a remote Orca runtime. `ExecutionHostKind`/`ExecutionHostId` keep their `ssh` and `runtime` members as inert values nothing can construct. A legacy value reaching a seam fails closed with a typed "unsupported in this build" error; it never falls back to local. Persisted rows that name such a host are dropped at profile load (`src/main/persistence/loading-store/remote-execution-host-strip.ts`).

## Remaining listeners

Re-derive with:

```bash
rg -n "\.listen\(|createServer\(|new WebSocketServer\(" src -g '!*.test.*'
```

Production listeners (test fixtures and harnesses are listed separately below):

| Listener                                   | Site                                                                       | Bind address                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| CLI runtime RPC                            | `src/main/runtime/rpc/unix-socket-transport.ts:59` (`listen` at `:66`)     | Unix socket `o-<pid>-*.sock` under `userData`, or a Windows named pipe. No TCP. |
| PTY daemon                                 | `src/main/daemon/daemon-server-lifecycle.ts:44` (`listen` at `:58`)        | Unix socket or named pipe at the endpoint's `bindPath()`. No TCP.               |
| Agent-hook HTTP server                     | `src/main/agent-hooks/server/server-lifecycle.ts:162` (`listen` at `:184`) | `127.0.0.1`, ephemeral port.                                                    |
| Browser CDP proxy (HTTP + WebSocket)       | `src/main/browser/cdp-ws-proxy.ts:57-58` (`listen` at `:97`)               | `127.0.0.1`, ephemeral port.                                                    |
| Localhost worktree label proxy             | `src/main/localhost-worktree-label-proxy.ts:73` (`listen` at `:81`)        | `127.0.0.1`, ephemeral port.                                                    |
| Agent-hook HTTP server inside a WSL distro | `src/relay/agent-hook-server.ts:155` (`listen` at `:176`)                  | `127.0.0.1` of the distro, reached over the WSL hook relay (same machine).      |

Test-only listeners (not shipped behavior, all `127.0.0.1`): the
`browser-route-*-fixture.ts`, `browser-route-tcp-egress-socks-recorder.ts` and
`browser-session-ua-wire-probe-server.ts` files in
`src/main/browser/`. The
`new WebSocketServer(` sites are `cdp-ws-proxy.ts:58`, which attaches to the
loopback HTTP server above, and `browser-route-tcp-egress-fixture.ts:224`
(`noServer: true`, a test fixture).

There is no runtime WebSocket listener. `ws-transport.ts` and
`runtime-rpc-network-exposure.ts` are gone, so `orca serve` accepts
connections only over the Unix socket or named pipe. The guard's `wildcard-bind`
rule fails on any `host`/`hostname`/`bindHost`/`address` of `0.0.0.0` or `::`, or a
`.listen(`/`.bind(` call with such a host argument. The
`websocket-server-loopback-bind` ratchet test
(`config/scripts/websocket-server-loopback-bind.test.ts`) scans the whole tree for
`new WebSocketServer(` constructions and fails on any whose options it cannot read
or that bind a port without an explicit `host`. Its wildcard pin is 0 and its
allowlist (`config/scripts/__fixtures__/websocket-server-wildcard-bind-allowlist.txt`)
is empty. A floor on the number of recognized constructions keeps the scanner from
going blind. Constructions with `noServer: true` or an attached `server` have no port
of their own to bind.

## Remaining egress exceptions

Outside I1's four exceptions, nothing in `src/` should name a cloud host. These
are the exceptions as they exist in the tree.

- **Git CLI.** `git fetch`, `push`, `clone` run the user's own git binary against
  the user's own remotes. Orca's provider API integrations (GitHub, GitLab,
  Bitbucket, Azure DevOps, Gitea, Jira, Linear) and the `gh`/`glab` runners are
  removed.
- **Embedded browser pane.** Unrestricted by design: it is a user-driven browser.
  It is a `<webview>`, which the app-window CSP does not govern. Favicons for
  pages in it are blocked by the app-window CSP (`img-src` excludes http/https);
  that cosmetic loss is deliberate.
- **`shell.openExternal`.** Help, docs, issue and share links hand off to the OS
  browser. Orca opens no connection.
- **Speech-model and scrcpy downloads.** User-initiated, HTTPS only
  (`src/main/speech/speech-model-http-download.ts`, `src/main/emulator/android/scrcpy-server-download.ts`).

The renderer's own CSP (`src/renderer/index.html` and `popout.html`) restricts
`connect-src` to `'self'`, `blob:`, and loopback HTTP/WS, and `img-src` to local
schemes. Monaco workers, pdf.js wasm, vscode-oniguruma, mermaid and xterm run
under it; `<webview>` is exempt.

### Allowlist entries (`config/local-only-allowlist.txt`)

Every entry carries a justification comment. The categories:

- **Help, docs and issue links** opened with `shell.openExternal`: the sidebar help menu, the link-routing dialog, the terminal error toast, the feature-wall tile and workflow data.
- **Share-usage card text** and the `x.com` intent opened in the OS browser.
- **Strings only**: CLI help examples, a code comment link, and a pasteable install command Orca never runs.
- **Identifier strings only**: the `https://api.openai.com/auth` JWT claim key read from a local Codex auth file (`codex-auth-identity.ts`), never a request URL.
- **Proxy resolution only**: `session.resolveProxy(url)` classifies a URL and never connects (`src/main/network/proxy-settings.ts`).
- **Port-scan address classification**, not a listener bind (`local-workspace-port-address.ts`).

### CI workflows

`.github/workflows/docs.yml` is left in place. Its release gate and
production deploy jobs are gated on `github.repository == 'stablyai/orca'`, so it
never deploys from this fork. The
downloads-badge workflow and its assets were removed because this fork ships no
downloads.

### Guard rules (`check-local-only.mjs`)

Scans non-test sources under `src/`, `package.json`, and every
`config/electron-builder*.config.cjs`:

- `forbidden-host`: a cloud hostname in a source line (`onorca.dev`, `posthog.com`, `api.github.com`, `uploads.github.com`, `github.com/stablyai/orca`, `gitlab.com/api`, `api.bitbucket.org`, `dev.azure.com`, `atlassian.net`, `api.linear.app`, `api.anthropic.com`, `console.anthropic.com`, `chatgpt.com/backend-api`, `api.openai.com`, `nodejs.org/dist`, `storage.googleapis.com`).
- `forbidden-import`: an import of `posthog-node`, `posthog-js`, `electron-updater`, `@octokit/*`, `@sentry/*`, `ssh2` (and `ssh2/*`, `ssh2-*`), `tweetnacl`. Type-only imports (`import type … from 'ssh2'`) are exempt, which is what keeps `@types/ssh2` for the managed hook installers.
- `forbidden-dependency`: the same names in `package.json`.
- `builder-publish` / `builder-protocols`: an electron-builder `publish` (other than `null`) or `protocols` entry.
- `wildcard-bind`: see above.
- Allowlist rows are `path:rule` or `path:rule:match`; the three-segment form exempts one dependency name.

## Local telemetry

- **File:** `<userData>/logs/telemetry.ndjson` (`src/main/telemetry/client.ts`).
- **Format:** one JSON record per line, `type: "telemetry-event"`, written by `createLocalFileSink` (`src/main/observability/local-file-sink.ts`).
- **Rotation:** size-capped by the sink, default 10 MB per file and 10 files (`telemetry.ndjson`, `.1` ... `.9`), oldest deleted. Directory mode `0700`, file mode `0600`.
- **Consent gate:** `track()` order is shutdown gate, burst cap, consent (`resolveConsent`), schema validator, write. When consent is not `enabled`, nothing is written. The burst cap runs before the consent read on purpose. No code reads the file back, and no transport sends it anywhere.
- Local crash capture (`src/main/crash-reporting`) and "copy report" stay; submit and upload are gone.

## Removed subsystems

- **U1, telemetry transport:** PostHog client, `posthog-node`, the write-key build define; replaced by the local sink. Consent copy reworded.
- **U2, feedback and diagnostics upload:** feedback requests, crash-report submit, diagnostic bundle upload transports and their renderer UI.
- **U3, auto-updater:** `electron-updater`, the updater engine, IPC, RPC, menu entries, release channels, the renderer update UI, `dev-app-update.yml`, the electron-builder `publish` block, the Homebrew casks.
- **U4, star nag:** the GitHub star prompt service, IPC and renderer prompts.
- **U5, Orca Cloud:** account sign-in, the PKCE loopback callback, org members, cloud-linked profile sync.
- **U6, mobile:** the relay and push services, pairing, the mobile web bundle RPC surface, the settings pane, the `mobile/` app tree and its CI. The Mobile Emulator dev tool (`src/main/emulator`) is kept.
- **U7, network ingress:** the runtime WebSocket listener, pairing, the browser web client, and the network mode of `orca serve` / `orcad`.
- **U8, sharing and deep links:** skill and artifact cloud sharing, the `orca://` handler and builder `protocols`, `npx skills` registry installs, the plugin kill-list fetch and official marketplace seed.
- **U9, vendor usage polling:** rate-limit and quota polling, Claude OAuth token refresh, Codex reset-credit redemption. Replaced by a local statusline-fed state holder; session-file usage stats stay.
- **U10, git providers:** GitHub/GitLab/Bitbucket/Azure DevOps/Gitea/Jira/Linear handlers, IPC, RPC, CLI, store slices and renderer panels, `gh`/`glab` runners, hosted reviews. The git CLI stays.
- **U11, renderer remote loads:** website-favicon, GitHub-avatar and Google favicon-service icon sources; a strict CSP on the native renderer shells.
- **U12, cloud directory:** `cloud/`, its CI workflows, and lint/format ignore entries.
- **Cloud speech-to-text:** the OpenAI (GPT-4o transcribe) provider, its API-key store, IPC, preload and settings UI. Local speech models and their downloads stay. A persisted selection of a removed cloud model hydrates to no model selected.
- **U13, ephemeral VMs and VM recipes (B1):** the `orca vm` CLI, `EphemeralVmsPane`, `skill-guides/orca-per-workspace-env*`, `--recipe-json`/`--serve-recipe-json`/`--serve-project-root` on `orca serve`. `experimentalEphemeralVms` and the per-worktree checkout mode stay as inert persisted values.
- **U14, serve-update handoff (B2):** the supervisor handoff in `src/cli/runtime/launch.ts` and `notifyServeSupervisorReady`. `orca serve` remains a local headless runtime driven by the local CLI over the unix socket or named pipe.
- **U15, orcad (B3):** `src/main/orcad/**`, `src/main/ssh/orcad-*`, `src/shared/orcad-*`, the build-orcad scripts, the electron-builder orcad template, its CI and `docs/reference/orcad-operations.md`.
- **U16, transfer rails and pinned downloads (B4):** the `skills.install*` RPC family and upload methods, `skill-package-download.ts`, `skill-install-request-service.ts`, `runtime-archive-download.ts`, `pinned-runtime-materializer.ts`, `node-runtime-pin` and `check:node-runtime-pin`, and the WSL OpenCode vault reader (`opencode-wsl-runtime-preparation.ts`), so AI Vault on Windows no longer lists OpenCode sessions stored inside WSL. `scrcpy-server-download.ts` and the speech-model download stay.
- **U17, remote runtime environments (B5):** the pairing client, `src/shared/pairing.ts` and fixtures, `src/shared/remote-runtime-*`, `ipc/runtime-environment*`, the runtime-environments pane, store and client, the remote-server-update client, the CLI remote dial (`websocket-transport.ts`, `ORCA_PAIRING_CODE`, `ORCA_ENVIRONMENT`, `orca environment`, `--host runtime:`), e2ee and `tweetnacl`, the orchestration federation files. `activeRuntimeEnvironmentId` stays an inert, always-null field.
- **U18, SSH (B6):** connection management, the SSH git/filesystem/PTY providers, relay deploy, the SSH UI, IPC, preload and CLI, port forwarding, SOCKS and browser tunnels, SSH e2e and CI, the `docs/reference/ssh-*` docs, the `ssh2` runtime dependency and its packaged-runtime entry. The provider registries (`getSshGitProvider`, `getSshFilesystemProvider`, `getSshProvider`, PTY `sshProviders`) remain as stubs that always return `undefined`, so ~80 `if (connectionId)` callers stay byte-identical to upstream.
- **Hydration (B7):** `sshTargets`, `sshTargetGenerationCounter`, `deletedSshConfigAliases`, `removedSshTargetTombstones`, `sshRemotePtyLeases` and `sshPtyConsumerRecoveries` are deleted from a loaded profile; repos, project groups, folder workspaces, project host setups, worktree metadata, identity rows, session partitions and retirement namespaces that name an `ssh:`/`runtime:` host or a `connectionId` are dropped; the profile is marked dirty so the SQLite domain rows follow on the next complete write. The six keys stay in `PersistedState` as inert empty defaults.

## What remains, and why

The reachable network surface is now exactly I1's four exceptions. These are the deliberate remnants:

- **WSL relay survivors.** WSL is on-machine execution, so its two bundles stay: `src/relay/wsl-agent-hook-relay.ts` and `src/relay/wsl-browser-network-relay.ts`, built by `config/scripts/build-relay.mjs` into `out/relay/` and shipped as `resources/relay`. Their import closure (about 40 `src/relay` files: `dispatcher*`, `agent-hook-*`, `plugin-overlay*`, `protocol.ts`, `preflight-handler.ts`, `wsl-hook-fs-bridge.ts`, `wsl-install-plugins-handler.ts`, `relay-frame-decoder.ts`, ...) and the eight `src/main/ssh` transport files the Windows-side WSL hook relay manager imports (`relay-protocol`, `ssh-channel-multiplexer`, `ssh-multiplexer-transport-writer`, `ssh-multiplexer-writer-lane-scheduler`, `ssh-connection-generation`, `ssh-target-identity`, `ssh-target-id-migration`, `removed-ssh-target-tombstone-retention`) are kept **in place**, not relocated, so upstream merges stay small. Re-derive the closure with `pnpm tc` after touching either entry. Nothing in it opens a socket to another machine.
- **Inert types and keys.** `ExecutionHostKind`/`ExecutionHostId` keep `ssh`/`runtime`; `Repo.connectionId`/`executionHostId` and the folder-workspace and project-host-setup equivalents stay typed; the six SSH persisted keys and `activeRuntimeEnvironmentId` stay as empty/null defaults; `experimentalEphemeralVms` and the per-worktree checkout mode stay as dead settings. None can be set from any UI, IPC, RPC or CLI path.
- **Hook installers' `SFTPWrapper`.** ~37 managed agent-hook installers use `import type { SFTPWrapper } from 'ssh2'` as their filesystem abstraction (the WSL hook bridge fakes it). `@types/ssh2` therefore stays a devDependency; the runtime `ssh2` package is gone and the guard forbids non-type imports.
- **Dead persisted settings keys** from Spec A (`starNag*`, update UI fields, cloud-linked profile fields, mobile pairing settings, `groupBy: 'pr'`, `activeView` of `'artifacts'`/`'tasks'`) still hydrate to defaults.
- **Stale doc citations in code comments.** Shared files that cite `docs/reference/ssh-execution-boundary.md` or `remote-wire-compatibility.md` keep the comment text; those pages are removed and the citations are historical.
- **Browser pane is unrestricted by design.** Anything the user loads in it is outside the invariants.
- **Agent CLIs** that Orca spawns reach their vendors on their own.

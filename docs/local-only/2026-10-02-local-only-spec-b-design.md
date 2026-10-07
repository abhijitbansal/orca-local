# Local-only Orca — Spec B: SSH, remote runtimes, orcad, VMs, transfer rails

Status: approved for planning (2026-10-02)
Branch: `local-only/spec-b` (branched from `local-only/spec-a`)
Inputs: Spec A summary and the residuals in `docs/reference/local-only-architecture.md`; read-only inventory in `notes/local-only/inventory-spec-b.json` (gitignored).

## Goal

Finish the local-only conversion. After Spec B, Orca reaches only loopback, plus the exceptions the user kept:

- the user's git CLI
- the browser pane
- `openExternal` links
- speech-model downloads
- scrcpy downloads

There is no SSH, no remote-runtime dial, no orcad, no ephemeral VMs, no skill-transfer rails, and no pinned runtime downloads.

## Decisions (user, 2026-10-01/02)

| Topic | Decision |
|---|---|
| SSH remotes, remote runtimes, VMs | Remove (loopback only). WSL stays (on-machine). |
| Depth | **Remove the capability, keep the inert types.** Hard-delete transport, connection, deploy, UI, IPC/RPC, CLI and download code. `ExecutionHostKind`/`ExecutionHostId` keep their `ssh` and `runtime` members as inert values that nothing can create. Unions are not narrowed across ~800 importing files. |
| WSL OpenCode vault reader (nodejs.org download into WSL) | Remove. AI Vault on Windows loses OpenCode sessions stored inside WSL. |
| Persisted ssh/runtime repos, worktrees, terminals | Drop them at profile load, using an explicit strip. |
| `orca serve` | Keep. It is a local headless runtime driven by the local CLI over the unix socket. Remove only `--recipe-json`, `--serve-recipe-json`, `--serve-project-root` and the updater handoff. |

## Invariants (supersede Spec A's I1/I2 exceptions)

- **I1′ egress.** No Orca code connects to a non-loopback host, except:
  - the user's git CLI
  - the embedded browser pane
  - `shell.openExternal`
  - user-initiated speech-model and scrcpy downloads

  The SSH exception is gone.
- **I2′ ingress.** This is unchanged from Spec A: only loopback listeners and the local unix socket or named pipe.
- **I4 no remote execution.** No code path can create an `ssh:` or `runtime:` execution host, open an SSH connection, deploy a relay or orcad, or dial a remote Orca runtime. If a legacy value reaches a seam, it fails closed with a typed "unsupported in this build" error. It never falls back to local.

## Units

Each unit gets one or more plan tasks, and each task produces one typecheck-green commit.

| # | Unit | Shape |
|---|---|---|
| B0 | Guard extension | Forbid non-type imports of `ssh2`, `ssh2-*` and `tweetnacl`. Forbid the hosts `nodejs.org/dist` and `storage.googleapis.com`. At the end, remove the allowlist rows marked "Spec B". TDD. |
| B1 | Ephemeral VMs and VM recipes | ~92 whole-file deletes and ~25 line edits. Removes the `orca vm` CLI, the `EphemeralVmsPane`, `skill-guides/orca-per-workspace-env*` and `--recipe-json` on serve. The persisted `experimentalEphemeralVms` key and the per-worktree checkout mode stay inert. |
| B2 | Serve-update handoff | ~8 files. Removes the supervisor surgery in `src/cli/runtime/launch.ts` and the `notifyServeSupervisorReady` call. |
| B3 | orcad | `src/main/orcad/**`, `src/main/ssh/orcad-*`, `src/shared/orcad-*`, the build-orcad scripts, the electron-builder orcad template, CI and `docs/reference/orcad-operations.md` (~140 files). |
| B4 | Transfer rails and pinned downloads | The skill-transfer RPC family (`skills.install*`, upload methods), `skill-package-download.ts`, `skill-install-request-service.ts`, `runtime-archive-download.ts`, `pinned-runtime-materializer.ts`, `node-runtime-pin` and `check:node-runtime-pin`, plus the WSL OpenCode vault reader (`opencode-wsl-runtime-preparation.ts` and its call at `cached-session-list.ts`). Keep `scrcpy-server-download.ts` and the speech-model download. |
| B5 | Remote runtime environments | The pairing client, `src/shared/pairing.ts` and fixtures, `src/shared/remote-runtime-*`, `ipc/runtime-environment*`, paired-runtime browser, the renderer runtime-environments pane, store and client, the remote-server-update client, the CLI remote dial (`websocket-transport.ts`, `ORCA_PAIRING_CODE`/`ORCA_ENVIRONMENT`, `orca environment`, `--host runtime:`), e2ee and `tweetnacl`, and the remote-only capabilities (~850 files including tests, plus the orchestration federation files). Delete the `settings:set-active-runtime-environment-preference` setter. `activeRuntimeEnvironmentId` stays an inert, always-null field. |
| B6 | SSH | Connection management, the SSH git, filesystem and PTY providers, relay deploy, the SSH UI, IPC, preload and CLI, port forwarding, SOCKS and browser tunnels, SSH e2e and CI, and the `docs/reference/ssh-*` docs. **Seam rule:** the provider registries (`getSshGitProvider`, `getSshFilesystemProvider`, `getSshProvider`, and PTY `sshProviders`) stay as tiny stubs that always return `undefined`, so the ~80 `if (connectionId)` callers keep compiling without edits. Do not edit those callers unless a caller would mistake `undefined` for local. **WSL survivors stay in place:** the ~40-file `src/relay` closure for `wsl-agent-hook-relay.ts` and `wsl-browser-network-relay.ts`, and the 8 `src/main/ssh` transport files the WSL hook relay imports (`relay-protocol`, `ssh-channel-multiplexer`, `ssh-multiplexer-*`, `ssh-connection-generation`, `ssh-target-identity`, `ssh-target-id-migration`, `removed-ssh-target-tombstone-retention`). They are not relocated, which keeps merges small. The `ssh2` runtime dependency goes. `@types/ssh2` stays a devDependency, because ~37 local and WSL hook installers use `import type { SFTPWrapper }` as their filesystem abstraction. The packaged-runtime `ssh2` entry goes. Git's own `GIT_SSH_COMMAND` handling is not Orca SSH and stays untouched. |
| B7 | Hydration | Replace the ssh and runtime normalizer lines with an explicit strip. At load, drop repos, worktree metas, terminals/tabs and leases whose host is `ssh:`/`runtime:`, or that have a `connectionId`. Drop `sshTargets`, `sshTargetGenerationCounter`, `deletedSshConfigAliases`, `removedSshTargetTombstones`, `sshRemotePtyLeases` and `sshPtyConsumerRecoveries`. Keep `gcStaleWorktreeMeta` from treating stripped rows as local. Add tests that feed legacy profiles and assert a clean local-only load with no remote path probed. |
| B8 | Docs and architecture | AGENTS.md: remove the "SSH Use Case" rule, the Remote Wire Compatibility section (no paired clients remain) and the SSH and relay cross-platform bullets. Keep the WSL bullets. Remove the `docs/reference` SSH, orcad and remote-wire docs. Update the docs-site SSH, remote and VM pages and the README. Update `local-only-architecture.md`: the new invariants, the residuals list emptied, and the WSL relay survivors explained. Update the upstream-sync playbook with Spec B rows. |
| Z | Verification and summary | Same as Spec A: tc, full test diff against the Spec A "after" baseline, lint, e2e typecheck, gitleaks, audit, hostname and listener diffs, a clean `pnpm build:mac`, the runtime check, a change summary, a manual checklist, and a push. |

Order: B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → Z. The plan may split or reorder units after reading the code.

## Keeping merges mechanical

The Spec A tiers still apply: whole-file deletes first; in shared files, delete lines and never rewrite. The new tool here is the stub-registry seam in B6, which keeps the ~80 caller files out of the diff. Spec B rows are added to the guard and the playbook.

## Testing and security

- **Baseline:** the Spec A "after" state, `notes/local-only/after/`. It has 13 known failing files, 166 e2e type errors, 113 tracked gitleaks hits and a clean guard.
- **Per task:** `pnpm tc`, the touched tests, the path-string sweep, and `check:local-only`.
- **Acceptance:** no new failing test files against that baseline; lint passes; the guard is clean with no Spec B allowlist rows; the runtime `lsof` shows loopback only; `orca status` works; `pnpm build:mac` succeeds and the bundle no longer ships the SSH relay bundles (only the WSL relays) or orcad.

## Out of scope

- The agent CLIs' own vendor traffic.
- Narrowing the inert type unions (a possible later cleanup).
- Disabling GitHub Actions on the fork, which is a repo setting.

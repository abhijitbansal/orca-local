# Local-only fork: documentation index

This fork of [stablyai/orca](https://github.com/stablyai/orca) removes every path by which Orca's own code reaches the cloud, or by which anything on the network reaches Orca. The work was done in two stages. Both are merged into `main`.

| Stage  | Scope                                                                                                                                                                                                                                                              | Design                                           | Plan                                         | Change summary                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| Spec A | Telemetry upload, feedback/crash/diagnostics upload, auto-updater, Orca Cloud account, mobile app/relay/push, runtime WebSocket listener and web client, sharing and deep links, vendor usage polling, git-provider APIs, OpenAI transcription, remote images, CSP | [design](2026-10-01-local-only-spec-a-design.md) | [plan](2026-10-01-local-only-spec-a-plan.md) | [summary](2026-10-01-spec-a-change-summary.md) |
| Spec B | SSH remotes and relay (WSL relays kept), remote runtime environments and pairing, orcad, serve-update handoff, ephemeral VMs and recipes, skill-transfer rails, pinned runtime downloads, WSL OpenCode vault reader, load-time strip of old remote state           | [design](2026-10-02-local-only-spec-b-design.md) | [plan](2026-10-02-local-only-spec-b-plan.md) | [summary](2026-10-02-spec-b-change-summary.md) |

Reference docs that stay current:

- [`docs/reference/local-only-architecture.md`](../reference/local-only-architecture.md) covers the invariants (no Orca-owned cloud egress, loopback-only ingress, local telemetry, no remote execution), the listeners that remain, the allowed network exceptions, the local-only guard and the known residuals.
- [`docs/reference/local-only-upstream-sync.md`](../reference/local-only-upstream-sync.md) covers how to merge a new upstream release, with a conflict playbook for each hot file.
- The [README](../../README.md) covers what changed, how to build from source, and how to update.

Guard: `pnpm run check:local-only` runs the rules in `config/scripts/check-local-only.mjs`, with exceptions listed in `config/local-only-allowlist.txt`. It is part of `pnpm lint`.

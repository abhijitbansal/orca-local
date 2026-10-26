/// Bundle ids of the apps whose computer-use sidecar may drive this helper.
public enum TrustedOrcaApplication {
    public static func isTrusted(bundleId: String) -> Bool {
        // Why: `pnpm dev` launches as `com.abhijitbansal.orca-local.dev` and per-worktree wrapper apps use
        // `com.abhijitbansal.orca-local.dev.<name>`; the sidecar peer check must authorize both (#26498).
        bundleId == "com.abhijitbansal.orca-local" ||
            bundleId == "com.abhijitbansal.orca-local.dev" ||
            bundleId.hasPrefix("com.abhijitbansal.orca-local.dev.") ||
            bundleId == "com.github.Electron"
    }
}

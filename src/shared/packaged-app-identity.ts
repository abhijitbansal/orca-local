// Why: this fork ships under its own identity so it never shares a profile, TCC grants,
// Keychain item, single-instance lock or /Applications slot with upstream Orca.
// config/electron-builder.config.cjs repeats these literals; its test asserts they match.
export const PACKAGED_BUNDLE_ID = 'com.abhijitbansal.orca-local'
export const PACKAGED_APP_NAME = 'Orca Local'
/** userData directory under the platform app-data root (Electron derives it from package `name`). */
export const PACKAGED_USER_DATA_DIR_NAME = 'orca-local'

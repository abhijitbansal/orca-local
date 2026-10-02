<h1 align="center">
  <img src="../../resources/build/icon.png" alt="Orca" width="64" valign="middle" /> Orca
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="ライセンス: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="対応プラットフォーム: macOS、Windows、Linux" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>100x ビルダーのための AI オーケストレーター。</strong><br/>
  Codex、Claude Code、OpenCode、Pi を並べて実行 — それぞれを専用のワークツリーで動かし、1 か所で追跡できます。
</p>

> **ローカル専用フォーク。** これは [stablyai/orca](https://github.com/stablyai/orca) のフォークで、すべてあなたのマシン上で動作します。クラウドアカウント、モバイルアプリ、自動アップデート、テレメトリのアップロード、ネットワークのリッスンはありません。匿名のプロダクトイベントは、許可した場合のみローカルファイルに書き込まれ、どこにも送信されません。Git はあなた自身の `git` CLI を通じて、あなた自身のリモートに対して動作します。不変条件、残っているソケット、ネットワークに接続する少数の箇所は [docs/reference/local-only-architecture.md](../reference/local-only-architecture.md) に、上流の新しいリリースの取り込み方は [docs/reference/local-only-upstream-sync.md](../reference/local-only-upstream-sync.md) にあります。

## 機能

<table>
<tr>
<td width="50%" valign="middle">

### 並列ワークツリー

1 つのプロンプトを 5 つのエージェントに展開し、それぞれを独立した git ワークツリーで実行 — 結果を比較して、最良のものをマージできます。

[ドキュメント →](../site/content/docs/model/worktrees.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/model/worktrees.mdx"><picture><source srcset="../site/public/docs/tab-split.gif" type="image/gif"><img src="../site/public/docs/posters/tab-split.jpg" alt="並列ワークツリーのオーケストレーション" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### ターミナル分割

WebGL レンダリング、無制限の分割、再起動後も残るスクロールバックを備えた Ghostty クラスのターミナル。

[ドキュメント →](../site/content/docs/terminal.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/terminal.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-02.poster.jpg" alt="ターミナル分割" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### デザインモード

実際の Chromium ウィンドウで任意の UI 要素をクリックすると、その HTML、CSS、切り抜いたスクリーンショットがそのままエージェントのプロンプトに送られます。

[ドキュメント →](../site/content/docs/browser/design-mode.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/browser/design-mode.mdx"><picture><source srcset="../site/public/docs/orca-design-mode.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-05.poster.jpg" alt="組み込みブラウザとデザインモード" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### SSH ワークツリー

強力なリモートマシン上でエージェントを実行 — ファイル編集、git、ターミナルをフルに使え、自動再接続とポートフォワーディングも付属します。

[ドキュメント →](../site/content/docs/ssh.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/ssh.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-06.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-06.poster.jpg" alt="SSH 経由のリモートワークツリー" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### AI Diff に注釈

任意の Diff 行にコメントを付けてエージェントへ送り返せます — Orca から離れずにレビュー、編集、コミットまで完結します。

[ドキュメント →](../site/content/docs/review/annotate-ai-diff.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/review/annotate-ai-diff.mdx"><picture><source srcset="../site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-08.poster.jpg" alt="AI が生成した Diff への注釈" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### ファイルをエージェントへドラッグ

オートセーブが全面的に効く VS Code のエディタ — ファイルや画像をそのままエージェントのプロンプトへドラッグできます。

[ドキュメント →](../site/content/docs/editing/file-explorer.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/editing/file-explorer.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-07.poster.jpg" alt="ファイルや画像をエージェントのプロンプトへドラッグ" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

エージェント自身も Orca を操作できます — `orca worktree create`、`snapshot`、`click`、`fill` であらゆるワークフローをスクリプト化できます。

[ドキュメント →](../site/content/docs/cli/overview.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/cli/overview.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-09.poster.jpg" alt="CLI から Orca をスクリプト操作" width="100%" /></picture></a>
</td>
</tr>
</table>

**さらに同梱:**

- **[クイックオープン](../site/content/docs/model/quick-open.mdx)** — フローを離れずに、ワークツリー、ファイル、エージェント、コマンド、リポジトリコンテキストを横断検索できます。
- **[アカウント切り替えと使用量トラッキング](../site/content/docs/agents/usage-tracking.mdx)** — Claude と Codex の使用量やレート制限のリセットを確認し、再ログインなしでアカウントを切り替えられます。
- **[リッチなリポジトリプレビュー](../site/content/docs/editing/markdown.mdx)** — Markdown、画像、PDF、リポジトリ文書をワークスペース内でプレビューできます。
- **[Computer Use](../site/content/docs/cli/computer-use.mdx)** — 実際の操作が必要なワークフローでは、エージェントにデスクトップアプリや画面上の UI を操作させられます。
- **[通知と未読ステータス](../site/content/docs/notifications.mdx)** — エージェントの完了や要対応をすぐに把握し、スレッドを未読に戻して後で確認できます。
- **その他、まだまだたくさん** — 毎日リリースしているので、このリストは常に追いついていません。本当の機能一覧は[チェンジログ](https://github.com/stablyai/orca/releases)です。

---

## 対応するエージェント

**あらゆる CLI エージェント**で動作します — ターミナルで動くものなら、Orca でも動きます。

<p>
  <a href="https://docs.anthropic.com/claude/docs/claude-code"><kbd><img src="../assets/claude-logo.svg" alt="Claude Code logo" width="16" valign="middle" /> Claude Code</kbd></a> &nbsp;
  <a href="https://github.com/openai/codex"><kbd><img src="https://www.google.com/s2/favicons?domain=openai.com&sz=64" alt="Codex logo" width="16" valign="middle" /> Codex</kbd></a> &nbsp;
  <a href="https://x.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=x.ai&sz=64" alt="Grok logo" width="16" valign="middle" /> Grok</kbd></a> &nbsp;
  <a href="https://cursor.com/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=cursor.com&sz=64" alt="Cursor logo" width="16" valign="middle" /> Cursor</kbd></a> &nbsp;
  <a href="https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=github.com&sz=64" alt="GitHub Copilot logo" width="16" valign="middle" /> GitHub Copilot</kbd></a> &nbsp;
  <a href="https://dev.meta.ai/docs/muse-code"><kbd><img src="../../src/shared/agent-icons/muse.png" alt="Muse logo" width="16" valign="middle" /> Muse</kbd></a> &nbsp;
  <a href="https://deepseek-harness.github.io/deepseek-harness/"><kbd><img src="../../src/shared/agent-icons/dsh.png" alt="DeepSeek Harness logo" width="16" valign="middle" /> DeepSeek Harness</kbd></a> &nbsp;
  <a href="https://zcode.z.ai/en/docs"><kbd><img src="../../src/shared/agent-icons/zcode.png" alt="ZCode logo" width="16" valign="middle" /> ZCode</kbd></a> &nbsp;
  <a href="https://opencode.ai/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=opencode.ai&sz=64" alt="OpenCode logo" width="16" valign="middle" /> OpenCode</kbd></a> &nbsp;
  <a href="https://ampcode.com/manual#install"><kbd><img src="https://www.google.com/s2/favicons?domain=ampcode.com&sz=64" alt="Amp logo" width="16" valign="middle" /> Amp</kbd></a> &nbsp;
  <a href="https://openclaude.gitlawb.com/"><kbd><img src="../../resources/openclaude-logo.png" alt="OpenClaude logo" width="16" valign="middle" /> OpenClaude</kbd></a> &nbsp;
  <a href="https://antigravity.google/docs/cli-overview"><kbd><img src="https://www.google.com/s2/favicons?domain=antigravity.google&sz=64" alt="Antigravity logo" width="16" valign="middle" /> Antigravity</kbd></a> &nbsp;
  <a href="https://pi.dev"><kbd><img src="https://pi.dev/favicon.svg" alt="Pi logo" width="16" valign="middle" /> Pi</kbd></a> &nbsp;
  <a href="https://omp.sh"><kbd><img src="https://omp.sh/favicon.svg" alt="oh-my-pi logo" width="16" valign="middle" /> oh-my-pi</kbd></a> &nbsp;
  <a href="https://hermes-agent.nousresearch.com/docs/"><kbd><img src="https://www.google.com/s2/favicons?domain=nousresearch.com&sz=64" alt="Hermes Agent logo" width="16" valign="middle" /> Hermes Agent</kbd></a> &nbsp;
  <a href="https://block.github.io/goose/docs/quickstart/"><kbd><img src="https://www.google.com/s2/favicons?domain=goose-docs.ai&sz=64" alt="Goose logo" width="16" valign="middle" /> Goose</kbd></a> &nbsp;
  <a href="https://docs.augmentcode.com/cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=augmentcode.com&sz=64" alt="Auggie logo" width="16" valign="middle" /> Auggie</kbd></a> &nbsp;
  <a href="https://github.com/autohandai/code-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=autohand.ai&sz=64" alt="Autohand Code logo" width="16" valign="middle" /> Autohand Code</kbd></a> &nbsp;
  <a href="https://github.com/charmbracelet/crush"><kbd><img src="https://www.google.com/s2/favicons?domain=charm.sh&sz=64" alt="Charm logo" width="16" valign="middle" /> Charm</kbd></a> &nbsp;
  <a href="https://docs.cline.bot/cline-cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=cline.bot&sz=64" alt="Cline logo" width="16" valign="middle" /> Cline</kbd></a> &nbsp;
  <a href="https://www.codebuff.com/docs/help/quick-start"><kbd><img src="https://www.google.com/s2/favicons?domain=codebuff.com&sz=64" alt="Codebuff logo" width="16" valign="middle" /> Codebuff</kbd></a> &nbsp;
  <a href="https://freebuff.com/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=freebuff.com&sz=64" alt="Freebuff logo" width="16" valign="middle" /> Freebuff</kbd></a> &nbsp;
  <a href="https://commandcode.ai/docs/quickstart"><kbd><img src="https://www.google.com/s2/favicons?domain=commandcode.ai&sz=64" alt="Command Code logo" width="16" valign="middle" /> Command Code</kbd></a> &nbsp;
  <a href="https://docs.continue.dev/guides/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=continue.dev&sz=64" alt="Continue logo" width="16" valign="middle" /> Continue</kbd></a> &nbsp;
  <a href="https://docs.factory.ai/cli/getting-started/quickstart"><kbd><img src="../assets/droid-logo.svg" alt="Droid logo" width="16" valign="middle" /> Droid</kbd></a> &nbsp;
  <a href="https://kilo.ai/docs/cli"><kbd><img src="https://raw.githubusercontent.com/Kilo-Org/kilocode/main/packages/kilo-vscode/assets/icons/kilo-light.svg" alt="Kilocode logo" width="16" valign="middle" /> Kilocode</kbd></a> &nbsp;
  <a href="https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html"><kbd><img src="https://www.google.com/s2/favicons?domain=moonshot.cn&sz=64" alt="Kimi logo" width="16" valign="middle" /> Kimi</kbd></a> &nbsp;
  <a href="https://kiro.dev/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=kiro.dev&sz=64" alt="Kiro logo" width="16" valign="middle" /> Kiro</kbd></a> &nbsp;
  <a href="https://github.com/mistralai/mistral-vibe"><kbd><img src="https://www.google.com/s2/favicons?domain=mistral.ai&sz=64" alt="Mistral Vibe logo" width="16" valign="middle" /> Mistral Vibe</kbd></a> &nbsp;
  <a href="https://github.com/QwenLM/qwen-code"><kbd><img src="https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=64" alt="Qwen Code logo" width="16" valign="middle" /> Qwen Code</kbd></a> &nbsp;
  <a href="https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/"><kbd><img src="https://www.google.com/s2/favicons?domain=atlassian.com&sz=64" alt="Rovo Dev logo" width="16" valign="middle" /> Rovo Dev</kbd></a> &nbsp;
  <kbd>+ any CLI agent</kbd>
</p>

---

## インストール

このフォークはビルド済みダウンロード、Homebrew cask、自動アップデートを提供しません。ソースからビルドし、更新は上流をマージして再ビルドします（[上流同期ガイド](../reference/local-only-upstream-sync.md)）。

```bash
pnpm install

# macOS
pnpm build:mac

# Linux
pnpm build:linux

# Windows
pnpm build:win
```

パッケージ化せずソースから実行するには `pnpm dev` を使います。コントリビュートの方法とプラットフォームごとの前提条件は [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) をご覧ください。`docs/site/content/docs/` のドキュメントは上流のドキュメントサイトです。このフォークでは公開していないため、リポジトリ内のページを直接お読みください。

---

## プライバシー

Orca 自体はクラウドサービスに接続しません。プロダクトイベントは検証され、設定の同意に従って、アプリの `logs` フォルダー内の `telemetry.ndjson` に追記されます（サイズ上限あり、アップロードなし）。詳しくは[プライバシーとテレメトリ](../site/content/docs/telemetry.mdx)と[アーキテクチャノート](../reference/local-only-architecture.md)をご覧ください。Orca で実行するエージェント CLI（Claude Code、Codex など）はそれぞれのベンダーに接続します。その通信は Orca の範囲外です。

---

## 開発について

貢献したい、またはローカルで実行したいですか？ [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) をご覧ください。変更を出す前に `pnpm run check:local-only` を実行してください。上流: [stablyai/orca](https://github.com/stablyai/orca)。

## ライセンス

Orca は [MIT License](../../LICENSE) の下で無料かつオープンソースです。

<h1 align="center">
  <img src="../../resources/build/icon.png" alt="Orca" width="64" valign="middle" /> Orca
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="许可证: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="支持的平台：macOS、Windows 和 Linux" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>面向 100x 构建者的 AI 编排器。</strong><br/>
  并排运行 Codex、Claude Code、OpenCode 或 Pi — 每个都在自己的 worktree 中运行，并在一个地方统一跟踪。
</p>

> **纯本地分支。** 这是 [stablyai/orca](https://github.com/stablyai/orca) 的分支，完全在你的机器上运行：没有云账号、没有移动应用、没有自动更新、没有遥测上传，也没有网络监听。本地使用记录在新安装中默认开启，一个开关即可关闭，只写入本地文件，绝不发送。Git 通过你自己的 `git` CLI 访问你自己的远程仓库。不变量、仍保留的套接字，以及少数仍会访问网络的位置，见 [docs/reference/local-only-architecture.md](../reference/local-only-architecture.md)。合并新的上游版本，见 [docs/reference/local-only-upstream-sync.md](../reference/local-only-upstream-sync.md)。

## 特性

<table>
<tr>
<td width="50%" valign="middle">

### 并行 Worktree

把一个提示同时分发给五个智能体，每个都在自己隔离的 git worktree 中运行 — 比较结果，合并最佳方案。

[文档 →](../site/content/docs/model/worktrees.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/model/worktrees.mdx"><picture><source srcset="../site/public/docs/tab-split.gif" type="image/gif"><img src="../site/public/docs/posters/tab-split.jpg" alt="并行 worktree 编排" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 终端分屏

Ghostty 级终端，支持 WebGL 渲染、无限分屏，以及重启后依然保留的滚动历史。

[文档 →](../site/content/docs/terminal.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/terminal.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-02.poster.jpg" alt="终端分屏" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 设计模式

在真实的 Chromium 窗口中点击任意 UI 元素，把它的 HTML、CSS 和裁剪好的截图直接发送到智能体的提示中。

[文档 →](../site/content/docs/browser/design-mode.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/browser/design-mode.mdx"><picture><source srcset="../site/public/docs/orca-design-mode.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-05.poster.jpg" alt="内置浏览器与设计模式" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### SSH Worktree

在高性能远程机器上运行智能体，完整支持文件编辑、git 和终端 — 自动重连与端口转发一应俱全。

[文档 →](../site/content/docs/ssh.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/ssh.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-06.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-06.poster.jpg" alt="通过 SSH 使用远程 worktree" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 标注 AI Diff

在任意 diff 行上添加评论并发回给智能体 — 评审、编辑、提交，全程无需离开 Orca。

[文档 →](../site/content/docs/review/annotate-ai-diff.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/review/annotate-ai-diff.mdx"><picture><source srcset="../site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-08.poster.jpg" alt="标注 AI 生成的 diff" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 拖文件给智能体

VS Code 的编辑器，处处自动保存 — 把文件或图片直接拖入智能体提示。

[文档 →](../site/content/docs/editing/file-explorer.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/editing/file-explorer.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-07.poster.jpg" alt="将文件和图片拖入智能体提示" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

智能体也能驱动 Orca — 用 `orca worktree create`、`snapshot`、`click` 和 `fill` 把每个工作流脚本化。

[文档 →](../site/content/docs/cli/overview.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/cli/overview.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-09.poster.jpg" alt="从 CLI 脚本化 Orca" width="100%" /></picture></a>
</td>
</tr>
</table>

**开箱即用的还有：**

- **[快速打开](../site/content/docs/model/quick-open.mdx)** — 在 worktree、文件、智能体、命令和仓库上下文之间搜索，不打断你的心流。
- **[账号切换与用量追踪](../site/content/docs/agents/usage-tracking.mdx)** — 查看 Claude 和 Codex 的用量与限额重置时间，并且无需重新登录即可热切换账号。
- **[丰富仓库预览](../site/content/docs/editing/markdown.mdx)** — 在工作区中预览 Markdown、图片、PDF 和仓库文档。
- **[Computer Use](../site/content/docs/cli/computer-use.mdx)** — 当工作流需要真实交互时，让智能体操作桌面应用和可见 UI。
- **[通知与未读状态](../site/content/docs/notifications.mdx)** — 第一时间知道智能体何时完成或需要关注，并可将会话标记为未读，稍后再回来处理。
- **还有很多很多** — 我们每天发布新功能，这个列表永远跟不上。[更新日志](https://github.com/stablyai/orca/releases)才是真正的功能列表。

---

## 支持的智能体

适配**任何 CLI 智能体** — 只要能在终端里运行，就能在 Orca 里运行。

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
  <kbd>+ 任何 CLI 智能体</kbd>
</p>

---

## 安装

本分支不提供预构建下载、Homebrew cask 或自动更新。请从源码构建，并通过合并上游后重新构建来更新（[上游同步指南](../reference/local-only-upstream-sync.md)）。

```bash
pnpm install

# macOS（同时构建 x64 和 arm64，需先安装两种 CPU 的依赖）
pnpm install:release
pnpm build:mac

# Linux
pnpm build:linux

# Windows
pnpm build:win
```

不打包、直接从源码运行请使用 `pnpm dev`。贡献方式与各平台前置条件见 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md)。`docs/site/content/docs/` 下的文档是上游的文档站点；本分支不发布它，请直接在仓库中阅读这些页面。

---

## 隐私

除[架构说明](../reference/local-only-architecture.md)中列出的例外外，Orca 自身的代码不会连接任何云服务。例外包括：你自己的 `git` CLI 访问你自己的远程仓库、内置浏览器面板、交给系统浏览器打开的链接、由你主动发起的语音模型和 scrcpy 下载，以及 SSH。新安装默认开启本地使用记录：经过校验的产品事件会追加写入应用 `logs` 文件夹下的 `telemetry.ndjson`，有大小上限，且不会上传。可在设置 → 隐私中关闭，或使用 `ORCA_TELEMETRY_DISABLED=1` 启动。详见[隐私与遥测](../site/content/docs/telemetry.mdx)。你在 Orca 中运行的智能体 CLI（Claude Code、Codex 等）会各自连接自己的厂商，这部分流量与 Orca 无关。

---

## 开发

想要贡献代码或在本地运行？请参阅 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md)，并在提交改动前运行 `pnpm run check:local-only`。上游：[stablyai/orca](https://github.com/stablyai/orca)。

## 许可证

Orca 是自由且开源的软件，遵循 [MIT 许可证](../../LICENSE)。

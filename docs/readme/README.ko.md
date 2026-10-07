<h1 align="center">
  <img src="../../resources/build/icon.png" alt="Orca" width="64" valign="middle" /> Orca
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="라이선스: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="지원 플랫폼: macOS, Windows, Linux" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>100x 빌더를 위한 AI 오케스트레이터.</strong><br/>
  Codex, Claude Code, OpenCode, Pi를 나란히 실행하세요. — 각 에이전트는 자체 worktree에서 실행되고 한곳에서 추적됩니다.
</p>

> **로컬 전용 포크.** 이 저장소는 [stablyai/orca](https://github.com/stablyai/orca)의 포크로, 모든 것이 내 컴퓨터에서만 실행됩니다. 클라우드 계정, 모바일 앱, 자동 업데이트, 텔레메트리 업로드, 네트워크 리스너가 없습니다. 로컬 사용 기록은 새로 설치하면 기본으로 켜져 있고 스위치 하나로 끌 수 있으며, 파일에만 기록될 뿐 어디로도 전송되지 않습니다. Git은 내 `git` CLI로 내 원격 저장소에 직접 접근합니다. 불변 조건, 남아 있는 소켓, 아직 네트워크에 접근하는 몇몇 위치는 [docs/reference/local-only-architecture.md](../reference/local-only-architecture.md)에, 새 업스트림 릴리스를 가져오는 방법은 [docs/reference/local-only-upstream-sync.md](../reference/local-only-upstream-sync.md)에 있습니다.

## 기능

<table>
<tr>
<td width="50%" valign="middle">

### 병렬 Worktree

하나의 프롬프트를 다섯 에이전트에 동시에 보내세요. 각 에이전트는 격리된 자체 git worktree에서 실행됩니다 — 결과를 비교하고 가장 좋은 것을 머지하세요.

[문서 →](../site/content/docs/model/worktrees.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/model/worktrees.mdx"><picture><source srcset="../site/public/docs/tab-split.gif" type="image/gif"><img src="../site/public/docs/posters/tab-split.jpg" alt="병렬 worktree 오케스트레이션" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 터미널 분할

WebGL 렌더링, 무한 분할, 재시작 후에도 유지되는 스크롤백을 갖춘 Ghostty급 터미널.

[문서 →](../site/content/docs/terminal.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/terminal.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-02.poster.jpg" alt="터미널 분할" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 디자인 모드

실제 Chromium 창에서 UI 요소를 클릭하면 해당 HTML, CSS, 잘라낸 스크린샷이 에이전트 프롬프트로 바로 전송됩니다.

[문서 →](../site/content/docs/browser/design-mode.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/browser/design-mode.mdx"><picture><source srcset="../site/public/docs/orca-design-mode.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-05.poster.jpg" alt="내장 브라우저와 디자인 모드" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### AI Diff 주석

diff의 어느 줄에든 코멘트를 남기고 에이전트에게 바로 보내세요 — Orca를 떠나지 않고 리뷰하고 수정하고 커밋할 수 있습니다.

[문서 →](../site/content/docs/review/annotate-ai-diff.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/review/annotate-ai-diff.mdx"><picture><source srcset="../site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-08.poster.jpg" alt="AI가 생성한 diff에 주석 달기" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### 에이전트로 파일 드래그

어디서나 자동 저장되는 VS Code 에디터 — 파일이나 이미지를 에이전트 프롬프트로 바로 드래그하세요.

[문서 →](../site/content/docs/editing/file-explorer.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/editing/file-explorer.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-07.poster.jpg" alt="파일과 이미지를 에이전트 프롬프트로 드래그" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

에이전트도 Orca를 조작할 수 있습니다 — `orca worktree create`, `snapshot`, `click`, `fill`로 모든 워크플로를 스크립팅하세요.

[문서 →](../site/content/docs/cli/overview.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/cli/overview.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-09.poster.jpg" alt="CLI에서 Orca 스크립팅" width="100%" /></picture></a>
</td>
</tr>
</table>

**그 밖에 기본으로 제공되는 기능:**

- **[빠른 열기](../site/content/docs/model/quick-open.mdx)** — 작업 흐름을 벗어나지 않고 worktree, 파일, 에이전트, 커맨드, 리포지토리 컨텍스트를 검색하세요.
- **[계정 전환 및 사용량 추적](../site/content/docs/agents/usage-tracking.mdx)** — Claude와 Codex의 사용량과 rate limit 초기화 시점을 확인하고, 다시 로그인하지 않고 계정을 바로 전환하세요.
- **[풍부한 리포지토리 미리보기](../site/content/docs/editing/markdown.mdx)** — Markdown, 이미지, PDF, 리포지토리 문서를 워크스페이스에서 미리 볼 수 있습니다.
- **[Computer Use](../site/content/docs/cli/computer-use.mdx)** — 워크플로에 실제 상호작용이 필요할 때 에이전트가 데스크톱 앱과 화면에 보이는 UI를 직접 조작하게 하세요.
- **[알림과 읽지 않음 상태](../site/content/docs/notifications.mdx)** — 에이전트가 완료되거나 주의가 필요할 때 알림을 받고, 스레드를 읽지 않음으로 표시해 나중에 다시 확인하세요.
- **그리고 훨씬 더 많은 기능** — 새로운 기능이 매일 출시되므로 이 목록은 늘 한 발 늦습니다. 진짜 기능은 [체인지로그](https://github.com/stablyai/orca/releases)에서 확인하세요.

---

## 지원 에이전트

**모든 CLI 에이전트**와 함께 작동합니다 — 터미널에서 실행되는 에이전트라면 Orca에서도 실행됩니다.

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
  <a href="https://mimo.xiaomi.com/coder"><kbd><img src="https://www.google.com/s2/favicons?domain=mimo.xiaomi.com&sz=64" alt="MiMo Code logo" width="16" valign="middle" /> MiMo Code</kbd></a> &nbsp;
  <a href="https://ampcode.com/manual#install"><kbd><img src="https://www.google.com/s2/favicons?domain=ampcode.com&sz=64" alt="Amp logo" width="16" valign="middle" /> Amp</kbd></a> &nbsp;
  <a href="https://openclaude.gitlawb.com/"><kbd><img src="../../resources/openclaude-logo.png" alt="OpenClaude logo" width="16" valign="middle" /> OpenClaude</kbd></a> &nbsp;
  <a href="https://antigravity.google/docs/cli-overview"><kbd><img src="https://www.google.com/s2/favicons?domain=antigravity.google&sz=64" alt="Antigravity logo" width="16" valign="middle" /> Antigravity</kbd></a> &nbsp;
  <a href="https://pi.dev"><kbd><img src="https://pi.dev/favicon.svg" alt="Pi logo" width="16" valign="middle" /> Pi</kbd></a> &nbsp;
  <a href="https://omp.sh"><kbd><img src="https://omp.sh/favicon.svg" alt="oh-my-pi logo" width="16" valign="middle" /> oh-my-pi</kbd></a> &nbsp;
  <a href="https://hermes-agent.nousresearch.com/docs/"><kbd><img src="https://www.google.com/s2/favicons?domain=nousresearch.com&sz=64" alt="Hermes Agent logo" width="16" valign="middle" /> Hermes Agent</kbd></a> &nbsp;
  <a href="https://devin.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=devin.ai&sz=64" alt="Devin logo" width="16" valign="middle" /> Devin</kbd></a> &nbsp;
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

## 설치

이 포크는 사전 빌드된 다운로드, Homebrew cask, 자동 업데이트를 제공하지 않습니다. 소스에서 빌드하고, 업데이트는 업스트림을 병합한 뒤 다시 빌드합니다([업스트림 동기화 가이드](../reference/local-only-upstream-sync.md)).

```bash
pnpm install

# macOS (x64와 arm64를 모두 빌드하므로 먼저 두 CPU용 의존성을 설치)
pnpm install:release
pnpm build:mac

# Linux
pnpm build:linux

# Windows
pnpm build:win
```

패키징 없이 소스에서 실행하려면 `pnpm dev`를 사용하세요. 기여 방법과 플랫폼별 사전 요구 사항은 [CONTRIBUTING.md](../../.github/CONTRIBUTING.md)를 참고하세요. `docs/site/content/docs/`의 문서는 업스트림의 문서 사이트입니다. 이 포크는 이를 게시하지 않으므로 저장소 안의 페이지를 직접 읽으세요.

---

## 개인정보

Orca 자체 코드는 [아키텍처 문서](../reference/local-only-architecture.md)에 나열된 예외를 제외하고 클라우드 서비스에 연결하지 않습니다. 예외는 내 원격 저장소에 대한 `git` CLI, 내장 브라우저 창, OS 브라우저로 넘기는 링크, 그리고 직접 시작하는 음성 모델과 scrcpy 다운로드입니다. 새로 설치하면 로컬 사용 기록이 기본으로 켜져 있습니다. 검증된 제품 이벤트가 앱 `logs` 폴더의 `telemetry.ndjson`에 추가되며, 크기 제한이 있고 업로드되지 않습니다. 설정 → 개인정보에서 끄거나 `ORCA_TELEMETRY_DISABLED=1`로 실행하면 꺼집니다. 자세한 내용은 [개인정보 및 텔레메트리](../site/content/docs/telemetry.mdx)를 참고하세요. Orca에서 실행하는 에이전트 CLI(Claude Code, Codex 등)는 각자의 벤더에 연결하며, 그 트래픽은 Orca의 범위 밖입니다.

---

## 개발

기여하거나 로컬에서 실행하고 싶으신가요? [CONTRIBUTING.md](../../.github/CONTRIBUTING.md)를 확인하고, 변경을 올리기 전에 `pnpm run check:local-only`를 실행하세요. 업스트림: [stablyai/orca](https://github.com/stablyai/orca).

## 라이선스

Orca는 [MIT 라이선스](../../LICENSE)에 따라 자유롭게 사용할 수 있는 오픈 소스입니다.

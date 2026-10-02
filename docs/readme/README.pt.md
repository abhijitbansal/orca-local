<h1 align="center">
  <img src="../../resources/build/icon.png" alt="Orca" width="64" valign="middle" /> Orca
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="Licença: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="Plataformas compatíveis: macOS, Windows e Linux" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a></sub>
</p>

<p align="center">
  <strong>O orquestrador de IA para builders 100x.</strong><br/>
  Rode Codex, ClaudeCode, OpenCode ou Pi lado a lado — cada um em seu próprio worktree, acompanhado em um só lugar.
</p>

> **Fork somente local.** Este fork de [stablyai/orca](https://github.com/stablyai/orca) roda inteiramente na sua máquina. Não há contas na nuvem, app móvel, atualização automática, envio de telemetria nem escuta de rede. Um registro de uso local, ativado por padrão em instalações novas e desativável com um único botão, é gravado em um arquivo e não é enviado a lugar nenhum. O Git funciona pelo seu próprio CLI `git`, contra os seus próprios remotos. Os invariantes, os sockets que restam e os poucos lugares que ainda acessam a rede estão em [docs/reference/local-only-architecture.md](../reference/local-only-architecture.md). Para trazer uma nova versão do upstream, veja [docs/reference/local-only-upstream-sync.md](../reference/local-only-upstream-sync.md).

## Recursos

<table>
<tr>
<td width="50%" valign="middle">

### Worktrees paralelos

Envie um mesmo prompt para cinco agentes, cada um em seu próprio worktree git isolado — compare os resultados e faça merge do vencedor.

[Docs →](../site/content/docs/model/worktrees.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/model/worktrees.mdx"><picture><source srcset="../site/public/docs/tab-split.gif" type="image/gif"><img src="../site/public/docs/posters/tab-split.jpg" alt="Orquestração de worktrees paralelos" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Terminais divididos

Terminais no nível do Ghostty com renderização WebGL, divisões infinitas e scrollback que sobrevive a reinicializações.

[Docs →](../site/content/docs/terminal.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/terminal.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-02.poster.jpg" alt="Terminais divididos" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Modo Design

Clique em qualquer elemento de UI em uma janela real do Chromium para enviar HTML, CSS e uma captura recortada direto para o prompt do seu agente.

[Docs →](../site/content/docs/browser/design-mode.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/browser/design-mode.mdx"><picture><source srcset="../site/public/docs/orca-design-mode.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-05.poster.jpg" alt="Navegador integrado e Modo Design" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Worktrees por SSH

Execute agentes em uma máquina remota potente com edição completa de arquivos, git e terminais — com reconexão automática e encaminhamento de portas incluídos.

[Docs →](../site/content/docs/ssh.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/ssh.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-06.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-06.poster.jpg" alt="Worktrees remotos por SSH" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Anotar diffs de IA

Deixe comentários em qualquer linha de diff e envie-os de volta ao agente — revise, edite e faça commit sem sair do Orca.

[Docs →](../site/content/docs/review/annotate-ai-diff.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/review/annotate-ai-diff.mdx"><picture><source srcset="../site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-08.poster.jpg" alt="Anotar diffs gerados por IA" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Arraste arquivos para agentes

O editor do VS Code com salvamento automático em todos os lugares — arraste arquivos ou imagens direto para o prompt de um agente.

[Docs →](../site/content/docs/editing/file-explorer.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/editing/file-explorer.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-07.poster.jpg" alt="Arraste arquivos e imagens para o prompt de um agente" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

Agentes também controlam o Orca — automatize qualquer fluxo de trabalho com `orca worktree create`, `snapshot`, `click` e `fill`.

[Docs →](../site/content/docs/cli/overview.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/cli/overview.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-09.poster.jpg" alt="Automatize o Orca pela CLI" width="100%" /></picture></a>
</td>
</tr>
</table>

**Também incluído:**

- **[Abertura rápida](../site/content/docs/model/quick-open.mdx)** — Pesquise entre worktrees, arquivos, agentes, comandos e contexto do repositório sem sair do seu fluxo.
- **[Troca de contas e acompanhamento de uso](../site/content/docs/agents/usage-tracking.mdx)** — Veja o uso de Claude e Codex, os reinícios de limites e troque contas instantaneamente sem fazer login de novo.
- **[Prévias ricas do repositório](../site/content/docs/editing/markdown.mdx)** — Pré-visualize Markdown, imagens, PDFs e documentos do repositório no workspace.
- **[Computer Use](../site/content/docs/cli/computer-use.mdx)** — Deixe agentes operarem apps de desktop e UI visível quando um fluxo de trabalho precisa de interação real.
- **[Notificações e estado de não lido](../site/content/docs/notifications.mdx)** — Saiba quando um agente termina ou precisa de atenção, depois marque conversas como não lidas para voltar depois.
- **E muito, muito mais** — lançamos novidades todos os dias, então esta lista vive atrasada. O [changelog](https://github.com/stablyai/orca/releases) é a lista real de recursos.

---

## Agentes compatíveis

Funciona com **qualquer agente CLI** — se roda em um terminal, roda no Orca.

<p>
  <a href="https://docs.anthropic.com/claude/docs/claude-code"><kbd><img src="../assets/claude-logo.svg" alt="Logotipo do Claude Code" width="16" valign="middle" /> Claude Code</kbd></a> &nbsp;
  <a href="https://github.com/openai/codex"><kbd><img src="https://www.google.com/s2/favicons?domain=openai.com&sz=64" alt="Logotipo do Codex" width="16" valign="middle" /> Codex</kbd></a> &nbsp;
  <a href="https://x.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=x.ai&sz=64" alt="Logotipo do Grok" width="16" valign="middle" /> Grok</kbd></a> &nbsp;
  <a href="https://cursor.com/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=cursor.com&sz=64" alt="Logotipo do Cursor" width="16" valign="middle" /> Cursor</kbd></a> &nbsp;
  <a href="https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=github.com&sz=64" alt="Logotipo do GitHub Copilot" width="16" valign="middle" /> GitHub Copilot</kbd></a> &nbsp;
  <a href="https://dev.meta.ai/docs/muse-code"><kbd><img src="../../src/shared/agent-icons/muse.png" alt="Logotipo do Muse" width="16" valign="middle" /> Muse</kbd></a> &nbsp;
  <a href="https://deepseek-harness.github.io/deepseek-harness/"><kbd><img src="../../src/shared/agent-icons/dsh.png" alt="DeepSeek Harness logo" width="16" valign="middle" /> DeepSeek Harness</kbd></a> &nbsp;
  <a href="https://zcode.z.ai/en/docs"><kbd><img src="../../src/shared/agent-icons/zcode.png" alt="Logotipo do ZCode" width="16" valign="middle" /> ZCode</kbd></a> &nbsp;
  <a href="https://opencode.ai/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=opencode.ai&sz=64" alt="Logotipo do OpenCode" width="16" valign="middle" /> OpenCode</kbd></a> &nbsp;
  <a href="https://mimo.xiaomi.com/coder"><kbd><img src="https://www.google.com/s2/favicons?domain=mimo.xiaomi.com&sz=64" alt="Logotipo do MiMo Code" width="16" valign="middle" /> MiMo Code</kbd></a> &nbsp;
  <a href="https://ampcode.com/manual#install"><kbd><img src="https://www.google.com/s2/favicons?domain=ampcode.com&sz=64" alt="Logotipo do Amp" width="16" valign="middle" /> Amp</kbd></a> &nbsp;
  <a href="https://openclaude.gitlawb.com/"><kbd><img src="../../resources/openclaude-logo.png" alt="Logotipo do OpenClaude" width="16" valign="middle" /> OpenClaude</kbd></a> &nbsp;
  <a href="https://antigravity.google/docs/cli-overview"><kbd><img src="https://www.google.com/s2/favicons?domain=antigravity.google&sz=64" alt="Logotipo do Antigravity" width="16" valign="middle" /> Antigravity</kbd></a> &nbsp;
  <a href="https://pi.dev"><kbd><img src="https://pi.dev/favicon.svg" alt="Logotipo do Pi" width="16" valign="middle" /> Pi</kbd></a> &nbsp;
  <a href="https://omp.sh"><kbd><img src="https://omp.sh/favicon.svg" alt="Logotipo do oh-my-pi" width="16" valign="middle" /> oh-my-pi</kbd></a> &nbsp;
  <a href="https://hermes-agent.nousresearch.com/docs/"><kbd><img src="https://www.google.com/s2/favicons?domain=nousresearch.com&sz=64" alt="Logotipo do Hermes Agent" width="16" valign="middle" /> Hermes Agent</kbd></a> &nbsp;
  <a href="https://devin.ai/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=devin.ai&sz=64" alt="Logotipo do Devin" width="16" valign="middle" /> Devin</kbd></a> &nbsp;
  <a href="https://block.github.io/goose/docs/quickstart/"><kbd><img src="https://www.google.com/s2/favicons?domain=goose-docs.ai&sz=64" alt="Logotipo do Goose" width="16" valign="middle" /> Goose</kbd></a> &nbsp;
  <a href="https://docs.augmentcode.com/cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=augmentcode.com&sz=64" alt="Logotipo do Auggie" width="16" valign="middle" /> Auggie</kbd></a> &nbsp;
  <a href="https://github.com/autohandai/code-cli"><kbd><img src="https://www.google.com/s2/favicons?domain=autohand.ai&sz=64" alt="Logotipo do Autohand Code" width="16" valign="middle" /> Autohand Code</kbd></a> &nbsp;
  <a href="https://github.com/charmbracelet/crush"><kbd><img src="https://www.google.com/s2/favicons?domain=charm.sh&sz=64" alt="Logotipo do Charm" width="16" valign="middle" /> Charm</kbd></a> &nbsp;
  <a href="https://docs.cline.bot/cline-cli/overview"><kbd><img src="https://www.google.com/s2/favicons?domain=cline.bot&sz=64" alt="Logotipo do Cline" width="16" valign="middle" /> Cline</kbd></a> &nbsp;
  <a href="https://www.codebuff.com/docs/help/quick-start"><kbd><img src="https://www.google.com/s2/favicons?domain=codebuff.com&sz=64" alt="Logotipo do Codebuff" width="16" valign="middle" /> Codebuff</kbd></a> &nbsp;
  <a href="https://freebuff.com/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=freebuff.com&sz=64" alt="Logotipo do Freebuff" width="16" valign="middle" /> Freebuff</kbd></a> &nbsp;
  <a href="https://commandcode.ai/docs/quickstart"><kbd><img src="https://www.google.com/s2/favicons?domain=commandcode.ai&sz=64" alt="Logotipo do Command Code" width="16" valign="middle" /> Command Code</kbd></a> &nbsp;
  <a href="https://docs.continue.dev/guides/cli"><kbd><img src="https://www.google.com/s2/favicons?domain=continue.dev&sz=64" alt="Logotipo do Continue" width="16" valign="middle" /> Continue</kbd></a> &nbsp;
  <a href="https://docs.factory.ai/cli/getting-started/quickstart"><kbd><img src="../assets/droid-logo.svg" alt="Logotipo do Droid" width="16" valign="middle" /> Droid</kbd></a> &nbsp;
  <a href="https://kilo.ai/docs/cli"><kbd><img src="https://raw.githubusercontent.com/Kilo-Org/kilocode/main/packages/kilo-vscode/assets/icons/kilo-light.svg" alt="Logotipo do Kilocode" width="16" valign="middle" /> Kilocode</kbd></a> &nbsp;
  <a href="https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html"><kbd><img src="https://www.google.com/s2/favicons?domain=moonshot.cn&sz=64" alt="Logotipo do Kimi" width="16" valign="middle" /> Kimi</kbd></a> &nbsp;
  <a href="https://kiro.dev/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=kiro.dev&sz=64" alt="Logotipo do Kiro" width="16" valign="middle" /> Kiro</kbd></a> &nbsp;
  <a href="https://github.com/mistralai/mistral-vibe"><kbd><img src="https://www.google.com/s2/favicons?domain=mistral.ai&sz=64" alt="Logotipo do Mistral Vibe" width="16" valign="middle" /> Mistral Vibe</kbd></a> &nbsp;
  <a href="https://github.com/QwenLM/qwen-code"><kbd><img src="https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=64" alt="Logotipo do Qwen Code" width="16" valign="middle" /> Qwen Code</kbd></a> &nbsp;
  <a href="https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/"><kbd><img src="https://www.google.com/s2/favicons?domain=atlassian.com&sz=64" alt="Logotipo do Rovo Dev" width="16" valign="middle" /> Rovo Dev</kbd></a> &nbsp;
  <kbd>+ qualquer agente CLI</kbd>
</p>

---

## Instalação

Este fork não oferece downloads pré-compilados, cask do Homebrew nem atualização automática. Compile a partir do código-fonte e atualize mesclando o upstream e recompilando ([guia de sincronização com o upstream](../reference/local-only-upstream-sync.md)).

```bash
pnpm install

# macOS (compila x64 e arm64, então instale antes as duas variantes de CPU)
pnpm install:release
pnpm build:mac

# Linux
pnpm build:linux

# Windows
pnpm build:win
```

Para rodar a partir do código-fonte sem empacotar, use `pnpm dev`. Como contribuir e os pré-requisitos por plataforma estão em [CONTRIBUTING.md](../../.github/CONTRIBUTING.md). A documentação em `docs/site/content/docs/` é o site de documentação do upstream. Este fork não o publica; leia as páginas diretamente no repositório.

---

## Privacidade

O código do próprio Orca não se conecta a nenhum serviço na nuvem, exceto pelas exceções listadas nas [notas de arquitetura](../reference/local-only-architecture.md): o seu CLI `git` contra os seus próprios remotos, o painel de navegador embutido, links entregues ao navegador do sistema, downloads de modelos de voz e de scrcpy que você inicia e SSH. Em instalações novas há um registro de uso local ativado por padrão: os eventos de produto validados são acrescentados a `telemetry.ndjson` na pasta `logs` do app, com tamanho limitado e sem nunca serem enviados. Desative em Configurações → Privacidade ou inicie com `ORCA_TELEMETRY_DISABLED=1`. Veja [Privacidade e telemetria](../site/content/docs/telemetry.mdx). Os CLIs de agentes que você executa no Orca (Claude Code, Codex, ...) falam com os próprios fornecedores; esse tráfego é deles.

---

## Desenvolvimento

Quer contribuir ou rodar localmente? Veja [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) e execute `pnpm run check:local-only` antes de abrir uma alteração. Upstream: [stablyai/orca](https://github.com/stablyai/orca).

## Licença

Orca é livre e de código aberto sob a [Licença MIT](../../LICENSE).

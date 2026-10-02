<h1 align="center">
  <img src="../../resources/build/icon.png" alt="Orca" width="64" valign="middle" /> Orca
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="Licencia: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="Plataformas compatibles: macOS, Windows y Linux" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.fr.md">Français</a> · <a href="README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>El orquestador de IA para desarrolladores 100x.</strong><br/>
  Ejecuta Codex, Claude Code, OpenCode u Pi en paralelo — cada uno en su propio worktree, supervisados desde un solo lugar.
</p>

> **Fork solo local.** Este fork de [stablyai/orca](https://github.com/stablyai/orca) se ejecuta por completo en tu máquina. No hay cuentas en la nube, ni app móvil, ni actualización automática, ni envío de telemetría, ni escucha de red. Un registro de uso local, activado por defecto en instalaciones nuevas y desactivable con un solo interruptor, se escribe en un archivo y no se envía a ningún sitio. Git funciona con tu propio CLI `git` contra tus propios remotos. Los invariantes, los sockets que quedan y los pocos lugares que aún acceden a la red están en [docs/reference/local-only-architecture.md](../reference/local-only-architecture.md). Para incorporar una nueva versión de upstream, consulta [docs/reference/local-only-upstream-sync.md](../reference/local-only-upstream-sync.md).

## Características

<table>
<tr>
<td width="50%" valign="middle">

### Worktrees en paralelo

Lanza un mismo prompt a cinco agentes, cada uno en su propio worktree de git aislado — compara los resultados y haz merge del ganador.

[Docs →](../site/content/docs/model/worktrees.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/model/worktrees.mdx"><picture><source srcset="../site/public/docs/tab-split.gif" type="image/gif"><img src="../site/public/docs/posters/tab-split.jpg" alt="Orquestación de worktrees en paralelo" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Terminales divididas

Terminales de nivel Ghostty con renderizado WebGL, divisiones infinitas y un scrollback que sobrevive a los reinicios.

[Docs →](../site/content/docs/terminal.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/terminal.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-02.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-02.poster.jpg" alt="Terminales divididas" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Modo diseño

Haz clic en cualquier elemento de UI en una ventana real de Chromium para enviar su HTML, su CSS y una captura recortada directo al prompt de tu agente.

[Docs →](../site/content/docs/browser/design-mode.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/browser/design-mode.mdx"><picture><source srcset="../site/public/docs/orca-design-mode.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-05.poster.jpg" alt="Navegador integrado y modo diseño" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Worktrees por SSH

Ejecuta agentes en una máquina remota potente con edición completa de archivos, git y terminales — con reconexión automática y reenvío de puertos incluidos.

[Docs →](../site/content/docs/ssh.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/ssh.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-06.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-06.poster.jpg" alt="Worktrees remotos por SSH" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Anotar diffs de IA

Deja comentarios en cualquier línea de un diff y envíalos de vuelta al agente — revisa, edita y haz commit sin salir de Orca.

[Docs →](../site/content/docs/review/annotate-ai-diff.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/review/annotate-ai-diff.mdx"><picture><source srcset="../site/public/docs/annotate-ai-diff.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-08.poster.jpg" alt="Anotar diffs generados por IA" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Arrastra archivos a los agentes

El editor de VS Code con autoguardado en todas partes — arrastra archivos o imágenes directo al prompt de un agente.

[Docs →](../site/content/docs/editing/file-explorer.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/editing/file-explorer.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-07.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-07.poster.jpg" alt="Arrastra archivos e imágenes al prompt de un agente" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

Los agentes también manejan Orca — automatiza cualquier flujo de trabajo con `orca worktree create`, `snapshot`, `click` y `fill`.

[Docs →](../site/content/docs/cli/overview.mdx)

</td>
<td width="50%">
  <a href="../site/content/docs/cli/overview.mdx"><picture><source srcset="../../resources/onboarding/feature-wall/tile-09.gif" type="image/gif"><img src="../../resources/onboarding/feature-wall/tile-09.poster.jpg" alt="Automatiza Orca desde la CLI" width="100%" /></picture></a>
</td>
</tr>
</table>

**También incluye:**

- **[Apertura rápida](../site/content/docs/model/quick-open.mdx)** — Busca entre worktrees, archivos, agentes, comandos y contexto del repo sin salir de tu flujo.
- **[Cambio de cuenta y seguimiento de uso](../site/content/docs/agents/usage-tracking.mdx)** — Consulta el uso de Claude y Codex y los reinicios de límites de uso, y cambia de cuenta al instante sin volver a iniciar sesión.
- **[Previews ricos del repo](../site/content/docs/editing/markdown.mdx)** — Previsualiza Markdown, imágenes, PDFs y documentos del repo en el workspace.
- **[Computer Use](../site/content/docs/cli/computer-use.mdx)** — Deja que los agentes manejen apps de escritorio y UI visible cuando un flujo de trabajo necesita interacción real.
- **[Notificaciones y estado de no leído](../site/content/docs/notifications.mdx)** — Entérate cuando un agente termine o necesite tu atención, y marca hilos como no leídos para retomarlos después.
- **Y muchas, muchas más** — lanzamos a diario, así que esta lista siempre va atrasada. El [changelog](https://github.com/stablyai/orca/releases) es la verdadera lista de funciones.

---

## Agentes compatibles

Funciona con **cualquier agente CLI** — si corre en una terminal, corre en Orca.

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

## Instalación

Este fork no ofrece descargas precompiladas, ni cask de Homebrew, ni actualización automática. Compílalo desde el código fuente y actualiza fusionando upstream y volviendo a compilar ([guía de sincronización con upstream](../reference/local-only-upstream-sync.md)).

```bash
pnpm install

# macOS (compila x64 y arm64, así que instala antes ambas variantes de CPU)
pnpm install:release
pnpm build:mac

# Linux
pnpm build:linux

# Windows
pnpm build:win
```

Para ejecutar desde el código fuente sin empaquetar, usa `pnpm dev`. Cómo contribuir y los requisitos de cada plataforma están en [CONTRIBUTING.md](../../.github/CONTRIBUTING.md). La documentación de `docs/site/content/docs/` es el sitio de documentación de upstream. Este fork no lo publica; lee las páginas directamente en el repositorio.

---

## Privacidad

El código propio de Orca no se conecta a ningún servicio en la nube, salvo las excepciones de las [notas de arquitectura](../reference/local-only-architecture.md): tu CLI `git` contra tus propios remotos, el panel de navegador integrado, los enlaces que se abren en el navegador del sistema, las descargas de modelos de voz y de scrcpy que inicias tú y SSH. En instalaciones nuevas hay un registro de uso local activado por defecto: los eventos de producto validados se añaden a `telemetry.ndjson` en la carpeta `logs` de la app, con tamaño limitado y sin subirse nunca. Desactívalo en Ajustes → Privacidad o inicia con `ORCA_TELEMETRY_DISABLED=1`. Consulta [Privacidad y telemetría](../site/content/docs/telemetry.mdx). Los CLI de agentes que ejecutas en Orca (Claude Code, Codex, ...) se conectan con sus propios proveedores; ese tráfico es suyo.

---

## Desarrollo

¿Quieres contribuir o ejecutar Orca localmente? Consulta [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) y ejecuta `pnpm run check:local-only` antes de abrir un cambio. Upstream: [stablyai/orca](https://github.com/stablyai/orca).

## Licencia

Orca es libre y de código abierto bajo la [Licencia MIT](../../LICENSE).

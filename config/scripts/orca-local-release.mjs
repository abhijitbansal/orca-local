#!/usr/bin/env node
// Release helpers for .github/workflows/orca-local-release.yml (and manual releases):
//   next-tag            print the next v<version>-local.<n> tag
//   notes --tag <tag>   write release notes for HEAD to stdout
//   assets <dir>        copy dist DMGs to <dir> under their public names + SHA256SUMS.txt

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ARCHES = ['arm64', 'x64']
// Why rename: dist keeps upstream's orca-macos-* names so upstream scripts keep working;
// the public asset says which app it is.
const publicDmgName = (arch) => `orca-local-macos-${arch}.dmg`

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextReleaseTag(version, existingTags) {
  const pattern = new RegExp(`^v${escapeRegExp(version)}-local\\.(\\d+)$`)
  const highest = existingTags.reduce((max, tag) => {
    const match = pattern.exec(tag)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `v${version}-local.${highest + 1}`
}

export function formatReleaseNotes({ tag, previousTag, commits, repo, commit, summary }) {
  const lines = []
  if (summary) {
    lines.push(summary.trim(), '')
  }
  lines.push(
    '## Download',
    '',
    `- Apple Silicon (M-series) Macs: \`${publicDmgName('arm64')}\``,
    `- Intel Macs: \`${publicDmgName('x64')}\``,
    '',
    'Open the DMG and drag **Orca Local** to Applications. The app and the DMG are signed with a Developer ID and notarized by Apple, so macOS opens them without a warning. `SHA256SUMS.txt` lists the checksums.',
    '',
    'Orca Local installs side by side with upstream Orca and keeps its own profile in `~/Library/Application Support/orca-local`.',
    ''
  )
  if (commits.length > 0) {
    lines.push('## Changes', '')
    for (const { sha, subject } of commits) {
      lines.push(`- ${subject} (${sha})`)
    }
    lines.push('')
  }
  if (previousTag) {
    lines.push(`**Full changelog:** https://github.com/${repo}/compare/${previousTag}...${tag}`, '')
  }
  lines.push(`Built from \`${commit}\`.`)
  return `${lines.join('\n')}\n`
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function localReleaseTags() {
  return git(['tag', '--list', 'v*-local.*', '--sort=-creatordate']).split('\n').filter(Boolean)
}

function readVersion() {
  return JSON.parse(readFileSync('package.json', 'utf8')).version
}

function readArg(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? null : (args[index + 1] ?? null)
}

function commandNotes(args) {
  const tag = readArg(args, '--tag')
  if (!tag) {
    throw new Error('notes needs --tag <tag>.')
  }
  const summaryFile = readArg(args, '--summary-file')
  const previousTag = localReleaseTags().find((candidate) => candidate !== tag) ?? null
  // Why no full log for the first release: HEAD carries every upstream commit.
  const commits = previousTag
    ? git(['log', `${previousTag}..HEAD`, '--no-merges', '--format=%h%x09%s'])
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [sha, ...subject] = line.split('\t')
          return { sha, subject: subject.join('\t') }
        })
    : []
  process.stdout.write(
    formatReleaseNotes({
      tag,
      previousTag,
      commits,
      repo: process.env.GITHUB_REPOSITORY ?? 'abhijitbansal/orca-local',
      commit: git(['rev-parse', 'HEAD']),
      summary: summaryFile ? readFileSync(summaryFile, 'utf8') : undefined
    })
  )
}

function commandAssets(args) {
  const outDir = args[0]
  if (!outDir) {
    throw new Error('assets needs an output directory.')
  }
  mkdirSync(outDir, { recursive: true })
  const sums = ARCHES.map((arch) => {
    const target = join(outDir, publicDmgName(arch))
    copyFileSync(join('dist', `orca-macos-${arch}.dmg`), target)
    const digest = createHash('sha256').update(readFileSync(target)).digest('hex')
    return `${digest}  ${publicDmgName(arch)}`
  })
  writeFileSync(join(outDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`)
}

function main(args) {
  const [command, ...rest] = args
  if (command === 'next-tag') {
    process.stdout.write(`${nextReleaseTag(readVersion(), localReleaseTags())}\n`)
  } else if (command === 'notes') {
    commandNotes(rest)
  } else if (command === 'assets') {
    commandAssets(rest)
  } else {
    throw new Error('Usage: orca-local-release.mjs next-tag | notes --tag <tag> | assets <dir>')
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`[orca-local-release] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

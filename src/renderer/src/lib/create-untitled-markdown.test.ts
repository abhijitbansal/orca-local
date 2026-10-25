import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createUntitledMarkdownFile,
  createUntitledMarkdownFileWithTemplateSelection
} from './create-untitled-markdown'
import { subscribeMarkdownTemplatePicker } from './markdown-template-picker-request'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import { getDiskBaselineSignature } from '../../../shared/disk-baseline-signature'

const LOCAL: RuntimeClientTarget = { kind: 'local' }

describe('createUntitledMarkdownFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects captured ownership without a current-generation assertion', async () => {
    await expect(
      createUntitledMarkdownFile('/repo', 'wt-1', undefined, LOCAL, {
        operationProvenance: {} as never
      })
    ).rejects.toThrow("Couldn't verify which host owns this file")
  })

  it('retries with the next untitled name when createFile loses the EEXIST race', async () => {
    const pathExists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
    const stat = vi.fn(async (args: { filePath: string }) => {
      if (args.filePath.endsWith('untitled.md')) {
        return { size: 0, isDirectory: false, mtime: 1 }
      }
      throw new Error('ENOENT: no such file')
    })
    const createFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('EEXIST: file already exists'))
      .mockResolvedValueOnce(undefined)

    vi.stubGlobal('window', {
      api: {
        shell: { pathExists: vi.fn() },
        fs: { createFile, pathExists, stat }
      }
    })

    await expect(createUntitledMarkdownFile('/repo', 'wt-1', undefined, LOCAL)).resolves.toEqual({
      filePath: '/repo/untitled-3.md',
      relativePath: 'untitled-3.md',
      worktreeId: 'wt-1',
      language: 'markdown',
      isUntitled: true,
      mode: 'edit'
    })

    expect(createFile).toHaveBeenNthCalledWith(1, {
      filePath: '/repo/untitled-2.md',
      connectionId: undefined,
      expectedExecutionHostId: 'local'
    })
    expect(createFile).toHaveBeenNthCalledWith(2, {
      filePath: '/repo/untitled-3.md',
      connectionId: undefined,
      expectedExecutionHostId: 'local'
    })
    expect(pathExists).toHaveBeenCalledTimes(3)
  })

  it.each(['original text {{title}}', ''])(
    'recovers exact text into a collision-safe new path (%j)',
    async (content) => {
      const pathExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false)
      const createFile = vi
        .fn()
        .mockRejectedValueOnce(new Error('EEXIST'))
        .mockResolvedValue(undefined)
      const writeFile = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('window', { api: { fs: { pathExists, createFile, writeFile } } })
      await expect(
        createUntitledMarkdownFile('/active', 'wt', undefined, LOCAL, {
          recoveredDocument: { originalPath: 'C:\\removed\\note.ts', content }
        })
      ).resolves.toMatchObject({
        filePath: '/active/note (recovered 3).ts',
        relativePath: 'note (recovered 3).ts',
        language: 'typescript',
        isUntitled: true,
        deleteUntouchedOnClose: false
      })
      expect(writeFile).toHaveBeenCalledTimes(1)
      expect(writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/active/note (recovered 3).ts',
          content,
          diskPrecondition: { expectedSignature: getDiskBaselineSignature('') }
        })
      )
      expect(createFile).not.toHaveBeenCalledWith(
        expect.objectContaining({ filePath: 'C:\\removed\\note.ts' })
      )
    }
  )

  it('never overwrites or deletes a file another writer filled after the create', async () => {
    const createFile = vi.fn().mockResolvedValue(undefined)
    const writeFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, diskConflict: 'changed' })
      .mockResolvedValue(undefined)
    const deletePath = vi.fn()
    vi.stubGlobal('window', {
      api: {
        fs: { pathExists: vi.fn().mockResolvedValue(false), createFile, writeFile, deletePath }
      }
    })
    await expect(
      createUntitledMarkdownFile('/active', 'wt', undefined, LOCAL, {
        recoveredDocument: { originalPath: '/removed/a.md', content: 'text' }
      })
    ).resolves.toMatchObject({ filePath: '/active/a (recovered 2).md' })
    expect(writeFile).toHaveBeenCalledTimes(2)
    expect(deletePath).not.toHaveBeenCalled()
  })

  it('keeps the created path when a recovered write fails', async () => {
    const deletePath = vi.fn()
    vi.stubGlobal('window', {
      api: {
        fs: {
          pathExists: vi.fn().mockResolvedValue(false),
          createFile: vi.fn().mockResolvedValue(undefined),
          writeFile: vi.fn().mockRejectedValue(new Error('disk full')),
          deletePath
        }
      }
    })
    await expect(
      createUntitledMarkdownFile('/active', 'wt', undefined, LOCAL, {
        recoveredDocument: { originalPath: '/removed/a.md', content: 'text' }
      })
    ).rejects.toThrow('disk full')
    expect(deletePath).not.toHaveBeenCalled()
  })

  it('throws a descriptive error when untitled names are exhausted', async () => {
    const pathExists = vi.fn(async () => true)
    const stat = vi.fn().mockResolvedValue({ size: 0, isDirectory: false, mtime: 1 })
    const createFile = vi.fn()

    vi.stubGlobal('window', {
      api: {
        shell: { pathExists: vi.fn() },
        fs: { createFile, pathExists, stat }
      }
    })

    await expect(createUntitledMarkdownFile('/repo', 'wt-1', undefined, LOCAL)).rejects.toThrow(
      'Unable to create untitled markdown file after 100 attempts.'
    )

    expect(createFile).not.toHaveBeenCalled()
    expect(pathExists).toHaveBeenCalledTimes(100)
  })

  it('writes selected template content with placeholders after creating the untitled file', async () => {
    const stat = vi.fn().mockRejectedValue(new Error('ENOENT: no such file'))
    const createFile = vi.fn().mockResolvedValueOnce(undefined)
    const readFile = vi.fn().mockResolvedValueOnce({
      content: '# {{ title }}\n{{date}}\n{{filename}}\n',
      isBinary: false
    })
    const writeFile = vi.fn().mockResolvedValueOnce(undefined)

    vi.stubGlobal('window', {
      api: {
        shell: { pathExists: vi.fn() },
        fs: { createFile, pathExists: vi.fn().mockResolvedValue(false), readFile, stat, writeFile }
      }
    })

    await expect(
      createUntitledMarkdownFile('/repo', 'wt-1', undefined, LOCAL, {
        now: new Date(2026, 4, 29, 7, 5),
        template: {
          id: '.orca/templates/daily.md',
          name: 'Daily',
          filePath: '/repo/.orca/templates/daily.md',
          relativePath: '.orca/templates/daily.md',
          templateRelativePath: 'daily.md',
          basename: 'daily.md'
        }
      })
    ).resolves.toMatchObject({
      filePath: '/repo/untitled.md',
      relativePath: 'untitled.md',
      deleteUntouchedOnClose: false
    })

    expect(readFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/repo/.orca/templates/daily.md' })
    )
    expect(createFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/repo/untitled.md' })
    )
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/repo/untitled.md',
        content: '# Untitled\n2026-05-29\nuntitled.md\n'
      })
    )
  })

  it('discovers templates before creating a new markdown file and applies the selected template', async () => {
    const readDir = vi.fn().mockResolvedValueOnce([
      { name: 'daily.md', isDirectory: false, isSymlink: false },
      { name: 'draft.txt', isDirectory: false, isSymlink: false }
    ])
    const stat = vi.fn().mockRejectedValue(new Error('ENOENT: no such file'))
    const createFile = vi.fn().mockResolvedValueOnce(undefined)
    const readFile = vi.fn().mockResolvedValueOnce({
      content: '# {{title}}\n',
      isBinary: false
    })
    const writeFile = vi.fn().mockResolvedValueOnce(undefined)
    const pathExists = vi.fn(async ({ filePath }: { filePath: string }) =>
      filePath.endsWith('/.orca/templates')
    )
    const unsubscribe = subscribeMarkdownTemplatePicker((request) => {
      const template = request.templates[0]
      if (!template) {
        throw new Error('Expected a discovered template')
      }
      request.resolve({ type: 'template', template })
    })

    vi.stubGlobal('window', {
      api: {
        shell: { pathExists: vi.fn() },
        fs: {
          createFile,
          pathExists,
          readDir,
          readFile,
          stat,
          writeFile
        }
      }
    })

    try {
      await expect(
        createUntitledMarkdownFileWithTemplateSelection('/repo', 'wt-1', undefined, LOCAL)
      ).resolves.toMatchObject({
        filePath: '/repo/untitled.md',
        relativePath: 'untitled.md',
        deleteUntouchedOnClose: false
      })
    } finally {
      unsubscribe()
    }

    expect(readDir).toHaveBeenCalledWith(
      expect.objectContaining({ dirPath: '/repo/.orca/templates' })
    )
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/repo/untitled.md', content: '# Untitled\n' })
    )
  })
})

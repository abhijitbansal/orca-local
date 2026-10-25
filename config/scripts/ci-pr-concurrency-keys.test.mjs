import { readFileSync, readdirSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { parse } from 'yaml'

const directory = '.github/workflows'
const number = 123
const sha = 'a'.repeat(40)
const githubContext = {
  event_name: 'pull_request',
  event: { pull_request: { number, head: { sha } } },
  ref: `refs/pull/${number}/merge`,
  sha: 'b'.repeat(40),
  run_id: 456
}

function evaluate(expression) {
  return expression.replace(/\$\{\{(.*?)\}\}/g, (_, source) =>
    runInNewContext(source, {
      github: githubContext,
      inputs: {},
      format: (template, value) => template.replace('{0}', value)
    })
  )
}

it('every automatic PR workflow has a unique cancelling concurrency key', () => {
  const expected = new Map()
  for (const file of readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))) {
    const workflow = parse(readFileSync(`${directory}/${file}`, 'utf8'))
    if (!Object.hasOwn(workflow.on ?? {}, 'pull_request')) {
      continue
    }
    expect(workflow.concurrency, file).toBeDefined()
    const key = evaluate(workflow.concurrency.group)
    expect(expected.has(key), `${file}: duplicate PR concurrency key ${key}`).toBe(false)
    expect(String(evaluate(String(workflow.concurrency['cancel-in-progress']))), file).toBe('true')
    expected.set(key, `.github/workflows/${file}`)
  }
  expect(expected.size).toBeGreaterThan(0)
})

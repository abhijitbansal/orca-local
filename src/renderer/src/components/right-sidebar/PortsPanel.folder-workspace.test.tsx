// @vitest-environment happy-dom

import { cleanup } from '@testing-library/react'
import { afterEach, describe } from 'vitest'
import { useAppStore } from '@/store'

const initialState = useAppStore.getInitialState()

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

describe('Ports panel for a folder workspace on a managed SSH server', () => {})

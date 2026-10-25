// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach } from 'vitest'
import { useAppStore } from '@/store'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
const original = useAppStore.getState()
const container = document.createElement('div')
const root = createRoot(container)

afterEach(() => {
  act(() => root.unmount())
  useAppStore.setState(original, true)
})

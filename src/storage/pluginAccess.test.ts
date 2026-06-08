// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePluginStorageAccess } from './pluginAccess'

describe('resolvePluginStorageAccess', () => {
  afterEach(() => {
    delete (window as any)._sketchNotePlugin
    vi.restoreAllMocks()
  })

  it('uses explicit storage functions first', async () => {
    const loadData = vi.fn(async () => 'explicit-load')
    const saveData = vi.fn(async () => {})
    const removeData = vi.fn(async () => {})
    ;(window as any)._sketchNotePlugin = {
      loadData: vi.fn(async () => 'plugin-load'),
      saveData: vi.fn(async () => {}),
      removeData: vi.fn(async () => {}),
    }

    const access = resolvePluginStorageAccess({ loadData, saveData, removeData })

    expect(await access.loadData?.('key')).toBe('explicit-load')
    expect(loadData).toHaveBeenCalledWith('key')
  })

  it('falls back to the global plugin storage functions', async () => {
    const loadData = vi.fn(async () => 'plugin-load')
    const saveData = vi.fn(async () => {})
    const removeData = vi.fn(async () => {})
    ;(window as any)._sketchNotePlugin = { loadData, saveData, removeData }

    const access = resolvePluginStorageAccess({})

    expect(await access.loadData?.('key')).toBe('plugin-load')
    await access.saveData('key', { ok: true })
    await access.removeData?.('key')

    expect(loadData).toHaveBeenCalledWith('key')
    expect(saveData).toHaveBeenCalledWith('key', { ok: true })
    expect(removeData).toHaveBeenCalledWith('key')
  })
})

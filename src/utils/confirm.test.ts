// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSiyuanConfirm } from './confirm'

describe('requestSiyuanConfirm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves true when the SiYuan confirm callback runs', async () => {
    const result = await requestSiyuanConfirm(
      (title, text, confirmCallback) => {
        expect(title).toBe('清理无效手写笔记')
        expect(text).toBe('是否继续？')
        confirmCallback?.({} as any)
      },
      '清理无效手写笔记',
      '是否继续？',
    )

    expect(result).toBe(true)
  })

  it('resolves false when the SiYuan cancel callback runs', async () => {
    const result = await requestSiyuanConfirm(
      (_title, _text, _confirmCallback, cancelCallback) => {
        cancelCallback?.({} as any)
      },
      '清理无效手写笔记',
      '是否继续？',
    )

    expect(result).toBe(false)
  })

  it('falls back to window.confirm when the SiYuan confirm API throws', async () => {
    const fallback = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const result = await requestSiyuanConfirm(
      () => {
        throw new Error('confirm unavailable')
      },
      '清理无效手写笔记',
      '是否继续？',
    )

    expect(result).toBe(true)
    expect(fallback).toHaveBeenCalledWith('清理无效手写笔记\n\n是否继续？')
  })

  it('falls back when the SiYuan confirm API returns without creating a dialog or invoking callbacks', async () => {
    const fallback = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const result = await requestSiyuanConfirm(
      () => {},
      '清理无效手写笔记',
      '是否继续？',
      { fallbackDelayMs: 0 },
    )

    expect(result).toBe(false)
    expect(fallback).toHaveBeenCalledWith('清理无效手写笔记\n\n是否继续？')
  })

  it('does not fall back while a SiYuan dialog exists', async () => {
    vi.useFakeTimers()
    const fallback = vi.spyOn(window, 'confirm').mockReturnValue(true)
    let confirmCallback: ((dialog: any) => void) | undefined

    const promise = requestSiyuanConfirm(
      (_title, _text, onConfirm) => {
        confirmCallback = onConfirm
        const dialog = document.createElement('div')
        dialog.className = 'b3-dialog'
        document.body.appendChild(dialog)
      },
      '清理无效手写笔记',
      '是否继续？',
      { fallbackDelayMs: 10 },
    )

    vi.advanceTimersByTime(10)
    expect(fallback).not.toHaveBeenCalled()

    confirmCallback?.({} as any)
    await expect(promise).resolves.toBe(true)
    document.querySelector('.b3-dialog')?.remove()
    vi.useRealTimers()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { resolveSiyuanWorkspaceDir } from './workspace'

describe('resolveSiyuanWorkspaceDir', () => {
  afterEach(() => {
    delete (window as any).siyuan
  })

  it('reads the current workspace directory from SiYuan config', () => {
    ;(window as any).siyuan = {
      config: {
        system: {
          workspaceDir: 'D:/SiYuanWorkspace',
        },
      },
    }

    expect(resolveSiyuanWorkspaceDir()).toBe('D:/SiYuanWorkspace')
  })

  it('returns an empty string when the workspace directory is unavailable', () => {
    ;(window as any).siyuan = { config: { system: {} } }

    expect(resolveSiyuanWorkspaceDir()).toBe('')
  })
})

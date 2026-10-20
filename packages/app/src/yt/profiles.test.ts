import { describe, expect, it } from 'vitest'
import { parseProfiles } from './profiles'

const item = (name: string, datasync?: string, extra: object = {}) => ({
  accountItem: {
    accountName: { simpleText: name },
    accountPhoto: { thumbnails: [{ url: `${name}.jpg` }] },
    serviceEndpoint: datasync
      ? { selectActiveIdentityEndpoint: { supportedTokens: [{ datasyncIdToken: { datasyncIdToken: datasync } }] } }
      : undefined,
    ...extra,
  },
})

describe('parseProfiles', () => {
  it('finds profiles anywhere in the response and reads their page ids', () => {
    const data = { contents: [{ a: { b: [item('Ann', '||123'), item('Kids', '999||123', { isSelected: true })] } }] }
    expect(parseProfiles(data)).toEqual([
      { id: undefined, name: 'Ann', byline: undefined, avatar: 'Ann.jpg', selected: false },
      { id: '999', name: 'Kids', byline: undefined, avatar: 'Kids.jpg', selected: true },
    ])
  })

  it('skips disabled and unnamed entries and duplicates', () => {
    const data = [item('A', '1||2'), item('A', '1||2'), item('Off', '3||2', { isDisabled: true }), item('', '4||2')]
    expect(parseProfiles(data).map((p) => p.name)).toEqual(['A'])
  })

  it('tolerates junk', () => {
    expect(parseProfiles(null)).toEqual([])
    expect(parseProfiles({ accountItem: 5 })).toEqual([])
  })
})

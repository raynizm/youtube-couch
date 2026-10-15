import { describe, expect, it } from 'vitest'
import { allItems, collectTiles, parseGrid, parseHome, parseSubscriptions, textOf, tileToItem } from './tv'

const line = (...texts: any[]) => ({ lineRenderer: { items: texts.map((t) => ({ lineItemRenderer: { text: t } })) } })
const videoTile = (id: string, over: any = {}) => ({
  tileRenderer: {
    contentId: id,
    contentType: 'TILE_CONTENT_TYPE_VIDEO',
    header: {
      tileHeaderRenderer: {
        thumbnail: { thumbnails: [{ url: `https://t/${id}.jpg` }] },
        thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { text: { simpleText: '20:28' } } }],
      },
    },
    metadata: {
      tileMetadataRenderer: {
        title: { simpleText: `T ${id}` },
        lines: [
          line({ runs: [{ text: 'Past Unsealed and 3 more' }] }),
          line({ simpleText: '3.8M views' }, { simpleText: '•' }, { runs: [{ text: '1 month' }, { text: ' ago' }] }),
        ],
      },
    },
    ...over,
  },
})
const plTile = (id: string) => ({
  tileRenderer: {
    contentId: id,
    contentType: 'TILE_CONTENT_TYPE_PLAYLIST',
    header: {
      tileHeaderRenderer: {
        thumbnail: { thumbnails: [{ url: 'https://t/pl.jpg' }] },
        thumbnailOverlays: [{ thumbnailOverlayTimeStatusRenderer: { text: { runs: [{ text: '30' }, { text: ' videos' }] } } }],
      },
    },
    metadata: { tileMetadataRenderer: { title: { simpleText: 'Watch later' }, lines: [line({ simpleText: 'Private' })] } },
  },
})
const shelf = (title: string, items: unknown[]) => ({
  shelfRenderer: {
    headerRenderer: { shelfHeaderRenderer: { avatarLockup: { avatarLockupRenderer: { title: { runs: [{ text: title }] } } } } },
    content: { horizontalListRenderer: { items } },
  },
})
const surface = (content: unknown) => ({ tvSurfaceContentRenderer: { content } })
const home = (shelves: unknown[]) => ({
  contents: { tvBrowseRenderer: { content: surface({ sectionListRenderer: { contents: shelves } }) } },
})

describe('tileToItem', () => {
  it('maps a video tile', () => {
    expect(tileToItem(videoTile('aaaaaaaaaaa').tileRenderer)).toEqual({
      id: 'aaaaaaaaaaa',
      kind: 'video',
      title: 'T aaaaaaaaaaa',
      thumb: 'https://t/aaaaaaaaaaa.jpg',
      author: 'Past Unsealed and 3 more',
      meta: '3.8M views · 1 month ago · 20:28',
    })
  })

  it('maps a playlist tile', () => {
    expect(tileToItem(plTile('WL').tileRenderer)).toEqual({ id: 'WL', kind: 'playlist', title: 'Watch later', thumb: 'https://t/pl.jpg' })
  })

  it('skips shorts, unknown types, missing ids and junk', () => {
    expect(tileToItem(videoTile('a', { contentType: 'TILE_CONTENT_TYPE_SHORTS' }).tileRenderer)).toBeUndefined()
    expect(tileToItem(videoTile('a', { contentType: 'TILE_CONTENT_TYPE_OTHER' }).tileRenderer)).toBeUndefined()
    expect(tileToItem({ contentType: 'TILE_CONTENT_TYPE_VIDEO' })).toBeUndefined()
    for (const junk of [null, undefined, 3, 'x', [], {}]) expect(tileToItem(junk)).toBeUndefined()
  })

  it('tolerates a sparse video tile', () => {
    expect(tileToItem({ contentId: 'abc', contentType: 'TILE_CONTENT_TYPE_VIDEO' })).toMatchObject({
      id: 'abc',
      title: '',
      thumb: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
      meta: '',
    })
  })
})

describe('textOf', () => {
  it('reads simpleText, runs and junk', () => {
    expect(textOf({ simpleText: 'a' })).toBe('a')
    expect(textOf({ runs: [{ text: 'a' }, null, { text: 'b' }] })).toBe('ab')
    expect(textOf(null)).toBe('')
  })
})

describe('collectTiles', () => {
  it('finds tiles anywhere, null-safe and depth-capped', () => {
    const deep: any = {}
    let cur = deep
    for (let i = 0; i < 100; i++) cur = cur.n = {}
    cur.tileRenderer = { contentId: 'far' }
    expect(collectTiles({ a: [null, { b: videoTile('x') }, 3], deep })).toHaveLength(1)
  })
})

describe('parseHome', () => {
  it('builds a row per shelf with items, skipping empty shelves and shorts', () => {
    const rows = parseHome(
      home([
        shelf('Recommended', [videoTile('aaaaaaaaaaa'), videoTile('s', { contentType: 'TILE_CONTENT_TYPE_SHORTS' }), null, videoTile('bbbbbbbbbbb')]),
        shelf('Empty', []),
        null,
        { other: 1 },
        shelf('Mixes', [plTile('RD1')]),
      ]),
    )
    expect(rows.map((r) => [r.title, r.items.map((i) => i.id)])).toEqual([
      ['Recommended', ['aaaaaaaaaaa', 'bbbbbbbbbbb']],
      ['Mixes', ['RD1']],
    ])
  })

  it('falls back to a single row when the expected path is missing, and [] when empty', () => {
    expect(parseHome({ weird: { list: [videoTile('aaaaaaaaaaa')] } })).toMatchObject([{ title: 'Recommended', items: [{ id: 'aaaaaaaaaaa' }] }])
    for (const d of [undefined, null, {}, home([])]) expect(parseHome(d)).toEqual([])
  })
})

describe('parseSubscriptions', () => {
  const subs = (shelves: unknown[]) => ({
    contents: {
      tvBrowseRenderer: {
        content: {
          tvSecondaryNavRenderer: {
            sections: [
              { tvSecondaryNavSectionRenderer: { tabs: [{ tabRenderer: { title: 'All', content: surface({ sectionListRenderer: { contents: shelves } }) } }] } },
            ],
          },
        },
      },
    },
  })

  it('flattens all shelves of the first tab and dedupes by id', () => {
    const items = parseSubscriptions(subs([shelf('Today', [videoTile('aaaaaaaaaaa'), videoTile('bbbbbbbbbbb')]), shelf('Week', [videoTile('bbbbbbbbbbb'), videoTile('ccccccccccc')])]))
    expect(items.map((i) => i.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'])
  })

  it('returns [] for missing data', () => {
    for (const d of [undefined, null, {}, subs([])]) expect(parseSubscriptions(d)).toEqual([])
  })
})

describe('parseGrid', () => {
  it('reads grid tiles and falls back to a recursive collect', () => {
    const g = { contents: { tvBrowseRenderer: { content: surface({ gridRenderer: { items: [videoTile('aaaaaaaaaaa'), null, plTile('PL1')] } }) } } }
    expect(parseGrid(g).map((i) => i.id)).toEqual(['aaaaaaaaaaa', 'PL1'])
    expect(parseGrid({ x: [videoTile('bbbbbbbbbbb')] }).map((i) => i.id)).toEqual(['bbbbbbbbbbb'])
    expect(parseGrid(null)).toEqual([])
  })
})

describe('allItems', () => {
  it('dedupes', () => {
    expect(allItems([videoTile('aaaaaaaaaaa'), videoTile('aaaaaaaaaaa')])).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { toDetails } from './client'

describe('toDetails', () => {
  it('maps owner, description and related videos', () => {
    const d = toDetails({
      basic_info: { title: 'T', channel_id: 'UC1', author: 'Chan', short_description: 'short' },
      primary_info: { view_count: { short_view_count: { text: '1M views' } }, relative_date: { text: '2 days ago' } },
      secondary_info: {
        description: { text: 'long desc' },
        owner: { author: { id: 'UC1', name: 'Chan', thumbnails: [{ url: 'a.jpg' }] }, subscriber_count: { text: '10K subscribers' } },
      },
      watch_next_feed: [{ type: 'LockupView', content_id: 'abcdefghijk', content_type: 'VIDEO', metadata: { title: { text: 'Rel' } } }],
    })
    expect(d).toMatchObject({ title: 'T', description: 'long desc', meta: '1M views · 2 days ago' })
    expect(d.channel).toEqual({ id: 'UC1', name: 'Chan', avatar: 'a.jpg', subs: '10K subscribers' })
    expect(d.related.map((i) => i.id)).toEqual(['abcdefghijk'])
  })

  it('tolerates a sparse response', () => {
    const d = toDetails({ basic_info: { title: 'T', short_description: 'short' } })
    expect(d).toMatchObject({ title: 'T', description: 'short', meta: '', channel: undefined, related: [] })
  })
})

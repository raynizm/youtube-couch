// Pure parser for the TV `account/accounts_list` response: every account or channel the Google
// login can act as (main account, brand channels, kids profiles). Null-safe, never throws.
import { textOf } from './tv'

type Raw = Record<string, any>

const MAX_DEPTH = 40

export type Profile = { id?: string; name: string; byline?: string; avatar?: string; selected: boolean }

const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined)

function collectAccountItems(node: unknown, depth = 0, out: Raw[] = []): Raw[] {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return out
  if (Array.isArray(node)) {
    for (const n of node) collectAccountItems(n, depth + 1, out)
    return out
  }
  for (const [k, v] of Object.entries(node as Raw)) {
    if (k === 'accountItem' && obj(v)) out.push(v as Raw)
    else collectAccountItems(v, depth + 1, out)
  }
  return out
}

/** The page id a profile acts as. The primary account has an empty page id, which means "no override". */
function pageIdOf(item: Raw): string | undefined {
  const tokens: Raw[] = item.serviceEndpoint?.selectActiveIdentityEndpoint?.supportedTokens ?? []
  for (const t of Array.isArray(tokens) ? tokens : []) {
    const ds = t?.datasyncIdToken?.datasyncIdToken
    if (typeof ds === 'string') return ds.split('||')[0] || undefined
  }
  const direct = (Array.isArray(tokens) ? tokens : []).map((t) => t?.pageIdToken?.pageId).find((v) => typeof v === 'string' && v)
  return direct || undefined
}

export function parseProfiles(data: unknown): Profile[] {
  const seen = new Set<string>()
  const out: Profile[] = []
  for (const item of collectAccountItems(data)) {
    if (item.isDisabled) continue
    const name = textOf(item.accountName)
    if (!name) continue
    const id = pageIdOf(item)
    const key = id ?? `primary:${name}`
    if (seen.has(key)) continue
    seen.add(key)
    const thumbs = item.accountPhoto?.thumbnails
    out.push({
      id,
      name,
      byline: textOf(item.accountByline) || undefined,
      avatar: Array.isArray(thumbs) && typeof thumbs[0]?.url === 'string' ? thumbs[0].url : undefined,
      selected: !!item.isSelected,
    })
  }
  return out
}

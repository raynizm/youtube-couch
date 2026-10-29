import { saveAccount, saveProfileId } from './auth'
import { parseProfiles, type Profile } from './profiles'
import type { Raw } from './raw'
import { applyProfile, getSession } from './session'

/** Every profile the signed-in login can act as. Empty when the response has none we understand. */
export async function listProfiles(): Promise<Profile[]> {
  const yt = await getSession()
  const ask = async (args: Raw) => ((await yt.actions.execute('/account/accounts_list', { ...args, client: 'TV' } as any)) as unknown as Raw)?.data
  const switcher = await ask({ requestType: 'ACCOUNTS_LIST_REQUEST_TYPE_CHANNEL_SWITCHER', callCircumstance: 'SWITCHING_USERS_FULL' }).catch(() => undefined)
  let profiles = parseProfiles(switcher)
  if (profiles.length < 2) {
    const plain = await ask({}).catch(() => undefined)
    const more = parseProfiles(plain)
    if (more.length > profiles.length) profiles = more
  }
  return profiles
}

/** Switches the whole app to one profile; feeds keyed on the auth snapshot refetch on their own. */
export async function selectProfile(p: Profile): Promise<void> {
  const yt = await getSession()
  applyProfile(yt, p.id)
  saveAccount({ name: p.name, avatar: p.avatar })
  saveProfileId(p.id)
}

import { useSyncExternalStore } from 'react'
import type { OAuth2Tokens } from 'youtubei.js'

export type Account = { name: string; avatar?: string }
type AuthState = { signedIn: boolean; name?: string; avatar?: string }

const AUTH_KEY = 'bluefin.auth'
const ACCOUNT_KEY = 'bluefin.account'

// In-memory copies are the fallback when storage is unavailable.
let memCreds: OAuth2Tokens | undefined
let memAccount: Account | undefined
let snap: AuthState | undefined
const listeners = new Set<() => void>()

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full: memory copy still holds it */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function isCreds(v: unknown): v is OAuth2Tokens {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.access_token === 'string' && typeof o.refresh_token === 'string' && typeof o.expiry_date === 'string'
}

function isAccount(v: unknown): v is Account {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).name === 'string'
}

function emit() {
  snap = undefined
  listeners.forEach((l) => l())
}

export function loadCredentials(): OAuth2Tokens | undefined {
  const stored = readJson(AUTH_KEY)
  return isCreds(stored) ? stored : memCreds
}

export function saveCredentials(c: OAuth2Tokens): void {
  memCreds = c
  writeJson(AUTH_KEY, c)
  emit()
}

function loadAccount(): Account | undefined {
  const stored = readJson(ACCOUNT_KEY)
  return isAccount(stored) ? stored : memAccount
}

export function saveAccount(a: Account): void {
  memAccount = a
  writeJson(ACCOUNT_KEY, a)
  emit()
}

export function clearAuth(): void {
  memCreds = undefined
  memAccount = undefined
  remove(AUTH_KEY)
  remove(ACCOUNT_KEY)
  emit()
}

export function getAuthSnapshot(): AuthState {
  if (snap) return snap
  if (!loadCredentials()) return (snap = { signedIn: false })
  const acc = loadAccount()
  return (snap = { signedIn: true, name: acc?.name, avatar: acc?.avatar })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getAuthSnapshot, getAuthSnapshot)
}

/**
 * Google sign-in for the Mac app. Google blocks sign-in inside app windows ("disallowed_useragent"),
 * so the Mac app opens Google in the default browser, the way Google's own Mac sign-in works:
 * OAuth with PKCE on dash's iOS client ID (Google uses the iOS client type for Mac apps too), and
 * Google sends the browser back to the app through its reversed-client-ID URL scheme, which
 * `src-tauri/tauri.conf.json` registers. The refresh token stays on this Mac (`dash.mac.google.v1`),
 * so the app stays signed in like the iPhone app does.
 */
import { GOOGLE_IOS_CLIENT_ID } from '@/config'
import { nextDeepLink, openInBrowser } from '@/lib/macApp'

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const REVOKE = 'https://oauth2.googleapis.com/revoke'
const KEY = 'dash.mac.google.v1'
const SCHEME = GOOGLE_IOS_CLIENT_ID.split('.apps.googleusercontent.com')[0]
export const MAC_REDIRECT = `com.googleusercontent.apps.${SCHEME}:/oauth2redirect`

interface Saved {
  refreshToken: string
  email: string
  name?: string
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  error?: string
  error_description?: string
}

/** Google said the saved sign-in no longer works (revoked, expired or signed out elsewhere). */
export class MacSignInExpired extends Error {}

let access: { token: string; until: number } | null = null

const load = (): Saved | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
  } catch {
    return null
  }
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const randomString = () => base64url(crypto.getRandomValues(new Uint8Array(32)))

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** The email and name inside Google's ID token (read only, it came straight from Google over HTTPS). */
function profileFrom(idToken: string | undefined): { email?: string; name?: string } {
  try {
    const part = idToken!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      Array.from(atob(part), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    )
    const claims = JSON.parse(json) as { email?: string; name?: string }
    return { email: claims.email, name: claims.name }
  } catch {
    return {}
  }
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_IOS_CLIENT_ID, ...body }),
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok) data.error ??= `http_${res.status}`
  return data
}

/** Opens Google in the browser and waits for it to send the user back to the app. */
export async function macSignIn(scopes: string[]): Promise<{ email: string; name?: string }> {
  const verifier = randomString() + randomString()
  const state = randomString()
  const url = new URL(AUTH)
  url.search = new URLSearchParams({
    client_id: GOOGLE_IOS_CLIENT_ID,
    redirect_uri: MAC_REDIRECT,
    response_type: 'code',
    scope: ['openid', 'email', 'profile', ...scopes].join(' '),
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    state,
    prompt: 'consent',
  }).toString()

  const back = nextDeepLink((u) => u.startsWith(MAC_REDIRECT) && new URL(u).searchParams.get('state') === state, 10 * 60_000)
  await openInBrowser(url.href)
  const params = new URL(await back).searchParams
  const code = params.get('code')
  if (!code) {
    throw new Error(params.get('error') === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google didn’t sign you in. Try again.')
  }

  const t = await tokenRequest({ code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: MAC_REDIRECT })
  if (t.error || !t.access_token || !t.refresh_token) throw new Error('Google didn’t finish signing you in. Try again.')
  const { email, name } = profileFrom(t.id_token)
  if (!email) throw new Error('Google didn’t return an account.')
  localStorage.setItem(KEY, JSON.stringify({ refreshToken: t.refresh_token, email, name } satisfies Saved))
  access = { token: t.access_token, until: Date.now() + (t.expires_in ?? 3600) * 1000 }
  return { email, name }
}

/** A fresh access token from the saved sign-in (Google's tokens last an hour). */
export async function macAccessToken(): Promise<string> {
  if (access && Date.now() < access.until - 60_000) return access.token
  const saved = load()
  if (!saved) throw new MacSignInExpired('Not signed in on this Mac.')
  const t = await tokenRequest({ refresh_token: saved.refreshToken, grant_type: 'refresh_token' })
  if (t.error === 'invalid_grant' || t.error === 'unauthorized_client') {
    localStorage.removeItem(KEY)
    throw new MacSignInExpired('Google sign-in has expired.')
  }
  if (t.error || !t.access_token) throw new Error('Google didn’t respond. Check the internet connection.')
  access = { token: t.access_token, until: Date.now() + (t.expires_in ?? 3600) * 1000 }
  return t.access_token
}

export function macForgetToken() {
  access = null
}

export async function macSignOut(): Promise<void> {
  const saved = load()
  access = null
  localStorage.removeItem(KEY)
  if (saved) await fetch(`${REVOKE}?token=${encodeURIComponent(saved.refreshToken)}`, { method: 'POST' }).catch(() => {})
}

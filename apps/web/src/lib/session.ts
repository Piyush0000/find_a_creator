// ============================================================================
// Role Session Cookie
// The JWT lives in localStorage for API calls; this lightweight role cookie lets
// Next.js middleware route-guard portal pages before they render.
// The API still verifies the JWT on every request — this cookie is routing only.
// ============================================================================
export const ROLE_COOKIE = 'evoc_role';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // Matches 7-day JWT expiry

export function setRoleCookie(role: string) {
  document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`;
}

export function clearRoleCookie() {
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

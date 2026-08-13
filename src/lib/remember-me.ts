/**
 * Non-secret client-side mirror of the "Remember me" choice made at login.
 *
 * The server cannot read a cookie's persistence once set, so on a session
 * refresh (/api/auth/refresh) the client sends this flag to decide whether the
 * rotated refresh token should be a 7-day persistent cookie or a browser-session
 * cookie. Defaults to true, matching the login form's default.
 */
const KEY = "edupro_remember_me";

export function setRememberMe(remember: boolean): void {
  try {
    localStorage.setItem(KEY, remember ? "1" : "0");
  } catch {
    // localStorage unavailable (private mode / SSR) — ignore.
  }
}

export function getRememberMe(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function clearRememberMe(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore.
  }
}
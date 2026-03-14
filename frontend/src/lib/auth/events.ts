export const AUTH_STATE_EVENT = "logerswatch-auth-state-changed";

export function emitAuthStateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_STATE_EVENT));
}

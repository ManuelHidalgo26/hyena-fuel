export function fbTrack(event, params = {}) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}

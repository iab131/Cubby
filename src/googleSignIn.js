/* Sign in with Google in a popup, then hand Google's proof to Supabase (signInWithIdToken).
   The popup is Google's own sign-in page, opened straight from the click, and it names this site
   (or the app name set in Google Cloud) instead of the project's long supabase.co address. Google
   sends the proof back to google-callback.html on this site, which passes it here and closes.
   Needs VITE_GOOGLE_CLIENT_ID (the same Web client ID Supabase's Google provider uses), with that page
   in the client's Authorized redirect URIs in Google Cloud (see SETUP.md).
   Without it, sign-in falls back to Supabase's redirect (see backend.js). */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const hasGooglePopup = () => !!CLIENT_ID;

// a one-time random value: Google puts its hash inside the proof, Supabase checks it against the original
function randomNonce() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* Opens Google's sign-in in a popup. Resolves with { token, nonce } once the person signs in, or null if
   they close it. Throws if the browser blocks the popup. Call it straight from a click (before any await),
   or the browser blocks it. */
let open = null, popup = null;
export function askGoogle() {
  if (open) { popup?.focus(); return open; }
  if (!('BroadcastChannel' in window)) throw new Error('This browser can’t take the sign-in back from the popup.');
  const w = 480, h = 640, left = screenX + Math.max(0, (outerWidth - w) / 2), top = screenY + Math.max(0, (outerHeight - h) / 2);
  popup = window.open('', 'cubby-google', `popup,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) throw new Error('The browser blocked the sign-in popup.');
  const nonce = randomNonce(), state = randomNonce();
  open = new Promise(resolve => {
    const ch = new BroadcastChannel('cubby-google');
    let timer = 0, closedAt = 0;
    const done = v => { clearInterval(timer); ch.close(); open = null; try { popup.close(); } catch {} popup = null; resolve(v); };
    ch.onmessage = e => { if (e.data?.state === state) done(e.data.idToken ? { token: e.data.idToken, nonce } : null); };
    // closed without signing in. The callback page closes itself right after sending the proof, so give that a moment to arrive.
    timer = setInterval(() => { if (!popup.closed) return; closedAt ||= Date.now(); if (Date.now() - closedAt > 1000) done(null); }, 250);
    sha256Hex(nonce).then(hashed => {
      const q = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'id_token', scope: 'openid email profile', redirect_uri: location.origin + '/google-callback.html', nonce: hashed, state, prompt: 'select_account' });
      popup.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
    });
  });
  return open;
}

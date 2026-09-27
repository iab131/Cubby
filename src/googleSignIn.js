/* Sign in with Google's own button, then hand Google's proof to Supabase (signInWithIdToken).
   The sign-in happens on this site, so Google shows this site (or the app name set in Google Cloud)
   instead of the project's long supabase.co address.
   Needs VITE_GOOGLE_CLIENT_ID: the same Web client ID that Supabase's Google provider uses.
   Without it, sign-in falls back to Supabase's redirect (see backend.js). */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const hasGoogleButton = () => !!CLIENT_ID;

let scriptP = null;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptP ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptP = null; reject(new Error('Could not load Google sign-in.')); };
    document.head.appendChild(s);
  });
  return scriptP;
}

// a one-time random value: Google puts its hash inside the proof, Supabase checks it against the original
function randomNonce() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* A small card with Google's button. Resolves with { token, nonce } once the person signs in,
   or null if they close it. Throws if Google's script can't load. */
let open = null;
export async function askGoogle() {
  if (open) return open;
  await loadGoogle();
  const nonce = randomNonce(), hashed = await sha256Hex(nonce);
  open = new Promise(resolve => {
    const veil = document.createElement('div');
    veil.className = 'gsi-veil';
    veil.innerHTML = `
      <div class="gsi-card" role="dialog" aria-modal="true" aria-labelledby="gsiTitle">
        <h3 id="gsiTitle">Sign in to add your room</h3>
        <p>One room per Google account. Looking around never needs one.</p>
        <div class="gsi-btn"></div>
        <button type="button" class="text-btn gsi-cancel">Cancel</button>
      </div>`;
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    const done = v => { veil.remove(); document.removeEventListener('keydown', onKey, true); open = null; resolve(v); };
    veil.addEventListener('click', e => { if (e.target === veil) done(null); });
    veil.querySelector('.gsi-cancel').addEventListener('click', () => done(null));
    document.addEventListener('keydown', onKey, true);   // Escape closes this card only, not the add panel behind it
    document.body.appendChild(veil);
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID, nonce: hashed, ux_mode: 'popup', context: 'signin', itp_support: true,
      callback: r => done(r && r.credential ? { token: r.credential, nonce } : null)
    });
    window.google.accounts.id.renderButton(veil.querySelector('.gsi-btn'), { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 260 });
  });
  return open;
}

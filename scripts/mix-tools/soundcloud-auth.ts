import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';

// Signs in as the account owner (OAuth 2.1 authorization code + PKCE) for API calls
// that change tracks. Register REDIRECT_URI on the SoundCloud app first.

export const REDIRECT_PORT = 8976;
export const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

const base64url = (bytes: Buffer) => bytes.toString('base64url');

export const createPkce = (random = randomBytes) => {
  const verifier = base64url(random(48));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, state: base64url(random(16)) };
};

export const authorizeUrl = (clientId: string, challenge: string, state: string) =>
  `https://secure.soundcloud.com/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state
  })}`;

/** Waits for SoundCloud to redirect back with the authorization code. */
export const waitForCode = (state: string, { port = REDIRECT_PORT, timeoutMs = 5 * 60_000 } = {}) =>
  new Promise<string>((resolve, reject) => {
    let server: Server;
    const finish = (error: Error | null, code?: string) => {
      clearTimeout(timer);
      server.close();
      if (error) reject(error);
      else resolve(code!);
    };
    const timer = setTimeout(() => finish(new Error('Timed out waiting for SoundCloud sign-in')), timeoutMs);
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
      res.end(ok ? '<p>Signed in to SoundCloud. You can close this tab.</p>' : '<p>Sign-in failed. Check the terminal.</p>');
      if (url.searchParams.get('error')) {
        finish(new Error(`SoundCloud sign-in failed: ${url.searchParams.get('error_description') ?? url.searchParams.get('error')}`));
      } else if (!ok) {
        finish(new Error('SoundCloud sign-in failed: state mismatch or missing code'));
      } else {
        finish(null, url.searchParams.get('code')!);
      }
    });
    server.on('error', error => finish(error));
    server.listen(port, '127.0.0.1');
  });

export const exchangeCode = async ({
  clientId,
  clientSecret,
  code,
  verifier,
  fetchFn = fetch
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  verifier: string;
  fetchFn?: typeof fetch;
}): Promise<string> => {
  const res = await fetchFn('https://secure.soundcloud.com/oauth/token', {
    method: 'POST',
    headers: { accept: 'application/json; charset=utf-8', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      code
    }).toString()
  });
  if (!res.ok) {
    throw new Error(`SoundCloud token exchange failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) {
    throw new Error('SoundCloud token response missing access_token');
  }
  return access_token;
};

const openInBrowser = (url: string) => {
  spawn('open', [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
};

/** Opens SoundCloud sign-in in the browser and returns a user access token. */
export const signIn = async ({
  clientId,
  clientSecret,
  log = console.log,
  open = openInBrowser,
  wait = waitForCode,
  exchange = exchangeCode
}: {
  clientId: string;
  clientSecret: string;
  log?: (message: string) => void;
  open?: (url: string) => void;
  wait?: typeof waitForCode;
  exchange?: typeof exchangeCode;
}) => {
  const { verifier, challenge, state } = createPkce();
  const url = authorizeUrl(clientId, challenge, state);
  log(`Sign in to SoundCloud in your browser (opening it now):\n  ${url}`);
  const codePromise = wait(state);
  open(url);
  const code = await codePromise;
  return exchange({ clientId, clientSecret, code, verifier });
};

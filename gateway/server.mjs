import http from 'node:http';
import httpProxy from 'http-proxy';

const PI_AGENT_WEB_URL = process.env.PI_AGENT_WEB_URL ?? 'http://127.0.0.1:8504';
const SHIPANY_URL = process.env.SHIPANY_URL ?? 'http://127.0.0.1:3000';
const TOKEN = process.env.INTERNAL_API_TOKEN ?? '';
const PORT = Number(process.env.GATEWAY_PORT ?? 8520);

// pi-agent-web WS is purely unidirectional (server→client); http-proxy's ws:true
// forwards the upgrade and frames transparently — no custom frame handling needed.
const proxy = httpProxy.createProxyServer({ target: PI_AGENT_WEB_URL, ws: true });

proxy.on('error', (err, _req, res) => {
  if (res && 'writeHead' in res) {
    res.writeHead(502).end('bad gateway');
  }
});

async function resolveUser(req) {
  try {
    const r = await fetch(`${SHIPANY_URL}/api/internal/session`, {
      headers: {
        cookie: req.headers.cookie ?? '',
        'x-internal-token': TOKEN,
      },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.userId ?? null;
  } catch {
    return null;
  }
}

// Paths under /agent/api/workspaces/<workspaceId>/... must match the caller's own workspace.
// Non-workspace paths (static assets, /api/models, etc.) pass through.
function ownsPath(userId, url) {
  const m = url.match(/^\/agent\/api\/workspaces\/([^/]+)\//);
  return m ? m[1] === `u_${userId}` : true;
}

// Strip the /agent prefix so pi-agent-web sees its native paths.
function strip(url) {
  return url.replace(/^\/agent/, '') || '/';
}

const server = http.createServer(async (req, res) => {
  const userId = await resolveUser(req);
  if (!userId) {
    res.writeHead(401, { 'content-type': 'text/plain' }).end('unauthorized');
    return;
  }
  if (!ownsPath(userId, req.url ?? '')) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('forbidden');
    return;
  }
  req.url = strip(req.url ?? '/');
  proxy.web(req, res);
});

server.on('upgrade', async (req, socket, head) => {
  const userId = await resolveUser(req);
  if (!userId || !ownsPath(userId, req.url ?? '')) {
    socket.destroy();
    return;
  }
  req.url = strip(req.url ?? '/');
  proxy.ws(req, socket, head);
});

server.listen(PORT, () => {
  process.stdout.write(`[gateway] listening on :${PORT}\n`);
});

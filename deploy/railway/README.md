# Railway deployment

Two services in one project. Free plan gives 0.5GB RAM per service, and both
fit:

```
waha      devlikeapro/waha:noweb   ~300 MB   +  0.5GB volume
backend   this repo, Dockerfile     ~120 MB
```

Scraping stays on your laptop. Not for memory reasons: Instagram and Google flag
datacenter IPs far harder than home connections, so the residential IP is the
asset. See `deploy/README.md`.

## Service 1: WAHA

Deploy from the public image, not this repo.

- **Source**: Docker image `devlikeapro/waha:noweb`
- **Volume**: mount at `/app/.sessions` (without it, every redeploy means
  re-scanning the QR)
- **Port**: 3000

Variables:

```
WAHA_API_KEY=<openssl rand -hex 32>
WHATSAPP_DEFAULT_ENGINE=NOWEB
WHATSAPP_RESTART_ALL_SESSIONS=True
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=<openssl rand -hex 16>
WHATSAPP_HOOK_URL=http://backend.railway.internal:5000/api/whatsapp/webhook
WHATSAPP_HOOK_EVENTS=message,message.any,session.status
```

`backend.railway.internal` is Railway's private network. Use the exact service
name you gave the backend.

## Service 2: backend

Deploy from this repo. `railway.json` at the root already points the builder at
`deploy/Dockerfile.backend`, which installs no browsers.

```
MONGODB_URI=              same Atlas cluster as the laptop
JWT_SECRET=               MUST match the laptop exactly
JWT_REFRESH_SECRET=       MUST match the laptop exactly
ENCRYPTION_KEY=           MUST match, or stored cookies cannot be decrypted
DEEPSEEK_API_KEY=

ENABLE_JOBS=true
ENABLE_BROWSER_JOBS=false

WAHA_URL=http://waha.railway.internal:3000
WAHA_API_KEY=             same value as the WAHA service
WAHA_WEBHOOK_HMAC_KEY=
FRONTEND_URL=http://localhost:3000
```

Do not set `PORT`. Railway injects it and `server.js` reads it.

Generate a public domain for this service. That URL is what makes incoming
WhatsApp replies work without a tunnel.

## Order

1. Deploy the backend first, so `backend.railway.internal` resolves
2. Deploy WAHA with a volume attached
3. Open the WAHA service's public domain at `/dashboard`, scan the QR once
4. Point the laptop's `WAHA_URL` at the WAHA public domain to send from local too

## Fit on the free plan

Free gives 1 vCPU / 0.5GB RAM per service and 0.5GB of volume storage.

| | measured | limit |
|---|---|---|
| backend, no browser | ~120 MB | 512 MB |
| WAHA noweb, one session | ~200-300 MB | 512 MB |
| WAHA session data | a few MB | 512 MB volume |

Both fit, with less headroom on WAHA. The backend image caps V8's heap at 320MB
via NODE_OPTIONS, because Node sizes its heap from host memory rather than the
container limit and would otherwise grow past the ceiling and be OOM killed
instead of running a garbage collection.

If WAHA does get killed, it is memory, and the answer is a paid plan rather than
more debugging. Each extra paired session costs another few hundred MB.

## Gotchas

**Railway's private network is IPv6 only.** `*.railway.internal` resolves to
AAAA records. Node handles this, but anything pinned to IPv4 will fail with a
connection error that reads like the service is down.

**The volume is not optional.** WAHA keeps its pairing on disk. Without a
volume, a redeploy silently unpairs your number and you find out when a message
does not send.

**0.5GB is enough for NOWEB, not for the browser engine.** If you switch
`WHATSAPP_DEFAULT_ENGINE` to WEBJS it will be OOM killed. NOWEB is a websocket
client with no Chromium, which is why it fits.

**Three secrets must match the laptop.** JWT_SECRET, JWT_REFRESH_SECRET and
ENCRYPTION_KEY. Otherwise a token issued on one instance is rejected by the
other, and platform cookies stored by the laptop cannot be read on the server.

# Deployment

PostFlow runs split across two machines, divided by what each half needs.

```
Oracle x86 micro (free, 1GB)          Your laptop
┌────────────────────────────┐       ┌──────────────────────────┐
│ waha      WhatsApp socket  │       │ backend, browser jobs ON │
│ backend   ENABLE_BROWSER_  │◀─────▶│ Playwright scraping      │
│           JOBS=false       │       │ Instagram + Google Maps  │
│ caddy     TLS              │       └────────────┬─────────────┘
└─────────────┬──────────────┘                    │
              └────── MongoDB Atlas (shared) ─────┘
```

## Why split this way

Not for CPU or RAM. **IP reputation.**

Instagram and Google flag datacenter IP ranges far more aggressively than home
connections. An account scraping from a cloud host gets checkpointed and
CAPTCHA'd much sooner. Your laptop's residential IP is the asset that makes
scraping work, so scraping stays there.

The cloud box runs what does not care about IPs and does need to be always on:
the WhatsApp socket, follow-up drafting, and webhook receipt.

The second reason is memory. Chromium needs 400-600MB. It does not fit next to
WAHA in 1GB, and `Dockerfile.backend` does not even install browsers.

## What each half does

| | Oracle | Laptop |
|---|---|---|
| WhatsApp send + receive | yes | no |
| Follow-up drafting | yes | no |
| Instagram discovery + DMs | no | yes |
| Google Maps scraping | no | yes |
| Serving the API | yes | yes |

`ENABLE_BROWSER_JOBS=false` is what enforces it. A browser job reaching that
instance throws, and Agenda re-queues it for an instance that has a browser.

## Files

| | |
|---|---|
| `docker-compose.oracle.yml` | the always-on half: waha, backend, caddy |
| `Dockerfile.backend` | browser-free backend image |
| `Caddyfile.oracle` | TLS for both hostnames |
| `.env.oracle.example` | copy to `.env` on the instance |
| `docker-compose.waha.local.yml` | WAHA on a laptop, for testing only |

## Instance shape

**`VM.Standard.E2.1.Micro`** (x86, 1GB, always free, two per account).

Not the Ampere A1 ARM shape. Ampere is the one with the "out of host capacity"
lottery. The x86 micros are a separate pool with far better availability, and
being x86 means standard image tags work with no `-arm` variants.

## Before first start

Point A records for both `WAHA_DOMAIN` and `API_DOMAIN` at the instance IP
first. Caddy requests certificates on first request, and if DNS is not ready the
failure reads as a TLS error rather than the DNS problem it is.

Oracle also blocks ports at two layers. Opening the VCN Security List is only
half: the Ubuntu image ships restrictive iptables, and a port open in the
console but closed in iptables hangs rather than refuses, which sends you
debugging the wrong thing.

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## Secrets that must match the laptop

`JWT_SECRET` and `JWT_REFRESH_SECRET`, or a token issued by one instance is
rejected by the other. `ENCRYPTION_KEY`, or stored platform cookies cannot be
decrypted. `MONGODB_URI`, so both read one set of records.

## Known limit

Oracle reclaims idle Always Free instances, and a quiet WhatsApp socket looks
exactly like idle. When an instance goes, paired sessions go with it and
re-pairing needs a human with a phone. Acceptable while building; treat
re-pairing as a normal recovery flow before charging anyone for this.

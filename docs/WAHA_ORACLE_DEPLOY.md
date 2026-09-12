# Running WAHA on Oracle Cloud Always Free

Deployment notes for the WhatsApp channel. The VPS runs WAHA only. PostFlow's
Express backend stays wherever it already is and talks to this box over HTTPS.

```
PostFlow backend  ──HTTPS + X-Api-Key──>  Caddy  ──>  WAHA  ──>  WhatsApp
       ^                                                              │
       └────────── webhook POST (incoming messages) ──────────────────┘
```

## Why a separate box at all

WAHA holds a long lived connection to WhatsApp. Serverless platforms freeze or
recycle a function between invocations, which drops that connection and forces
every user to re-scan a QR code. This is not a limitation you can configure
around, so the session lives on a VPS.

## Instance setup

**Shape.** Ampere A1 (ARM). The Always Free allocation was halved in mid 2026
from 4 OCPU / 24 GB to **2 OCPU / 12 GB**, which is still far more than WAHA
needs. NOWEB sessions sit in the low hundreds of MB each.

**Image.** Ubuntu 24.04 **aarch64**. Not the x86 build.

**Region.** There is no Oracle region in Nigeria. Johannesburg is the closest.
Latency barely matters here since WAHA talks to WhatsApp's servers rather than
to your users, but your home region is effectively permanent on a free account,
so pick deliberately.

**Capacity.** "Out of host capacity" on Ampere is common in busy regions. Retry
at off peak hours, or try a different availability domain.

## The three things that will cost you an evening

### 1. The default Docker image has no ARM64 build

```
docker pull devlikeapro/waha
# Error: no matching manifest for linux/arm64/v8
```

Use the ARM tags instead. The compose file already does:

```
devlikeapro/waha:noweb-arm    # websocket engine, no browser
devlikeapro/waha:gows-arm     # newer Go websocket engine
devlikeapro/waha:arm          # browser engine, avoid on a free tier box
```

### 2. Oracle images block ports at two layers

Opening the port in the VCN Security List is only half the job. Oracle's Ubuntu
images ship with restrictive iptables rules, and a port open in the console but
closed in iptables produces a connection that hangs rather than refuses, which
reads like a DNS or TLS problem and sends you debugging the wrong layer.

Both layers, in order:

```bash
# Layer 1: VCN Security List, in the Oracle console
#   Networking > Virtual Cloud Networks > your VCN > Security Lists
#   Add ingress rules: 0.0.0.0/0 on TCP 80 and 443

# Layer 2: on the instance itself
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3. Idle reclaim can take your sessions with it

Oracle reclaims Always Free compute instances that look idle. A WhatsApp session
holding a quiet websocket is a low CPU workload, which is exactly the profile
that gets flagged. When the instance goes, every paired session goes with it and
every user has to re-scan a QR code.

For development and your first users this is an acceptable trade. Before you
charge anyone for WhatsApp as a feature, move to a paid VPS, or at minimum treat
re-pairing as a normal recovery flow your UI handles gracefully rather than an
incident.

## Install

```bash
ssh ubuntu@YOUR_IP

# Docker
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker

mkdir -p ~/waha && cd ~/waha
# copy docker-compose.waha.yml and Caddyfile here

# Secrets. Generate them, do not invent them by hand.
cat > .env <<EOF
WAHA_API_KEY=$(openssl rand -hex 32)
WAHA_WEBHOOK_HMAC_KEY=$(openssl rand -hex 32)
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=$(openssl rand -hex 16)
WAHA_DOMAIN=wa.yourdomain.com
WAHA_WEBHOOK_URL=https://your-backend.example.com/api/v1/whatsapp/webhook
ADMIN_IP=your.home.ip.address
EOF

docker compose -f docker-compose.waha.yml up -d
docker compose logs -f waha
```

Point an A record at the instance IP before starting Caddy, or the certificate
challenge fails and you get a TLS error that looks nothing like the DNS problem
it actually is.

## Security, stated plainly

An exposed WAHA instance with no API key lets anyone on the internet send
messages from every WhatsApp account paired to it. Your users' accounts, not
just yours.

Non negotiable:

- `WAHA_API_KEY` set, always. Never run without it, not even for five minutes
  during setup.
- Port 3000 bound to `127.0.0.1` only, as in the compose file. Caddy is the only
  thing that reaches WAHA.
- Dashboard and Swagger restricted by IP, or removed once setup is done.
- HMAC on the webhook, so your backend can prove a POST actually came from your
  WAHA instance.

## Backing up sessions

The `waha-sessions` volume is the difference between a container restart and
every user re-pairing.

```bash
# Daily, via cron
tar czf ~/backups/waha-$(date +%F).tar.gz ~/waha/waha-sessions
```

## Sizing

On 2 OCPU / 12 GB with NOWEB, expect roughly 30 to 60 concurrent sessions before
memory becomes the constraint. Watch actual usage rather than trusting that
range:

```bash
docker stats waha
```

That is comfortably more than you need while validating the feature, and it is
not where the ceiling actually bites. WhatsApp's own tolerance for cold outreach
volume is the real limit, which is what the send caps in
`whatsappHealth.service.js` exist to respect.

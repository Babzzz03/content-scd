# PostFlow Cookie Helper — Chrome Extension

Instantly reads your X, LinkedIn, and Instagram session cookies so you can paste them into PostFlow Settings without touching DevTools.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select this `browser-extension/` folder
5. The PostFlow icon appears in your toolbar

## How to use

1. Log into X, LinkedIn, and/or Instagram in Chrome as normal
2. Click the PostFlow extension icon
3. Each platform shows **green** if the cookie was found
4. Click the **copy** button next to a platform
5. Go to PostFlow → Settings → Platform Connections
6. Paste into the cookie field and click **Save & Connect**

## Cookie names

| Platform  | Cookie       |
|-----------|-------------|
| X         | `auth_token` |
| LinkedIn  | `li_at`      |
| Instagram | `sessionid`  |

## Permissions used

| Permission       | Why |
|-----------------|-----|
| `cookies`        | Read session cookies from platform domains |
| `clipboardWrite` | Copy cookie value to clipboard |
| Host permissions | Required to access cookies per domain |

## Notes

- Cookies are read **locally** — nothing is sent to any server
- Cookies expire when you log out of the platform
- Re-open the extension popup after logging in to refresh

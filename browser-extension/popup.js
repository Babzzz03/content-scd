// PostFlow Cookie Helper — popup script

const PLATFORMS = [
  {
    id: "x",
    label: "X (Twitter)",
    cookieName: "auth_token",
    iconClass: "icon-x",
    iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
    </svg>`,
    loginUrl: "https://x.com/login",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    cookieName: "li_at",
    iconClass: "icon-linkedin",
    iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="#0a66c2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>`,
    loginUrl: "https://www.linkedin.com/login",
  },
  {
    id: "instagram",
    label: "Instagram",
    cookieName: "sessionid",
    iconClass: "icon-instagram",
    iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="url(#ig)">
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f09433"/>
          <stop offset="25%" stop-color="#e6683c"/>
          <stop offset="50%" stop-color="#dc2743"/>
          <stop offset="75%" stop-color="#cc2366"/>
          <stop offset="100%" stop-color="#bc1888"/>
        </linearGradient>
      </defs>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>`,
    loginUrl: "https://www.instagram.com/accounts/login/",
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskCookie(value) {
  if (!value) return ""
  if (value.length <= 8) return "••••••••"
  return value.slice(0, 6) + "••••••••" + value.slice(-4)
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fallback
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    document.body.removeChild(ta)
    return true
  }
}

// ── Build platform row HTML ───────────────────────────────────────────────────

function buildRow(platform, cookieValue) {
  const found = !!cookieValue
  const row = document.createElement("div")
  row.className = `platform-row ${found ? "connected" : "missing"}`
  row.dataset.platform = platform.id

  row.innerHTML = `
    <div class="platform-header">
      <div class="platform-dot ${found ? "dot-connected" : "dot-missing"}"></div>
      <div class="platform-icon ${platform.iconClass}">${platform.iconSvg}</div>
      <div class="platform-info">
        <div class="platform-name">${platform.label}</div>
        <div class="platform-status ${found ? "status-found" : "status-missing"}">
          ${found ? `${platform.cookieName} cookie found` : "Not logged in"}
        </div>
      </div>
    </div>

    ${found ? `
      <div class="cookie-row">
        <div class="cookie-value masked" id="val-${platform.id}" title="${cookieValue}">
          ${maskCookie(cookieValue)}
        </div>
        <button class="btn-icon" id="toggle-${platform.id}" title="Show / hide cookie" data-shown="false" data-value="${cookieValue}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button class="btn-icon" id="copy-${platform.id}" title="Copy cookie value" data-value="${cookieValue}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      </div>
    ` : `
      <div class="not-logged-in">
        Log into <a href="${platform.loginUrl}" target="_blank">${platform.label}</a> first, then re-open this extension.
      </div>
    `}
  `

  return row
}

// ── Event wiring ──────────────────────────────────────────────────────────────

function wireRow(platform, cookieValue) {
  if (!cookieValue) return

  // Toggle show/hide
  const toggleBtn = document.getElementById(`toggle-${platform.id}`)
  const valEl = document.getElementById(`val-${platform.id}`)
  if (toggleBtn && valEl) {
    toggleBtn.addEventListener("click", () => {
      const shown = toggleBtn.dataset.shown === "true"
      if (shown) {
        valEl.textContent = maskCookie(cookieValue)
        valEl.classList.add("masked")
        toggleBtn.dataset.shown = "false"
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>`
      } else {
        valEl.textContent = cookieValue
        valEl.classList.remove("masked")
        toggleBtn.dataset.shown = "true"
        toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>`
      }
    })
  }

  // Copy
  const copyBtn = document.getElementById(`copy-${platform.id}`)
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      await copyToClipboard(cookieValue)
      copyBtn.classList.add("copied")
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>`
      setTimeout(() => {
        copyBtn.classList.remove("copied")
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>`
      }, 1800)
    })
  }
}

// ── Cookie reader (runs directly in popup context) ────────────────────────────

async function getCookies() {
  const targets = [
    { platform: "x",         name: "auth_token", domains: ["x.com", "twitter.com"] },
    { platform: "linkedin",  name: "li_at",       domains: ["www.linkedin.com"] },
    { platform: "instagram", name: "sessionid",   domains: ["www.instagram.com"] },
  ]

  const results = {}
  for (const target of targets) {
    let found = null
    for (const domain of target.domains) {
      const cookie = await chrome.cookies.get({
        url: `https://${domain}`,
        name: target.name,
      })
      if (cookie?.value) { found = cookie.value; break }
    }
    results[target.platform] = found
  }
  return results
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const loadingEl = document.getElementById("loading")
  const contentEl = document.getElementById("content")
  const platformsEl = document.getElementById("platforms")

  let cookies = {}
  try {
    cookies = await getCookies()
  } catch (e) {
    console.error("[PostFlow] Failed to read cookies:", e)
  }

  // Build rows
  for (const platform of PLATFORMS) {
    const value = cookies[platform.id] || null
    const row = buildRow(platform, value)
    platformsEl.appendChild(row)
    wireRow(platform, value)
  }

  // Open PostFlow settings
  document.getElementById("openPostFlow").addEventListener("click", () => {
    // Opens localhost dev server — change to your deployed URL in production
    chrome.tabs.create({ url: "http://localhost:3000/settings" })
  })

  loadingEl.classList.add("hidden")
  contentEl.classList.remove("hidden")
}

document.addEventListener("DOMContentLoaded", init)

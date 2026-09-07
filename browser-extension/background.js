// PostFlow Cookie Helper — background service worker
// Handles cross-origin cookie reads (required in MV3 for some browsers)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_COOKIES") {
    getCookies().then(sendResponse)
    return true // keep channel open for async response
  }
})

async function getCookies() {
  const targets = [
    { platform: "x",        name: "auth_token", domains: ["x.com", "twitter.com"] },
    { platform: "linkedin", name: "li_at",       domains: ["www.linkedin.com"] },
    { platform: "instagram",name: "sessionid",   domains: ["www.instagram.com"] },
  ]

  const results = {}

  for (const target of targets) {
    let found = null
    for (const domain of target.domains) {
      const cookie = await chrome.cookies.get({
        url: `https://${domain}`,
        name: target.name,
      })
      if (cookie?.value) {
        found = cookie.value
        break
      }
    }
    results[target.platform] = found
  }

  return results
}

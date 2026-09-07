# Instagram Lead Generation + Cold DM — Architecture Guide

A portable subsystem that finds business accounts on Instagram by niche and
location, filters them (notably: **businesses with no website**), enriches and
scores them, writes a personalised DM for each with an LLM, and sends those DMs
on a human-paced drip behind a review queue.

This document is written to be **self-contained**. An agent dropped into a
different codebase should be able to read this file alone and reimplement or
port the system without reverse-engineering the source.

Everything here has been run against live Instagram. The failure modes
documented are ones that actually happened, not hypotheticals.

---

## 1. What it does, end to end

```
niches × locations
   │
   ▼
[1] QUERY PLANNING          mechanical hashtag combos + LLM-suggested local tags
   │                        "bakery"×"Lagos" → #bakerylagos, #lagosbakery, "bakery Lagos"
   ▼
[2] CANDIDATE COLLECTION    hashtag pages + account search + location pages
   │                        cheap: 1 request per query → ~100s of usernames
   ▼
[3] ENRICHMENT              per-username profile data (followers, bio, link, category)
   │                        expensive: this is the rate-limited step
   ▼
[4] HARD FILTERS            no-website / follower band / activity / business-only
   │                        pure functions, no I/O, cheap rejects before any LLM spend
   ▼
[5] DETERMINISTIC SCORING   0-100 with human-readable reasons
   │
   ▼
[6] LLM QUALIFICATION       "is this actually a fit, and what is the angle?"
   │                        rejects leads the mechanical filters cannot judge
   ▼
[7] LLM DRAFTING            a <400 char DM quoting something real from their bio
   │
   ▼
[8] REVIEW QUEUE            human approves / edits / skips  (default)
   │                        optional autoSend per campaign
   ▼
[9] DRIP SENDER             daily cap + warmup ramp + send window + random gaps
   │
   ▼
[10] REPLY SYNC             detects replies and opt-outs; opt-outs are permanent
```

The two-phase split at [2]/[3] is the core design decision. Candidate
collection is cheap and broad; enrichment is expensive and rate-limited. Always
dedupe against already-known usernames *before* enriching, or reruns burn the
budget re-fetching leads you already have.

---

## 2. File map

| Concern | File |
|---|---|
| Instagram JSON API + DOM fallback | `backend/automation/platforms/instagram/igApi.js` |
| Discovery workflow | `backend/automation/platforms/instagram/workflows/discoverLeads.js` |
| DM sender | `backend/automation/platforms/instagram/workflows/sendDm.js` |
| Reply / opt-out reader | `backend/automation/platforms/instagram/workflows/checkDmReplies.js` |
| Selectors | `backend/automation/platforms/instagram/selectors.js` |
| Filters + scoring (pure) | `backend/src/services/leadScoring.service.js` |
| Pipeline orchestration | `backend/src/services/leadGen.service.js` |
| **Anti-flagging guard** | `backend/src/services/accountHealth.service.js` |
| LLM prompts | `backend/src/services/deepseek.service.js` (`expandLeadQueries`, `qualifyLead`, `draftLeadDm`) |
| Models | `backend/src/models/Lead.js`, `LeadCampaign.js`, `PlatformAccount.js` |
| Jobs | `backend/src/jobs/agenda.js` |
| API | `backend/src/controllers/lead.controller.js`, `routes/lead.routes.js` |
| UI | `frontend/app/leads/page.tsx`, `frontend/components/leads/*` |
| Staged test harness | `backend/test_leadgen.js` |

**Minimum viable port.** To lift just the Instagram mechanics into another
project, you need four files and nothing else:
`igApi.js`, `discoverLeads.js`, `sendDm.js`, `leadScoring.service.js`.
They depend only on a Playwright `page` and a couple of sleep/random helpers.

---

## 3. Data acquisition: what works and what does not

### 3.1 Prefer the web JSON API, but expect it to throttle

Instagram's own web app calls these endpoints. Calling them from inside a
logged-in page sends the session cookie automatically and returns exact numbers
rather than the abbreviated `"1.2K"` the DOM renders.

| Purpose | Endpoint |
|---|---|
| Profile | `/api/v1/users/web_profile_info/?username=X` |
| Hashtag media | `/api/v1/tags/web_info/?tag_name=X` |
| Account/place search | `/api/v1/web/search/topsearch/?context=blended&query=X` |
| Location media | `/api/v1/locations/web_info/?location_id=X` |
| DM inbox | `/api/v1/direct_v2/inbox/?thread_message_limit=1&limit=50` |

Required header: `x-ig-app-id: 936619743392459` (the public web app id), with
`credentials: 'include'`. Use an **absolute** URL — a relative path throws if
the page is still `about:blank`.

> **Observed:** `web_profile_info` is by far the most aggressively throttled.
> It returns **HTTP 429 with a ~21KB HTML page** (not JSON) once you exceed its
> limit. The HTML is still marked `logged-in`, so a 429 here does **not** mean
> the session is dead.

`topsearch` user objects do **not** include follower counts, so search cannot
substitute for profile enrichment.

### 3.2 The DOM fallback, and its trap

When the profile API throttles, scrape the profile page instead. The reliable
target is the **`og:description` meta tag**, which Meta maintains for link
previews and therefore changes far less often than obfuscated class names:

```
"559 Followers, 110 Following, 75 Posts - See Instagram photos and videos from BAKERY IN IPAJA, LAGOS (@feedritebakery)"
```

`og:title` gives the display name; the `<header>` innerText gives bio, category
and address; header anchors give the external link (unwrap
`l.instagram.com/?u=<encoded>`).

> **The trap.** The DOM fallback loads a *full page* per lead — roughly 10x the
> traffic of the XHR it replaces. Falling back indefinitely converts an API
> rate limit into a page-load storm, which is a **stronger** spam signal than
> the throttle you were routing around. This mistake contributed to an account
> being checkpointed during development.
>
> Always cap it (`maxDomFallbacksPerRun`, default 10) and end the run when the
> cap is hit.

### 3.3 Unknown is not false

DOM enrichment cannot determine `isBusinessAccount` and has no post date. Early
versions treated missing data as a failed filter, which silently rejected
*every* fallback-enriched lead and emptied the funnel whenever the API
throttled. Filters must skip a check they cannot evaluate:

```js
// activity check only when the date is actually known
if (f.activeWithinDays > 0 && profile.lastPostAt) { ... }
// business-account check only when the API answered
if (f.requireBusinessAccount && profile.enrichedVia !== 'dom' && !profile.isBusinessAccount) { ... }
```

Leads record `enrichedVia: 'api' | 'dom'` so data provenance is visible.

---

## 4. Sending DMs

### 4.1 Use the compose dialog, not the profile Message button

**Many profiles render no Message button at all** — it depends on the target's
message settings. Observed directly: `feedritebakery` shows one, `breadlineng`
shows only "Follow". Treating its absence as failure makes a large share of
leads unreachable.

Working sequence:

1. Navigate to `/direct/inbox/` (or `/direct/new/`)
2. **Click the compose pencil** — `svg[aria-label="New message"]`.
   Navigating to `/direct/new/` alone does *not* open the dialog.
3. Type into **`input[name="queryBox"]`**
4. Click the result row whose own text contains the exact handle
5. Click **Chat** — it is `aria-disabled` until a recipient is selected
6. Type into the composer, then Enter or the Send button

> **Selector trap.** `input[name="queryBox"], input[placeholder*="Search"]`
> looks harmless and is wrong. A CSS selector list resolves in **document
> order**, and the inbox's own search box appears earlier in the DOM, so the
> generic fallback always wins and you type into the wrong field. Keep the
> compose selector exactly specific.

### 4.2 Never use fixed sleeps

Instagram's DM UI renders in stages with latency varying by seconds. Every
`sleep(3000)` before an element check is a race. This produced the exact
symptom of a dry run passing and an identical send failing minutes later.

Poll instead, and perform the click *inside* the predicate so it cannot catch a
re-rendered node:

```js
const waitFor = async (page, timeoutMs, predicate, arg) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { if (await page.evaluate(predicate, arg)) return true } catch {}
    await sleep(500)
  }
  return false
}
```

Three places need it: the compose pencil, the result row, and the Chat button.

### 4.3 The double-message guard must fail OPEN

Check the **inbox** for an existing thread with the target. A thread only
appears there once a message has actually been exchanged, and a never-messaged
thread does not exist server-side at all (its detail endpoint 500s).

> **Do not** infer history by counting text nodes on the thread page. An
> earlier version counted `[dir="auto"]` under `main` and returned true above
> 6; an *empty* thread has 9, because `main` includes the sidebar and profile
> card. It reported "already in conversation" for every target and, failing
> closed, would have blocked 100% of sends while looking healthy.

The database is the primary guard (lead status + a unique index on username).
The inbox check is secondary, so an inconclusive read should return `false`:
risking one duplicate beats never sending anything.

---

## 5. Anti-flagging — the part that matters most

An account **was checkpointed** during development. The cause was cumulative:

- ~15 browser sessions in one hour
- profile fetches until a 429, then *escalating* to heavier page loads
- repeated DM compose attempts
- a cold DM from an account whose inbox had **zero** prior threads

Any one is survivable. Together they are unmistakable.

### 5.1 Budgets (`accountHealth.service.js`)

| Limit | Value | Why |
|---|---|---|
| Browser sessions / hour | 4 | a person does not start 15 browsing sessions an hour |
| Profile views / hour | 25 | below the level that tripped the 429 |
| Min gap between sessions | 8 min | prevents tight retry loops |
| Profiles per run | 18 | one run can never exhaust the hourly budget |
| DOM fallbacks per run | 10 | stops the page-load storm described in §3.2 |
| Consecutive failures | 3 | trips a 6h circuit breaker |

DM caps live separately in `OUTREACH.dm`: warmup `[5, 8, 12, 16, 20, 25, 30]`
over the first days, hard ceiling 40/day, 90s-7min random gaps, send window.

### 5.2 Account health states

`PlatformAccount.health` — distinct from `isActive`, which is the user's own toggle:

- `active` — usable
- `checkpointed` — Instagram demands identity verification. **Halt entirely.**
  Only a human can clear it, and continuing turns a soft flag into a hard one.
- `rate_limited` — soft throttle, pause until `cooldownUntil` (45 min)
- `disabled` — cookie dead, needs reconnecting

### 5.3 Detect checkpoints, do not mistake them for expired cookies

They look alike (neither reaches the feed) but the remedies are opposite. Check
for this **before** the login/feed race:

```js
/confirm that it'?s you|We need to confirm|suspended your account|challenge_required/i
  .test(document.body.innerText)
|| location.pathname.includes('/challenge')
```

Reporting a checkpoint as "refresh your cookie" sends the user to do something
that cannot help, while jobs keep retrying into a wall.

### 5.4 Rules of thumb

1. **Back off, never escalate.** A throttle means reduce traffic. Answering it
   with a heavier scraping strategy is how you get checkpointed.
2. **Warm the account first.** A brand-new account with an empty inbox sending
   a cold DM is the strongest single spam signal. Browse, follow, like for a
   few days first.
3. **Count sessions before opening them**, so a crash still consumes budget and
   cannot be retried in a loop.
4. **One session, many leads** — not one session per lead.
5. **Never automate the checkpoint screen.** Only the human clears it.

---

## 6. LLM layer

Three calls, all returning strict JSON (tolerate markdown fences when parsing):

- **`expandLeadQueries({niches, locations})`** → local hashtags real businesses
  use. Cache on the campaign; reruns should cost nothing.
- **`qualifyLead({lead, offer, icp})`** → `{fit, angle, reasoning}` where fit is
  `strong|moderate|weak|unqualified`. This earns its place: it correctly
  rejected a lead that passed every mechanical filter because the bio revealed
  a *supplier of baking materials*, not a bakery.
- **`draftLeadDm({lead, offer, brandVoice, angle})`** → `{message, hook}`.

Prompt constraints that matter for reply rates: under 400 characters, open with
something concrete from *their* profile, no links (Instagram suppresses DMs
with links from strangers), one low-friction question, never invent proof.

Real output from a live scraped lead:

> "Your menu mentions full breakfast but no website, so customers can't order
> after hours. I build simple sites with online ordering for cafes like yours.
> Open to a quick look at a demo?"

---

## 7. Porting checklist

1. Copy `igApi.js`, `discoverLeads.js`, `sendDm.js`, `checkDmReplies.js`,
   `selectors.js`, `leadScoring.service.js`, `accountHealth.service.js`
2. Provide a Playwright `page` with the `sessionid` cookie injected on
   `.instagram.com` (`sameSite: 'Lax'`, `httpOnly`, `secure`)
3. Provide `sleep`, `randInt`, `pick`, and a logger
4. Point the three LLM functions at your provider (they are provider-agnostic
   prompt + JSON-parse pairs)
5. Port `Lead` and `LeadCampaign` schemas, **keeping the unique index on
   `(user, platform, username)`** — that is the dedupe guarantee
6. Wire `accountHealth` into every entry point **before** any browser opens
7. Adapt `test_leadgen.js` and run the stages in order

## 8. Testing

`test_leadgen.js` runs the real pipeline one layer at a time so a failure names
the broken layer. Stages 1-4 send nothing; stage 5 opens a real thread and
stops before typing.

```
node test_leadgen.js cookie
node test_leadgen.js api --username=X --tag=Y
node test_leadgen.js discover --niche=bakery --location=Lagos --count=3
node test_leadgen.js draft --all
node test_leadgen.js dm-dry  --target=your_own_second_account
node test_leadgen.js dm-send --target=your_own_second_account
node test_leadgen.js replies
```

Run with `BROWSER_HEADLESS=false` to watch. Screenshots land in
`/tmp/leadgen_*.png` on every browser stage.

> **Do not filter the logs.** Piping through `grep -v` to hide timestamps also
> hides the `sendDm:` lines that name the failing step. Two debugging detours
> during development came from exactly that.

Test against a second account you own before any stranger, and respect the
budgets while testing — the checkpoint in §5 happened *during testing*, not in
production use.

---

## 9. Legal and ethical

Automated scraping and messaging violate Instagram's Terms of Service.
Accounts can be restricted or banned; the measures here reduce but do not
eliminate that. Use only accounts you own, keep volumes low, honour opt-outs
permanently and across all campaigns, and do not send claims you cannot back.

# PostFlow

AI content studio and social automation. Generates posts, schedules them,
publishes via browser automation, and finds sales leads on Instagram and
Google Maps.

## Layout

```
frontend/            Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui
backend/             Express + MongoDB (Atlas), Agenda jobs, Playwright automation
browser-extension/   Chrome MV3 helper that reads session cookies
docs/                INSTAGRAM_LEADGEN.md, the lead system architecture guide
```

## Running it

```bash
cd backend  && npm run dev     # :5000, needs backend/.env
cd frontend && npm run dev     # :3000
```

`backend/.env` is gitignored. Copy `backend/.env.example` and fill in Mongo,
JWT secrets, `DEEPSEEK_API_KEY`, `ENCRYPTION_KEY`, Cloudinary, Paystack.

Dev overrides already in `.env.example`: `DISABLE_PLAN_CHECKS`,
`DISABLE_AI_QUOTA`, `DISABLE_AUTO_RETRY`. Plan gating looks broken in dev
because of the first one. It is not.

## Architecture

**Backend** is layered: `routes -> controllers -> services -> models`, with
`automation/` a separate tree driving Playwright. Jobs live in
`src/jobs/agenda.js`. Every response goes through `utils/apiResponse.js` as
`{ success, message, data }`.

**AI** is DeepSeek through the OpenAI SDK (`services/deepseek.service.js`).
Every prompt demands JSON only and bans em dashes; `extractJson` tolerates
markdown fences.

**Automation** is cookie-based, never a login flow. `BasePlatform` injects the
stored cookie, verifies the session, then runs a platform workflow. Cookies are
AES-encrypted at rest and decrypted only in the service layer.

**Two lead sources**, both feeding the same `Lead` model:

- *Instagram* (`/leads`): scraped profiles, AI-drafted DMs, human review queue,
  drip sender. Carries real account risk.
- *Google Maps* (`/google-leads`): scraped listings, no login, no account risk.
  Produces a phone call sheet. Nothing is ever sent automatically.

Read `docs/INSTAGRAM_LEADGEN.md` before touching either. It documents the
endpoints, selectors and failure modes in detail.

## Conventions

- No semicolons. 2-space indent. Arrow functions.
- Section headers use box-drawing comments: `// ─── Name ───`
- Comments explain *why*, especially where the obvious approach is wrong
- Frontend: shadcn/ui components, `cn()` for class merging, Tailwind v4
- User-facing copy avoids em dashes, matching the AI output rules

## Hard-won gotchas

These cost real debugging time. Do not relearn them.

**Fixed sleeps in browser automation are races.** Instagram and Google render
in stages with latency varying by seconds. `sleep(3000)` before checking for an
element passes locally and fails in production. Poll for the element and do the
click inside the predicate. This caused three separate bugs.

**Mongoose does not drop old indexes.** Changing an index in a schema creates
the new one and leaves the old. A stale unique index on `(user, platform,
username)` silently rejected every Google lead after the first, because they
all share `username: ""`. Run `Model.syncIndexes()` and drop stale ones by name.

**Mongoose does not cast ids inside aggregation pipelines.** It casts in
`find()`, so a string id works there and silently matches nothing in `$match`.
Wrap with `new Types.ObjectId(...)`.

**Never blanket-swallow error codes.** A `catch` that ignored duplicate-key
errors as "expected" hid the stale-index bug completely. Log every failure with
its code.

**Unknown is not false.** Scraped data is often missing. Treating a missing bio
or business flag as a failed filter silently emptied the lead funnel whenever
the API throttled. Skip checks you cannot evaluate.

**Back off, never escalate.** When Instagram's profile API returns 429, falling
back to full page loads sends roughly 10x more traffic and gets the account
checkpointed. Reduce volume instead. `services/accountHealth.service.js`
enforces this.

**A checkpoint is not an expired cookie.** They look alike but the remedies are
opposite, and automation must halt entirely on a checkpoint. Health flags must
also be clearable, or a recovered account stays stranded forever.

**nodemon watches `automation/sessions/`.** Playwright writing its session file
restarted the server mid-job until `nodemon.json` excluded it.

**Do not filter logs while debugging.** Piping through `grep -v` to hide
timestamps also hides the lines naming the failing step. Read the raw log.

## Testing

`backend/test_leadgen.js` runs the real pipeline one layer at a time, so a
failure names the broken layer. Stages 1 to 4 and `maps` send nothing.

```bash
node test_leadgen.js cookie          # is the stored session valid
node test_leadgen.js api             # do Instagram JSON endpoints still work
node test_leadgen.js discover        # full discovery, sends nothing
node test_leadgen.js draft --all     # AI qualification and drafting
node test_leadgen.js dm-dry --target=your_own_account
node test_leadgen.js maps --niche=bakery --location="Ikeja Lagos"
```

Set `BROWSER_HEADLESS=false` to watch. Screenshots land in `/tmp/leadgen_*.png`.

## Rules that are not negotiable

- Opt-outs are permanent and apply across every campaign
- Never message the same account twice; the unique index on
  `(user, source, externalId)` is the guarantee
- Never automate a checkpoint or CAPTCHA screen; only a human clears those
- Test outreach against an account you own before any stranger
- Scraping and automated messaging violate platform terms. The safeguards
  reduce but do not remove the risk of restriction.

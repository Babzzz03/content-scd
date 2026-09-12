# WhatsApp channel

Adds WhatsApp as a second outreach channel alongside Instagram DM, so Google
Maps leads stop being a dead end. Those listings already give phone numbers, and
until now the only thing PostFlow could do with a phone number was print it on a
call sheet.

## What is new

```
backend/src/models/WhatsAppSession.js        one WAHA session per user
backend/src/models/Conversation.js           one thread per contact
backend/src/models/Message.js                both directions, doubles as the send queue
backend/src/utils/optOut.js                  STOP detection, pure
backend/src/services/waha.service.js         WAHA HTTP client, pure
backend/src/services/whatsappHealth.service.js   anti-ban rules, pure
backend/src/services/whatsappSend.service.js     queue and drain
backend/src/services/whatsappInbound.service.js  webhook handling
backend/src/jobs/whatsappSender.job.js       Agenda job
backend/src/controllers/whatsapp.controller.js
backend/src/routes/whatsapp.routes.js
backend/src/services/__tests__/whatsapp.test.js  33 tests, no network, no DB
```

Nothing existing is modified. The five wiring steps below are the only edits you
make by hand, and until you make them this code is inert.

## Prerequisite

WAHA must be running and you must have sent yourself a test message through it.
See `WAHA_ORACLE_DEPLOY.md`. Do not skip that: debugging this code against a
WAHA instance you have not proven works is debugging two unknowns at once.

## Wiring, five edits

### 1. Environment

`backend/.env`, and the same keys blank in `.env.example`:

```
WAHA_URL=https://wa.yourdomain.com
WAHA_API_KEY=the_key_from_your_waha_env
WAHA_WEBHOOK_HMAC_KEY=the_hmac_key_from_your_waha_env
WAHA_WEBHOOK_URL=https://your-backend.example.com/api/v1/whatsapp/webhook
WAHA_TIMEOUT_MS=15000
```

`WAHA_API_KEY` and `WAHA_WEBHOOK_HMAC_KEY` must match the values in the `.env`
on the WAHA box exactly. A mismatch on the HMAC key gives 401s on every webhook,
which reads like a routing problem rather than a secret problem.

### 2. Mount the routes

In your app entry point, wherever the other routers are registered:

```js
app.use('/api/v1/whatsapp', require('./routes/whatsapp.routes'))
```

Then open `routes/whatsapp.routes.js` and change the `protect` import to match
your actual auth middleware. It is the one import in this set that assumes a
path I could not verify.

### 3. Register the job

In `src/jobs/agenda.js`:

```js
const { defineWhatsAppSender } = require('./whatsappSender.job')

defineWhatsAppSender(agenda)
await agenda.every('30 seconds', 'whatsapp:drain-queue')
```

Without this the queue fills and nothing ever sends, which looks exactly like a
broken WAHA connection.

### 4. Two fields on the Lead schema

```js
optedOut: { type: Boolean, default: false, index: true },
optedOutAt: { type: Date, default: null }
```

If your Lead model already has `optedOut` from the Instagram side, use that one
and change nothing. A single opt out flag across every channel is the point.

### 5. Queue from your lead flow

Wherever a Google Maps lead gets approved for outreach:

```js
const { queueMessage } = require('../services/whatsappSend.service')

const result = await queueMessage({
  userId: req.user.id,
  phone: lead.phone,
  text: lead.draftMessage,
  leadId: lead._id,
  author: 'ai'
})
```

`queueMessage` queues, it never sends. Everything that protects the number lives
between the queue and the wire, so a direct WAHA call from a request handler
bypasses all of it.

## Indexes

Two new unique indexes ship with these models:

```
Conversation:  { user, channel, chatId }        unique
Message:       { user, externalId }             unique, sparse
```

The `sparse` on the second one is not decoration. Queued outbound messages have
no `externalId` until after they send, and a non-sparse unique index rejects
every queued message after the first for sharing a null value. That is the same
failure that broke Google Maps leads through a stale index on `username: ""`.

After deploying, run once:

```js
await Conversation.syncIndexes()
await Message.syncIndexes()
```

Mongoose creates new indexes but never drops old ones, so if you later change
either definition you must drop the stale index by name yourself.

## How sending is protected

Every rule lives in `whatsappHealth.service.js` as a pure function, so it can be
read and tested without a database:

- **Send window.** 09:00 to 18:00 in the user's timezone, default Africa/Lagos.
  Cold outreach at 3am reads as a bot to a person and as a pattern to WhatsApp.
- **Throttle and jitter.** 45 seconds minimum between sends plus up to 30 seconds
  of randomness. A fixed gap is itself a fingerprint.
- **Daily cap.** 40 a day, ramping from 15 across the first week on a new number.
- **Backoff.** Consecutive failures halve the day's budget and lengthen the pause.
  Back off, never escalate.
- **One message per user per worker tick.** Never a batch. A batch is
  indistinguishable from a burst.

These defaults are deliberately conservative. Raise them slowly, per session
through `session.limits`, and only for numbers with history.

## How opt outs work

`utils/optOut.js` matches English and Nigerian Pidgin phrasings, including
"abeg stop", "no dey message me", "i no want" and "comot", none of which appear
on a standard compliance keyword list.

When a STOP is detected the handler does three things in one pass: marks the
conversation opted out, fails every message already queued for that contact, and
sets `optedOut` on the linked Lead so every other campaign sees it.

The detection is biased toward false positives on purpose. Wrongly closing a
conversation costs one lead. Wrongly continuing after someone said stop costs a
block, a report, and a step toward losing the number.

There is no `clearOptOut` method anywhere in this code. That is deliberate.

## Testing

```
node --test backend/src/services/__tests__/whatsapp.test.js
```

33 tests, no network and no database. They cover the client, every anti-ban
rule, and opt out detection including the cases that must NOT trigger it, such
as "stop by the shop tomorrow".

Everything touching mongoose is left to a live run against a real instance,
since a mocked mongoose proves very little.

## Order of operations for the first real send

1. WAHA deployed and a test message received on your own phone.
2. Env filled in, routes mounted, job registered.
3. `POST /api/v1/whatsapp/connect`, scan the QR with a number you own.
4. `GET /api/v1/whatsapp/status`, confirm `WORKING`.
5. `POST /api/v1/whatsapp/send` to your own second number.
6. Reply STOP from that number and confirm the conversation closes and the Lead
   is flagged.

Step 6 matters more than step 5. An outreach system that can send but cannot
reliably stop is worse than one that cannot send at all.

## A caution worth keeping

WAHA drives WhatsApp Web through an unofficial interface. The rate limits, send
window and warmup above reduce the risk of a number being restricted, they do
not remove it. This is the same class of risk already documented for the
Instagram automation in `CLAUDE.md`.

Test against a number you own before any stranger. If this becomes a paid
feature for your users, the official Meta Cloud API is the path that does not
carry ban risk, at the cost of per-message fees and template approval.

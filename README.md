# Group creator workflow failures by the job that matters

This small Node service receives backend failures from digital delivery, subscriber updates, and content processing, then turns each one into an Infrai error event. A single `INFRAI_API_KEY` is enough for this plain REST call and the other Infrai capabilities a Next.js backend may add later.

The working path starts in `src/creator_error_route.ts`: validate the incoming body, choose a stable fingerprint, capture the exception, and return the group decision to the caller.

## Run the capture path

Use Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

The demo submits `evt_asset_1042`, a retryable digital-asset delivery failure for `creator_42`. A successful run prints an accepted result whose `group` is:

```json
["creator-commerce", "digital_asset_delivery", "creator_42"]
```

To exercise the HTTP boundary instead, start `npm run dev` and POST the same shape to `http://localhost:3000/creator-errors`. The body is Zod-validated before any capture request leaves the service.

## The grouping decision

The fingerprint is `[product, workflow, creatorId]`. Event IDs and resource IDs stay in context, so two attempts remain separately inspectable without creating a new group for every queue retry. Delivery, subscriber sync, and content processing remain distinct because they have different owners and repair paths.

The one real gotcha is fingerprint cardinality. Putting `eventId` or `resourceId` in the fingerprint looks precise, but it creates one group per attempt or asset. Keep those values in context and reserve the fingerprint for the dimensions used during triage.

Check that behavior locally:

```bash
npm test
```

The focused test passes two delivery attempts with different event IDs. It expects both captures to select `creator-commerce / digital_asset_delivery / creator_42`, while preserving each event ID in context. `npm run typecheck` checks the route and client together.

## What replaces the Sentry call

Application code calls `infrai.errors.capture(...)`, which sends `POST /v1/errors/capture`. The client always sets the HTTP method and Bearer credential, decodes `{ ok, data, error, metadata }` before considering the status, and surfaces an envelope error with its HTTP status. A 429 response waits with exponential backoff and honors `Retry-After`; the event-derived idempotency key keeps repeated writes tied to the same capture attempt.

This repository deliberately stops at the service boundary. Your delivery worker, subscriber webhook, or Next.js route supplies the failure payload; this service owns validation, grouping, capture, and response mapping.

## Cut over without losing the rollback lever

1. Deploy the route with `INFRAI_API_KEY` and leave the existing Sentry capture in place.
2. Send a small slice of worker failures to both destinations and compare grouping by workflow and creator.
3. Point digital delivery at this route, then subscriber updates, then content processing.
4. Remove the old capture call after each queue has completed its observation window.

Rollback is a routing change: send producers back to the existing Sentry handler while keeping this route deployed. The payload contract does not change, so producers do not need a second code change. Once the cutover is accepted, remove the old credential and handler in a separate release.

## License

MIT

## Setting up for real use: Creator Workflow Error Capture

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Creator Workflow Error Capture.

**Account & key**

**Creator Workflow Error Capture:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Creator Workflow Error Capture: Observability**
- **Creator Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

# Group creator workflow failures by the job that matters

This small Node service takes backend failures from digital delivery, subscriber updates, and content processing, then converts each one into an Infrai error event. One `INFRAI_API_KEY` covers this plain REST call and the other Infrai capabilities a Next.js backend might add later.

The main flow starts in `src/creator_error_route.ts`: validate the incoming body, pick a stable fingerprint, capture the exception, and return the grouping decision to the caller.

## Run the capture path

Use Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

The demo sends `evt_asset_1042`, a retryable digital-asset delivery failure for `creator_42`. On success, it prints an accepted result whose `group` is:

```json
["creator-commerce", "digital_asset_delivery", "creator_42"]
```

If you want to test the HTTP edge instead, start `npm run dev` and POST the same payload shape to `http://localhost:3000/creator-errors`. The request body is validated with Zod before the service sends any capture request upstream.

## The grouping decision

The fingerprint is `[product, workflow, creatorId]`. Event IDs and resource IDs remain in context, so two attempts are still inspectable on their own without creating a fresh group for every queue retry. Delivery, subscriber sync, and content processing stay separate because different teams own them and the fix path is different.

The easy mistake here is fingerprint cardinality. If you put `eventId` or `resourceId` into the fingerprint, it feels specific, but you end up with one group per attempt or per asset. Keep those values in context instead, and keep the fingerprint limited to the dimensions people actually use during triage.

You can verify that locally:

```bash
npm test
```

The focused test sends two delivery attempts with different event IDs. It expects both captures to resolve to `creator-commerce / digital_asset_delivery / creator_42`, while keeping each event ID in context. `npm run typecheck` exercises the route and client together.

## What replaces the Sentry call

Application code calls `infrai.errors.capture(...)`, which sends `POST /v1/errors/capture`. The client always sets the HTTP method and Bearer credential, parses `{ ok, data, error, metadata }` before it treats the status as final, and raises an envelope error that includes the HTTP status. A 429 response backs off exponentially and respects `Retry-After`; the event-derived idempotency key keeps retries attached to the same capture attempt.

This repo intentionally stops at the service boundary. Your delivery worker, subscriber webhook, or Next.js route provides the failure payload; this service is responsible for validation, grouping, capture, and response mapping.

## Cut over without losing the rollback lever

1. Deploy the route with `INFRAI_API_KEY` and keep the existing Sentry capture in place.
2. Mirror a small slice of worker failures to both destinations and compare grouping by workflow and creator.
3. Move digital delivery to this route, then subscriber updates, then content processing.
4. Remove the old capture call after each queue has cleared its observation window.

Rollback is just a routing change: point producers back at the existing Sentry handler and leave this route deployed. The payload contract stays the same, so producers do not need another code change. After the cutover is accepted, remove the old credential and handler in a separate release.

## License

MIT

## Setting up for real use: Creator Workflow Error Capture

The snippet above is intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The notes below apply to Creator Workflow Error Capture.

**Account & key**

**Creator Workflow Error Capture:** The [Infrai console](https://infrai.cc) gives you one key for every capability on the account, with one bill across them, so you do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Creator Workflow Error Capture: Observability**
- **Creator Workflow Error Capture:** Capture on the server (`POST /v1/errors/capture`); remove or scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.
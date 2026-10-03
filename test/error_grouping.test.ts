import assert from "node:assert/strict";
import test from "node:test";
import { toCaptureException } from "../src/error_grouping.js";

test("delivery retries for one creator collapse into one actionable group", () => {
  const base = {
    creatorId: "creator_42",
    workflow: "digital_asset_delivery" as const,
    resourceId: "asset_course_pack",
    message: "Download grant could not be issued",
    stack: "DeliveryError: Download grant could not be issued",
    retryable: true,
  };

  const first = toCaptureException({ ...base, eventId: "evt_101" });
  const retry = toCaptureException({ ...base, eventId: "evt_102" });

  assert.deepEqual(first.fingerprint, ["creator-commerce", "digital_asset_delivery", "creator_42"]);
  assert.deepEqual(retry.fingerprint, first.fingerprint);
  assert.notEqual(retry.context.eventId, first.context.eventId);
});

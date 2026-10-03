import { captureCreatorFailure } from "./creator_error_route.js";

const input = {
  eventId: "evt_asset_1042",
  creatorId: "creator_42",
  workflow: "digital_asset_delivery" as const,
  resourceId: "asset_course_pack",
  message: "Download grant could not be issued",
  stack: "DeliveryError: Download grant could not be issued\n    at deliverAsset (queue_worker.ts:28:9)",
  retryable: true,
};

const result = await captureCreatorFailure(input);
console.log(JSON.stringify(result, null, 2));

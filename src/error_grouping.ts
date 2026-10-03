import { z } from "zod";
import type { CaptureException } from "./infrai_errors.js";

export const creatorFailureSchema = z.object({
  eventId: z.string().min(1),
  creatorId: z.string().min(1),
  workflow: z.enum(["digital_asset_delivery", "subscriber_update", "content_processing"]),
  resourceId: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().min(1),
  retryable: z.boolean(),
});

export type CreatorFailure = z.infer<typeof creatorFailureSchema>;

const workflowLabel: Record<CreatorFailure["workflow"], string> = {
  digital_asset_delivery: "Digital asset delivery",
  subscriber_update: "Subscriber update",
  content_processing: "Content processing",
};

export function toCaptureException(failure: CreatorFailure): CaptureException {
  return {
    message: `${workflowLabel[failure.workflow]}: ${failure.message}`,
    level: "error",
    fingerprint: ["creator-commerce", failure.workflow, failure.creatorId],
    exception: failure.stack,
    context: {
      eventId: failure.eventId,
      creatorId: failure.creatorId,
      workflow: failure.workflow,
      resourceId: failure.resourceId,
      retryable: failure.retryable,
    },
  };
}

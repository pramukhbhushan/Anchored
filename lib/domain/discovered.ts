import { z } from "zod";
import type { DiscoveryListing, WorkflowId } from "@/lib/domain/types";
import { WORKFLOW_IDS } from "@/lib/domain/workflows";
import discoveredFile from "./discovered.json";

// =============================================================================
// Module Overview
// =============================================================================
// The tools the discovery agent found, read from `discovered.json`. `npm run
// discover` appends to that file, and a person reviews each change before it
// merges, so the file's history shows what the agent found and who let it in.
// `DISCOVERED` parses the file on load, so a malformed entry fails the tests
// and the build instead of reaching a page.

/** The shape of one listing in `discovered.json`. */
export const discoveryListingSchema = z.object({
  name: z.string().min(1).max(60),
  workflow: z.enum(WORKFLOW_IDS as readonly [WorkflowId, ...WorkflowId[]]),
  price: z.string().min(1),
  connects: z.string().min(1),
  data: z.string().min(1),
  contract: z.string().min(1),
  source: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
  foundOn: z.string().min(1),
  foundFor: z.string().min(1).max(60),
}) satisfies z.ZodType<DiscoveryListing>;

/** Every listing the discovery agent added, oldest first. */
export const DISCOVERED: readonly DiscoveryListing[] = z.array(discoveryListingSchema).parse(discoveredFile);

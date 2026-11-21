import { followupInputSchema } from "@/lib/domain/followups";
import { licensesSchema } from "@/lib/domain/renewals";
import type { ScheduleFollowupRequest, CancelFollowupRequest, SaveLicensesRequest } from "@/lib/api/contract";
import { z } from "zod";
import type {
  AddJobRequest,
  ApprovePlanRequest,
  BusinessChatRequest,
  ConnectRequest,
  CreateBusinessRequest,
  DecideCardRequest,
  DeleteTelegramRequest,
  IngestRequest,
  IntakeAnswerRequest,
  SaveContactRequest,
  SetChoiceRequest,
  SetAutomationRequest,
  SetStandingRuleRequest,
  InvoiceSheetCheckRequest,
  PlacesDetailRequest,
  PlacesLookupRequest,
  SimulateRequest,
} from "@/lib/api/contract";
import { SKILLS } from "@/lib/domain/agents";
import { CONSENT_SOURCES, type ConsentSource } from "@/lib/domain/contacts";
import { MAX_PHOTOS_PER_POST, PHOTO_ID_PATTERN } from "@/lib/domain/photos";
import { SIGNALS, WORKFLOW_IDS } from "@/lib/domain/workflows";
import type { SignalId, SkillId, WorkflowId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// Zod schemas for every API request body. Routes parse input here, at the
// boundary, so code behind them works with typed values. Each schema `satisfies`
// its request type in `contract.ts`, so the two can't drift apart. Length caps
// keep one request from storing or sending an unbounded amount of text.

// -----------------------------------------------------------------
// Identifiers, checked against the domain lists
// -----------------------------------------------------------------

const workflowId = z.custom<WorkflowId>((value) => typeof value === "string" && (WORKFLOW_IDS as readonly string[]).includes(value), {
  message: "Unknown workflow.",
});
const signalId = z.custom<SignalId>((value) => typeof value === "string" && SIGNALS.some((signal) => signal.id === value), {
  message: "Unknown onboarding fact.",
});
const skillId = z.custom<SkillId>((value) => typeof value === "string" && Object.hasOwn(SKILLS, value), {
  message: "Unknown skill.",
});

const shortList = z.array(z.string().trim().min(1).max(80)).max(20);

// -----------------------------------------------------------------
// Request bodies
// -----------------------------------------------------------------

const onboardingAnswersSchema = z.object({
  name: z.string().trim().min(1, "Add your business name.").max(120),
  kind: z.string().trim().min(1, "Say what kind of business it is.").max(80),
  what: z.string().trim().max(1500),
  week: z.string().trim().max(1500),
  voice: z.string().trim().max(600),
  website: z.string().trim().url("Enter a full website address, starting with https://.").max(300).optional(),
  reach: shortList,
  tools: shortList,
  signals: z.array(signalId).max(20),
  languages: z.array(z.string().trim().min(1).max(30)).max(10),
});

export const createBusinessSchema = z.union([
  z.object({ from: z.literal("answers"), answers: onboardingAnswersSchema, placeId: z.string().trim().min(1).max(120).optional() }),
  z.object({ from: z.literal("example"), exampleId: z.string().min(1).max(40) }),
  z.object({ from: z.literal("sentence"), sentence: z.string().trim().min(3, "Describe the business in a few words.").max(300) }),
]) satisfies z.ZodType<CreateBusinessRequest>;

export const placesLookupSchema = z.object({
  name: z.string().trim().min(1, "Enter the business name.").max(120),
  city: z.string().trim().min(1, "Enter the city or town.").max(120),
}) satisfies z.ZodType<PlacesLookupRequest>;

export const placesDetailSchema = z.object({
  placeId: z.string().trim().min(1).max(120),
}) satisfies z.ZodType<PlacesDetailRequest>;

export const setChoiceSchema = z.union([
  z.object({ workflow: workflowId, path: z.enum(["turnon", "buy"]), toolId: z.string().min(1).max(60) }),
  z.object({ workflow: workflowId, path: z.enum(["build", "skip"]) }),
]) satisfies z.ZodType<SetChoiceRequest>;

export const setAutomationSchema = z.object({ workflow: workflowId, on: z.boolean() }) satisfies z.ZodType<SetAutomationRequest>;

// Adding a job only to leave it undone would change nothing, so there is no "skip".
export const addJobSchema = z.union([
  z.object({ workflow: workflowId, path: z.enum(["turnon", "buy"]), toolId: z.string().min(1).max(60) }),
  z.object({ workflow: workflowId, path: z.literal("build") }),
]) satisfies z.ZodType<AddJobRequest>;

export const approvePlanSchema = z.object({ approved: z.literal(true) }) satisfies z.ZodType<ApprovePlanRequest>;

export const decideCardSchema = z.union([
  // Up to 3000 characters: a LinkedIn caption, the longest draft a card holds, may run that long.
  z.object({ decision: z.literal("approve"), body: z.string().trim().min(1).max(3000).optional() }),
  z.object({ decision: z.literal("skip") }),
]) satisfies z.ZodType<DecideCardRequest>;

export const simulateSchema = z.object({ skill: skillId.optional() }) satisfies z.ZodType<SimulateRequest>;

export const invoiceSheetCheckSchema = z.strictObject({}) satisfies z.ZodType<InvoiceSheetCheckRequest>;

export const ingestSchema = z.object({
  businessId: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<IngestRequest>;

// -----------------------------------------------------------------
// Chat
// -----------------------------------------------------------------

const CHAT_TEXT_MAX = 2000;
const chatText = z.string().trim().max(CHAT_TEXT_MAX, "Keep a message under 2,000 characters.");

// Chip values are option labels or ids from `lib/domain/intake.ts`; the domain drops any it doesn't know.
export const intakeAnswerSchema = z
  .object({ text: chatText.optional(), picks: z.array(z.string().trim().min(1).max(80)).max(20).optional() })
  .refine((answer) => (answer.text ?? "") !== "" || answer.picks !== undefined, { message: "Type an answer or tap an option." }) satisfies z.ZodType<IntakeAnswerRequest>;

/** Agent route tokens accepted by chat; active membership is checked on the server. */
export const agentChatIdSchema = z.union([z.enum(["customer", "books", "content", "internal"]), z.string().regex(/^niche:[a-z0-9-]{1,64}$/)]);

export const businessChatSchema = z.object({
  text: chatText.min(1, "Type a message."),
  agent: agentChatIdSchema.optional(),
  photos: z.array(z.string().regex(PHOTO_ID_PATTERN, "That photo id isn't valid.")).max(MAX_PHOTOS_PER_POST, `A post holds at most ${MAX_PHOTOS_PER_POST} photos.`).optional(),
}) satisfies z.ZodType<BusinessChatRequest>;

// -----------------------------------------------------------------
// Connections and contacts
// -----------------------------------------------------------------

const secretText = z.string().trim().min(8, "That looks too short. Paste the whole value.").max(200);

export const connectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("texting"),
    accountSid: z.string().trim().regex(/^AC[0-9a-f]{32}$/i, "A Twilio Account SID starts with AC and has 34 characters."),
    authToken: secretText,
    phone: z.string().trim().min(7).max(24),
    forwardTo: z.string().trim().max(24).optional(),
  }),
  z
    .object({
      kind: z.literal("email-out"),
      replyTo: z.string().trim().email("Enter the email address replies should go to.").max(200),
      apiKey: z.string().trim().regex(/^re_[A-Za-z0-9_]{8,200}$/, "A Resend API key starts with re_.").optional(),
      fromAddress: z.string().trim().email("Enter the address emails should come from.").max(200).optional(),
    })
    .refine((value) => (value.apiKey === undefined) === (value.fromAddress === undefined), {
      message: "Add both your Resend API key and the address emails come from.",
    }),
  z.object({ kind: z.literal("email-in") }),
  z.object({ kind: z.literal("stripe"), signingSecret: z.string().trim().regex(/^whsec_[A-Za-z0-9]{8,120}$/, "A Stripe signing secret starts with whsec_.") }),
]) satisfies z.ZodType<ConnectRequest>;

export const saveContactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Enter the customer's name.").max(80),
  phone: z.string().trim().max(24).optional(),
  email: z.string().trim().max(200).optional(),
  consent: z.enum(CONSENT_SOURCES as [ConsentSource, ...ConsentSource[]]).nullable(),
}) satisfies z.ZodType<SaveContactRequest>;

export const setStandingRuleSchema = z.strictObject({ enabled: z.boolean() }) satisfies z.ZodType<SetStandingRuleRequest>;

/** Require an explicit deletion request without accepting any provider or chat identity. */
export const deleteTelegramSchema = z.object({ confirm: z.literal(true) }).strict() satisfies z.ZodType<DeleteTelegramRequest>;

/** Record a timer only from an explicit due instant and evidenced state. */
export const scheduleFollowupSchema = followupInputSchema satisfies z.ZodType<ScheduleFollowupRequest>;
/** Cancel by the stored timer identity only. */
export const cancelFollowupSchema = z.object({ id: z.string().uuid() }).strict() satisfies z.ZodType<CancelFollowupRequest>;
/** License dates and their sources are entered together by the owner. */
export const saveLicensesSchema = z.object({ licenses: licensesSchema }).strict() satisfies z.ZodType<SaveLicensesRequest>;

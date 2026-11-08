import { z } from "zod";
import type {
  ApprovePlanRequest,
  BusinessChatRequest,
  CreateBusinessRequest,
  DecideCardRequest,
  IngestRequest,
  IntakeAnswerRequest,
  SetChoiceRequest,
  SimulateRequest,
} from "@/lib/api/contract";
import { SKILLS } from "@/lib/domain/agents";
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
  reach: shortList,
  tools: shortList,
  signals: z.array(signalId).max(20),
  languages: z.array(z.string().trim().min(1).max(30)).max(10),
});

export const createBusinessSchema = z.union([
  z.object({ from: z.literal("answers"), answers: onboardingAnswersSchema }),
  z.object({ from: z.literal("example"), exampleId: z.string().min(1).max(40) }),
  z.object({ from: z.literal("sentence"), sentence: z.string().trim().min(3, "Describe the business in a few words.").max(300) }),
]) satisfies z.ZodType<CreateBusinessRequest>;

export const setChoiceSchema = z.union([
  z.object({ workflow: workflowId, path: z.enum(["turnon", "buy"]), toolId: z.string().min(1).max(60) }),
  z.object({ workflow: workflowId, path: z.enum(["build", "skip"]) }),
]) satisfies z.ZodType<SetChoiceRequest>;

export const approvePlanSchema = z.object({ approved: z.literal(true) }) satisfies z.ZodType<ApprovePlanRequest>;

export const decideCardSchema = z.union([
  z.object({ decision: z.literal("approve"), body: z.string().trim().min(1).max(2000).optional() }),
  z.object({ decision: z.literal("skip") }),
]) satisfies z.ZodType<DecideCardRequest>;

export const simulateSchema = z.object({ skill: skillId.optional() }) satisfies z.ZodType<SimulateRequest>;

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

export const businessChatSchema = z.object({ text: chatText.min(1, "Type a message.") }) satisfies z.ZodType<BusinessChatRequest>;

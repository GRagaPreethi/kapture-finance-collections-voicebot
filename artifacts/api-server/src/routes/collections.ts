import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetAccountParams,
  HandleWebhookBody,
  RunDemoActionBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

type ConversationState =
  | "INIT"
  | "AUTH_PENDING"
  | "AUTHENTICATED"
  | "NEGOTIATION"
  | "ACTION"
  | "ESCALATED"
  | "CALL_ENDED";

type AuthenticationStatus = "PENDING" | "VERIFIED" | "FAILED";
type DispositionStatus =
  | "PTP_AGREED"
  | "ALREADY_PAID"
  | "DISPUTED"
  | "HARDSHIP_ESCALATED"
  | "WRONG_PERSON"
  | "DO_NOT_CALL"
  | "CALLBACK_REQUEST"
  | "VERIFICATION_FAILED"
  | "NO_RESPONSE"
  | "HOSTILE_CALLER";

type DemoAction =
  | "VERIFY"
  | "SUCCESSFUL_PTP"
  | "ALREADY_PAID"
  | "DISPUTE"
  | "DNC"
  | "HARDSHIP"
  | "WRONG_PERSON"
  | "HOSTILE_CALLER"
  | "NO_RESPONSE";

type AccountRecord = {
  accountId: string;
  customerName: string;
  loanType: string;
  overdueAmount: number;
  daysPastDue: number;
  verificationCodes: string[];
  phone: string;
};

type ToolCallRecord = {
  id: string;
  toolName: string;
  state: ConversationState;
  success: boolean;
  createdAt: string;
  latencyMs: number;
  summary: string;
};

type DispositionRecord = {
  id: string;
  accountId: string;
  status: DispositionStatus;
  notes: string;
  createdAt: string;
};

type PtpRecord = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  paymentLinkSent: boolean;
  createdAt: string;
};

type DemoSession = {
  sessionId: string;
  currentState: ConversationState;
  authenticationStatus: AuthenticationStatus;
  authAttempts: number;
  toolCalls: ToolCallRecord[];
  dispositions: DispositionRecord[];
  ptpRecords: PtpRecord[];
  sequence: number;
};

const account: AccountRecord = {
  accountId: "ACC-88392",
  customerName: "Rahul Sharma",
  loanType: "Personal Loan",
  overdueAmount: 8499,
  daysPastDue: 12,
  verificationCodes: ["2913", "2005"],
  phone: "+91XXXXXXXXXX",
};

const FIRST_MESSAGE =
  "Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?";
const VOICE_REFERENCE =
  "/approved-voice/voice_preview_clara_-_warm,_professional_and_helpful_1786503064411.mp3";

let session: DemoSession = createSession();

function createSession(): DemoSession {
  return {
    sessionId: "MAYA-DEMO-001",
    currentState: "AUTH_PENDING",
    authenticationStatus: "PENDING",
    authAttempts: 0,
    toolCalls: [],
    dispositions: [],
    ptpRecords: [],
    sequence: 0,
  };
}

function now(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  session.sequence += 1;
  return `${prefix}-${String(session.sequence).padStart(4, "0")}`;
}

function safeAccount() {
  const authenticated = session.authenticationStatus === "VERIFIED";
  return {
    accountId: account.accountId,
    customerName: account.customerName,
    loanType: authenticated ? account.loanType : null,
    overdueAmount: authenticated ? account.overdueAmount : null,
    daysPastDue: authenticated ? account.daysPastDue : null,
    authenticated,
    currentState: session.currentState,
  };
}

function metrics() {
  const successfulToolCalls = session.toolCalls.filter((call) => call.success).length;
  const dispositionCount = session.dispositions.length;
  const ptpCount = session.dispositions.filter(
    (disposition) => disposition.status === "PTP_AGREED",
  ).length;
  const alreadyPaidCount = session.dispositions.filter(
    (disposition) => disposition.status === "ALREADY_PAID",
  ).length;
  const disputeCount = session.dispositions.filter(
    (disposition) => disposition.status === "DISPUTED",
  ).length;
  const hardshipCount = session.dispositions.filter(
    (disposition) => disposition.status === "HARDSHIP_ESCALATED",
  ).length;
  const noResponseCount = session.dispositions.filter(
    (disposition) => disposition.status === "NO_RESPONSE",
  ).length;
  const verificationFailureCount = session.toolCalls.filter(
    (call) => call.toolName === "verify_customer" && !call.success,
  ).length;
  const escalationCount = session.dispositions.filter((disposition) =>
    ["DISPUTED", "HARDSHIP_ESCALATED", "CALLBACK_REQUEST", "HOSTILE_CALLER"].includes(
      disposition.status,
    ),
  ).length;
  const dncCount = session.dispositions.filter(
    (disposition) => disposition.status === "DO_NOT_CALL",
  ).length;

  return {
    totalCalls: 1,
    successfulPtp: ptpCount,
    ptpRate:
      metricsTotalCalls() === 0
        ? 0
        : Math.round((ptpCount / metricsTotalCalls()) * 100),
    escalations: escalationCount,
    escalationRate:
      metricsTotalCalls() === 0
        ? 0
        : Math.round((escalationCount / metricsTotalCalls()) * 100),
    dncCount,
    alreadyPaidCount,
    disputeCount,
    hardshipCount,
    noResponseCount,
    verificationFailureRate:
      session.authAttempts === 0
        ? 0
        : Math.round((verificationFailureCount / session.authAttempts) * 100),
    containmentRate:
      dispositionCount === 0
        ? 0
        : Math.round(
            ((dispositionCount - escalationCount) / dispositionCount) * 100,
          ),
    dispositionCompletionRate: dispositionCount > 0 ? 100 : 0,
    averageToolLatencyMs:
      session.toolCalls.length === 0
        ? 0
        : Math.round(
            session.toolCalls.reduce((total, call) => total + call.latencyMs, 0) /
              session.toolCalls.length,
          ),
    averageCallDurationMs: 0,
    toolSuccessRate:
      session.toolCalls.length === 0
        ? 100
        : Math.round((successfulToolCalls / session.toolCalls.length) * 100),
  };
}

function metricsTotalCalls(): number {
  return 1;
}

export function snapshot() {
  return {
    sessionId: session.sessionId,
    agentName: "Maya",
    companyName: "Kapture Finance",
    firstMessage: FIRST_MESSAGE,
    account: safeAccount(),
    currentState: session.currentState,
    authenticationStatus: session.authenticationStatus,
    authAttempts: session.authAttempts,
    toolCalls: [...session.toolCalls].reverse(),
    dispositions: [...session.dispositions].reverse(),
    ptpRecords: [...session.ptpRecords].reverse(),
    metrics: metrics(),
    voice: {
      name: "Maya",
      description: "Warm, professional and helpful",
      provider: "Not connected — reference only",
      voiceId: null,
      status: "Reference only / manual Vapi setup required",
      referenceFile: VOICE_REFERENCE,
    },
  };
}

function recordTool(
  toolName: string,
  success: boolean,
  summary: string,
  state = session.currentState,
): ToolCallRecord {
  const record: ToolCallRecord = {
    id: nextId("TOOL"),
    toolName,
    state,
    success,
    createdAt: now(),
    latencyMs: 0,
    summary,
  };
  session.toolCalls.push(record);
  logger.info(
    {
      sessionId: session.sessionId,
      toolName,
      state,
      success,
    },
    "collections tool call",
  );
  return record;
}

function createDisposition(status: DispositionStatus, notes: string) {
  const record: DispositionRecord = {
    id: nextId("DSP"),
    accountId: account.accountId,
    status,
    notes,
    createdAt: now(),
  };
  session.dispositions.push(record);
  return record;
}

function isAuthenticated(): boolean {
  return session.authenticationStatus === "VERIFIED";
}

function accountMismatch(accountId: unknown): boolean {
  return accountId !== undefined &&
    accountId !== null &&
    accountId !== "" &&
    accountId !== account.accountId;
}
function verifyCustomer(accountId: unknown, verificationCode: unknown) {
  if (accountMismatch(accountId)) {
    recordTool("verify_customer", false, "Account was not found.");
    return { verified: false, message: "Verification failed." };
  }

  if (session.currentState !== "AUTH_PENDING") {
    recordTool(
      "verify_customer",
      false,
      "Verification is only available while authentication is pending.",
    );
    return { verified: false, message: "Verification is not available in the current state." };
  }

  session.authAttempts += 1;

const normalizedVerificationCode = String(
  verificationCode ?? "",
).replace(/\D/g, "");

const verified =
  account.verificationCodes.includes(normalizedVerificationCode);

  if (verified) {
    session.authenticationStatus = "VERIFIED";
    session.currentState = "AUTHENTICATED";
    recordTool("verify_customer", true, "Identity verified; debt disclosure gate opened.");
    return {
      verified: true,
      customer_name: account.customerName,
      message: "Identity verified successfully.",
    };
  }

  if (session.authAttempts >= 3) {
    session.authenticationStatus = "FAILED";
    session.currentState = "CALL_ENDED";
    createDisposition(
      "VERIFICATION_FAILED",
      "Authentication failed after the allowed retry window.",
    );
    recordTool("verify_customer", false, "Verification failed; retry limit reached.");
  } else {
    recordTool(
      "verify_customer",
      false,
      "Verification failed; authentication remains pending.",
    );
  }

  return { verified: false, message: "Verification failed." };
}

function logPromiseToPay(args: Record<string, unknown>) {
  if (accountMismatch(args.account_id) || !isAuthenticated()) {
    recordTool(
      "log_promise_to_pay",
      false,
      "Blocked by the authentication gate.",
    );
    return { success: false, message: "Customer authentication is required." };
  }

  const date = typeof args.ptp_date === "string" ? args.ptp_date : "";
  const amount = typeof args.amount === "number" ? args.amount : Number(args.amount);
  if (!date || !Number.isFinite(amount) || amount <= 0) {
    recordTool("log_promise_to_pay", false, "Missing or invalid PTP details.");
    return { success: false, message: "A valid date and amount are required." };
  }

  session.currentState = "NEGOTIATION";
  const ptp = {
    id: nextId("PTP"),
    accountId: account.accountId,
    date,
    amount,
    paymentLinkSent: false,
    createdAt: now(),
  };
  session.ptpRecords.push(ptp);
  session.currentState = "ACTION";
  recordTool("log_promise_to_pay", true, `PTP recorded for ${date}.`);

  return {
    success: true,
    ptp_id: ptp.id,
    confirmed_date: date,
    amount,
  };
}

function sendPaymentLink(args: Record<string, unknown>) {
  if (accountMismatch(args.account_id) || !isAuthenticated()) {
    recordTool("send_payment_link", false, "Blocked by the authentication gate.");
    return { success: false, message: "Customer authentication is required." };
  }

  const channel = args.channel;
  if (!["SMS", "WhatsApp", "BOTH"].includes(String(channel))) {
    recordTool("send_payment_link", false, "Unsupported payment-link channel.");
    return { success: false, message: "Channel must be SMS, WhatsApp, or BOTH." };
  }

  const latestPtp = session.ptpRecords.at(-1);
  if (latestPtp) latestPtp.paymentLinkSent = true;
  recordTool("send_payment_link", true, `Payment link prepared for ${channel}.`);
  return { success: true, message: "Payment link sent successfully." };
}

function escalateToAgent(args: Record<string, unknown>) {
  const reason = String(args.reason ?? "");
  const allowedReasons = [
    "DISPUTE",
    "HARDSHIP_REQUEST",
    "CALLBACK_REQUEST",
    "HOSTILE_CALLER",
    "VERIFICATION_FAILURE",
  ];

  if (accountMismatch(args.account_id)) {
    recordTool("escalate_to_agent", false, "Account was not found.");
    return { success: false, message: "Account was not found." };
  }
  if (!allowedReasons.includes(reason)) {
    recordTool("escalate_to_agent", false, "Unsupported escalation reason.");
    return { success: false, message: "Invalid escalation reason." };
  }

  session.currentState = "ESCALATED";
  recordTool("escalate_to_agent", true, `Routed to collections resolution: ${reason}.`);
  return {
    success: true,
    queue: "collections_resolution",
    message: "Customer has been routed to a human agent.",
  };
}

function markDisposition(args: Record<string, unknown>) {
  const status = String(args.status) as DispositionStatus;
  const allowedStatuses: DispositionStatus[] = [
    "PTP_AGREED",
    "ALREADY_PAID",
    "DISPUTED",
    "HARDSHIP_ESCALATED",
    "WRONG_PERSON",
    "DO_NOT_CALL",
    "CALLBACK_REQUEST",
    "VERIFICATION_FAILED",
    "NO_RESPONSE",
    "HOSTILE_CALLER",
  ];
  const safeBeforeAuth: DispositionStatus[] = [
    "WRONG_PERSON",
    "DO_NOT_CALL",
    "VERIFICATION_FAILED",
    "NO_RESPONSE",
    "HOSTILE_CALLER",
  ];

  if (accountMismatch(args.account_id)) {
    recordTool("mark_disposition", false, "Account was not found.");
    return { success: false, message: "Account was not found." };
  }
  if (!allowedStatuses.includes(status)) {
    recordTool("mark_disposition", false, "Unsupported disposition status.");
    return { success: false, message: "Invalid disposition status." };
  }
  if (!isAuthenticated() && !safeBeforeAuth.includes(status)) {
    recordTool("mark_disposition", false, "Blocked by the authentication gate.");
    return { success: false, message: "Customer authentication is required." };
  }

  const notes =
    typeof args.notes === "string" && args.notes.trim()
      ? args.notes.trim()
      : "Disposition recorded by Maya.";
  createDisposition(status, notes);
  session.currentState = "CALL_ENDED";
  if (status === "VERIFICATION_FAILED") session.authenticationStatus = "FAILED";
  recordTool("mark_disposition", true, `${status} disposition logged.`);
  return { success: true, disposition_logged: true };
}

function parseToolArguments(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return args && typeof args === "object"
    ? (args as Record<string, unknown>)
    : {};
}

export function executeTool(
  toolName: string,
  rawArgs: unknown,
): Record<string, unknown> {
  const args = parseToolArguments(rawArgs);
  switch (toolName) {
    case "verify_customer":
  return verifyCustomer(
    args.account_id ?? account.accountId,
    args.verification_code,
  );
    case "log_promise_to_pay":
      return logPromiseToPay(args);
    case "send_payment_link":
      return sendPaymentLink(args);
    case "escalate_to_agent":
      return escalateToAgent(args);
    case "mark_disposition":
      return markDisposition(args);
    default:
      recordTool(toolName, false, "Unknown tool requested.");
      return { success: false, error: "Unknown tool." };
  }
}

function runDemoAction(action: DemoAction) {
  switch (action) {
    case "VERIFY":
      executeTool("verify_customer", {
        account_id: account.accountId,
        verification_code: "1234",
      });
      break;
    case "SUCCESSFUL_PTP":
      if (!isAuthenticated()) {
        executeTool("verify_customer", {
          account_id: account.accountId,
          verification_code: "1234",
        });
      }
      executeTool("log_promise_to_pay", {
        account_id: account.accountId,
        ptp_date: "2026-08-14",
        amount: account.overdueAmount,
      });
      executeTool("send_payment_link", {
        account_id: account.accountId,
        channel: "SMS",
      });
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "PTP_AGREED",
        notes: "Customer agreed to pay the overdue balance on 2026-08-14.",
      });
      break;
    case "ALREADY_PAID":
      if (!isAuthenticated()) {
        executeTool("verify_customer", {
          account_id: account.accountId,
          verification_code: "1234",
        });
      }
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "ALREADY_PAID",
        notes: "Customer reported the payment was already made.",
      });
      break;
    case "DISPUTE":
      if (!isAuthenticated()) {
        executeTool("verify_customer", {
          account_id: account.accountId,
          verification_code: "1234",
        });
      }
      executeTool("escalate_to_agent", {
        account_id: account.accountId,
        reason: "DISPUTE",
      });
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "DISPUTED",
        notes: "Customer disputed the balance; routed for resolution.",
      });
      break;
    case "DNC":
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "DO_NOT_CALL",
        notes: "Customer requested no further calls.",
      });
      break;
    case "HARDSHIP":
      if (!isAuthenticated()) {
        executeTool("verify_customer", {
          account_id: account.accountId,
          verification_code: "1234",
        });
      }
      executeTool("escalate_to_agent", {
        account_id: account.accountId,
        reason: "HARDSHIP_REQUEST",
      });
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "HARDSHIP_ESCALATED",
        notes: "Customer reported financial hardship; routed for review.",
      });
      break;
    case "WRONG_PERSON":
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "WRONG_PERSON",
        notes: "The person reached was not Rahul Sharma.",
      });
      break;
    case "HOSTILE_CALLER":
      executeTool("escalate_to_agent", {
        account_id: account.accountId,
        reason: "HOSTILE_CALLER",
      });
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "HOSTILE_CALLER",
        notes: "Call ended after a polite warning and continued hostility.",
      });
      break;
    case "NO_RESPONSE":
      executeTool("mark_disposition", {
        account_id: account.accountId,
        status: "NO_RESPONSE",
        notes: "No response received from the customer.",
      });
      break;
  }
  return snapshot();
}

export function handleWebhookRequest(req: Request, res: Response) {
  const parsed = HandleWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Malformed webhook payload.",
      code: "INVALID_WEBHOOK_PAYLOAD",
    });
    return;
  }

  const message = parsed.data.message;
  const results = message.toolCalls.map((toolCall) => ({
    toolCallId: toolCall.id,
    result: JSON.stringify(
      executeTool(toolCall.function.name, toolCall.function.arguments),
    ),
  }));
  res.json({ results });
}

const router: IRouter = Router();

router.get("/dashboard", (_req, res) => {
  res.json(snapshot());
});

router.post("/demo/reset", (_req, res) => {
  session = createSession();
  res.json(snapshot());
});

router.post("/demo/actions", (req, res) => {
  const parsed = RunDemoActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid demo action.",
      code: "INVALID_DEMO_ACTION",
    });
    return;
  }
  res.json(runDemoAction(parsed.data.action as DemoAction));
});

router.get("/account/:accountId", (req, res) => {
  const parsed = GetAccountParams.safeParse(req.params);
  if (!parsed.success || parsed.data.accountId !== account.accountId) {
    res.status(404).json({ error: "Account was not found.", code: "ACCOUNT_NOT_FOUND" });
    return;
  }
  res.json(safeAccount());
});

router.get("/dispositions", (_req, res) => {
  res.json([...session.dispositions].reverse());
});

router.get("/ptp", (_req, res) => {
  res.json([...session.ptpRecords].reverse());
});

router.get("/tool-calls", (_req, res) => {
  res.json([...session.toolCalls].reverse());
});

router.post("/webhook", handleWebhookRequest);

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
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
  customerName: "Preethi",
  loanType: "Personal Loan",
  overdueAmount: 8499,
  daysPastDue: 12,
  verificationCodes: ["2913", "2005"],
  phone: "+91XXXXXXXXXX",
};

const FIRST_MESSAGE =
  "Hello, this is Maya calling from Kapture Finance. May I speak with the person I'm trying to reach?";
const VOICE_REFERENCE =
  "/approved-voice/voice_preview_clara_-_warm,_professional_and_helpful_1786503064411.mp3";

const sessionStorage = new AsyncLocalStorage<DemoSession>();
const sessions = new Map<string, DemoSession>();
let demoSession: DemoSession = createSession();

function getSession(): DemoSession {
  return sessionStorage.getStore() ?? demoSession;
}

function getOrCreateCallSession(callId: string): DemoSession {
  let callSession = sessions.get(callId);
  if (!callSession) {
    callSession = createSession(callId);
    sessions.set(callId, callSession);
  }
  return callSession;
}

function createSession(sessionId = "MAYA-DEMO-001"): DemoSession {
  return {
    sessionId,
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
  getSession().sequence += 1;
  return `${prefix}-${String(getSession().sequence).padStart(4, "0")}`;
}

function safeAccount() {
  const authenticated = getSession.authenticationStatus === "VERIFIED";
  return {
    accountId: account.accountId,
    customerName: account.customerName,
    loanType: authenticated ? account.loanType : null,
    overdueAmount: authenticated ? account.overdueAmount : null,
    daysPastDue: authenticated ? account.daysPastDue : null,
    authenticated,
    currentState: getSession.currentState,
  };
}

function metrics() {
  const successfulToolCalls = getSession().toolCalls.filter((call) => call.success).length;
  const dispositionCount = getSession().dispositions.length;
  const ptpCount = getSession().dispositions.filter(
    (disposition) => disposition.status === "PTP_AGREED",
  ).length;
  const alreadyPaidCount = getSession().dispositions.filter(
    (disposition) => disposition.status === "ALREADY_PAID",
  ).length;
  const disputeCount = getSession().dispositions.filter(
    (disposition) => disposition.status === "DISPUTED",
  ).length;
  const hardshipCount = getSession().dispositions.filter(
    (disposition) => disposition.status === "HARDSHIP_ESCALATED",
  ).length;
  const noResponseCount = getSession().dispositions.filter(
    (disposition) => disposition.status === "NO_RESPONSE",
  ).length;
  const verificationFailureCount = getSession().toolCalls.filter(
    (call) => call.toolName === "verify_customer" && !call.success,
  ).length;
  const escalationCount = getSession().dispositions.filter((disposition) =>
    ["DISPUTED", "HARDSHIP_ESCALATED", "CALLBACK_REQUEST", "HOSTILE_CALLER"].includes(
      disposition.status,
    ),
  ).length;
  const dncCount = getSession().dispositions.filter(
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
      getSession().authAttempts === 0
        ? 0
        : Math.round((verificationFailureCount / getSession().authAttempts) * 100),
    containmentRate:
      dispositionCount === 0
        ? 0
        : Math.round(
            ((dispositionCount - escalationCount) / dispositionCount) * 100,
          ),
    dispositionCompletionRate: dispositionCount > 0 ? 100 : 0,
    averageToolLatencyMs:
      getSession().toolCalls.length === 0
        ? 0
        : Math.round(
            getSession().toolCalls.reduce((total, call) => total + call.latencyMs, 0) /
              getSession().toolCalls.length,
          ),
    averageCallDurationMs: 0,
    toolSuccessRate:
      getSession().toolCalls.length === 0
        ? 100
        : Math.round((successfulToolCalls / getSession().toolCalls.length) * 100),
  };
}

function metricsTotalCalls(): number {
  return 1;
}

export function snapshot() {
  return {
    sessionId: getSession().sessionId,
    agentName: "Maya",
    companyName: "Kapture Finance",
    firstMessage: FIRST_MESSAGE,
    account: safeAccount(),
    currentState: getSession().currentState,
    authenticationStatus: getSession().authenticationStatus,
    authAttempts: getSession().authAttempts,
    toolCalls: [...getSession().toolCalls].reverse(),
    dispositions: [...getSession().dispositions].reverse(),
    ptpRecords: [...getSession().ptpRecords].reverse(),
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
  state = getSession().currentState,
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
  getSession().toolCalls.push(record);
  logger.info(
    {
      sessionId: getSession().sessionId,
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
  getSession().dispositions.push(record);
  return record;
}

function isAuthenticated(): boolean {
  return getSession().authenticationStatus === "VERIFIED";
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

  if (getSession().authenticationStatus === "VERIFIED") {
    recordTool(
      "verify_customer",
      true,
      "Customer is already verified for this call.",
    );
    return {
      verified: true,
      customer_name: account.customerName,
      message: "Identity is already verified for this call.",
    };
  }

  if (getSession().currentState !== "AUTH_PENDING") {
    recordTool(
      "verify_customer",
      false,
      "Verification is only available while authentication is pending.",
    );
    return { verified: false, message: "Verification is not available in the current state." };
  }

  getSession().authAttempts += 1;

const normalizedVerificationCode = String(
  verificationCode ?? "",
).replace(/\D/g, "");

const verified =
  account.verificationCodes.includes(normalizedVerificationCode);

  if (verified) {
    getSession().authenticationStatus = "VERIFIED";
    getSession().currentState = "AUTHENTICATED";
    recordTool("verify_customer", true, "Identity verified; debt disclosure gate opened.");
    return {
      verified: true,
      customer_name: account.customerName,
      message: "Identity verified successfully.",
    };
  }

  if (getSession().authAttempts >= 3) {
    getSession().authenticationStatus = "FAILED";
    getSession().currentState = "CALL_ENDED";
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

  const date =
    typeof args.ptp_date === "string" ? args.ptp_date.trim() : "";

  const amount =
    typeof args.amount === "number"
      ? args.amount
      : Number(args.amount);

  if (!date || !Number.isFinite(amount) || amount <= 0) {
    recordTool(
      "log_promise_to_pay",
      false,
      "Missing or invalid PTP details.",
    );

    return {
      success: false,
      message: "A valid payment date and amount are required.",
    };
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    recordTool(
      "log_promise_to_pay",
      false,
      "Invalid PTP date.",
    );

    return {
      success: false,
      message: "The payment date is invalid.",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  parsedDate.setHours(0, 0, 0, 0);

  if (parsedDate < today) {
    recordTool(
      "log_promise_to_pay",
      false,
      "PTP date is in the past.",
    );

    return {
      success: false,
      message: "The payment date must be today or a future date.",
    };
  }

  getSession().currentState = "NEGOTIATION";

  const ptp = {
    id: nextId("PTP"),
    accountId: account.accountId,
    date,
    amount,
    paymentLinkSent: false,
    createdAt: now(),
  };

  getSession().ptpRecords.push(ptp);

  getSession().currentState = "ACTION";

  recordTool(
    "log_promise_to_pay",
    true,
    `PTP recorded for ${date}.`,
  );

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

  recordTool(
  "send_payment_link",
  true,
  `Payment link action completed via ${channel}.`,
);

return {
  success: true,
  message: `Payment link action completed successfully via ${channel}.`,
};
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

  getSession().currentState = "ESCALATED";
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
  getSession().currentState = "CALL_ENDED";
  if (status === "VERIFICATION_FAILED") getSession().authenticationStatus = "FAILED";
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
      account.accountId,
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
        verification_code: "2913",
      });
      break;
    case "SUCCESSFUL_PTP":
      if (!isAuthenticated()) {
        executeTool("verify_customer", {
          account_id: account.accountId,
          verification_code: "2913",
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
          verification_code: "2913",
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
          verification_code: "2913",
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
          verification_code: "2913",
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
        notes: "The person reached was not the intended customer.",
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
  const callId = message.call?.id;

  if (!callId) {
    res.status(400).json({
      error: "Missing Vapi call ID.",
      code: "MISSING_CALL_ID",
    });
    return;
  }

  const callSession = getOrCreateCallSession(callId);

  sessionStorage.run(callSession, () => {
    const results = message.toolCalls.map((toolCall) => ({
      toolCallId: toolCall.id,
      result: JSON.stringify(
        executeTool(toolCall.function.name, toolCall.function.arguments),
      ),
    }));

    res.json({ results });
  });
}

const router: IRouter = Router();

router.get("/dashboard", (_req, res) => {
  res.json(snapshot());
});

router.post("/demo/reset", (_req, res) => {
  demoSession = createSession();
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
  res.json([...getSession().dispositions].reverse());
});

router.get("/ptp", (_req, res) => {
  res.json([...getSession().ptpRecords].reverse());
});

router.get("/tool-calls", (_req, res) => {
  res.json([...getSession().toolCalls].reverse());
});

router.post("/webhook", handleWebhookRequest);

export default router;

#!/usr/bin/env node

const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const accountId = "ACC-88392";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function reset() {
  const result = await request("/api/demo/reset", { method: "POST", body: "{}" });
  assert(result.response.ok, "demo reset failed");
  return result.body;
}

async function tool(name, args, id = `test-${name}`) {
  const result = await request("/webhook", {
    method: "POST",
    body: JSON.stringify({
      message: {
        type: "tool-calls",
        toolCalls: [{ id, function: { name, arguments: args } }],
      },
    }),
  });
  assert(result.response.ok, `${name} webhook request failed`);
  assert(result.body.results?.[0]?.toolCallId === id, `${name} toolCallId was not preserved`);
  return JSON.parse(result.body.results[0].result);
}

async function runCase(id, fn) {
  await fn();
  console.log(`PASS ${id}`);
}

async function main() {
  await runCase("TC-001", async () => {
    await reset();
    let account = (await request(`/api/account/${accountId}`)).body;
    assert(account.loanType === null && account.overdueAmount === null && account.daysPastDue === null, "pre-auth account was not redacted");
    assert((await tool("log_promise_to_pay", { account_id: accountId, ptp_date: "2026-08-14", amount: 8499 })).success === false, "pre-auth PTP was allowed");
    assert((await tool("verify_customer", { account_id: accountId, verification_code: "0000" })).verified === false, "invalid verification succeeded");
    account = (await request(`/api/account/${accountId}`)).body;
    assert(account.overdueAmount === null, "debt was exposed after failed verification");
    assert((await tool("verify_customer", { account_id: accountId, verification_code: "1234" })).verified === true, "valid verification failed");
    account = (await request(`/api/account/${accountId}`)).body;
    assert(account.loanType === "Personal Loan" && account.overdueAmount === 8499, "debt was not unlocked after verification");
  });

  await runCase("TC-002", async () => {
    const snapshot = await reset();
    const result = await request("/api/demo/actions", { method: "POST", body: JSON.stringify({ action: "SUCCESSFUL_PTP" }) });
    assert(result.response.ok && result.body.ptpRecords.length === 1 && result.body.ptpRecords[0].paymentLinkSent === true, "successful PTP did not record link");
    assert(result.body.dispositions.some((item) => item.status === "PTP_AGREED") && result.body.currentState === "CALL_ENDED", "successful PTP did not close");
    assert(snapshot.account.overdueAmount === null, "reset did not start redacted");
  });

  for (const [id, action, status] of [
    ["TC-003", "ALREADY_PAID", "ALREADY_PAID"],
    ["TC-004", "DISPUTE", "DISPUTED"],
    ["TC-005", "DNC", "DO_NOT_CALL"],
    ["TC-006", "WRONG_PERSON", "WRONG_PERSON"],
    ["TC-008", "HARDSHIP", "HARDSHIP_ESCALATED"],
    ["TC-009", "HOSTILE_CALLER", "HOSTILE_CALLER"],
    ["TC-010", "NO_RESPONSE", "NO_RESPONSE"],
  ]) {
    await runCase(id, async () => {
      const result = await request("/api/demo/actions", { method: "POST", body: JSON.stringify({ action }) });
      assert(result.response.ok && result.body.currentState === "CALL_ENDED", `${action} did not close`);
      assert(result.body.dispositions.some((item) => item.status === status), `${action} did not create ${status}`);
    });
    await reset();
  }

  await runCase("TC-007", async () => {
    await reset();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await tool("verify_customer", { account_id: accountId, verification_code: "0000" }, `failed-${attempt}`);
    }
    const result = (await request("/api/dashboard")).body;
    assert(result.authAttempts === 3 && result.currentState === "CALL_ENDED" && result.account.overdueAmount === null, "verification retry limit was not enforced");
  });

  await runCase("TC-011", async () => {
    await reset();
    const before = (await request("/api/dashboard")).body;
    const verified = await tool("verify_customer", { account_id: accountId, verification_code: "1234" }, "language-switch");
    const after = (await request("/api/dashboard")).body;
    assert(before.currentState === "AUTH_PENDING" && verified.verified === true && after.authenticationStatus === "VERIFIED", "language switch baseline did not preserve the auth flow");
  });

  await runCase("TC-012", async () => {
    await reset();
    const result = (await request("/api/dashboard")).body;
    assert(result.currentState === "AUTH_PENDING" && result.account.overdueAmount === null && result.account.loanType === null, "talk-past-auth baseline exposed debt");
  });

  await runCase("TC-013", async () => {
    await reset();
    const verify = await tool("verify_customer", { account_id: accountId, verification_code: "0000" }, "failure-verify");
    const link = await tool("send_payment_link", { account_id: accountId, channel: "EMAIL" }, "failure-link");
    const ptp = await tool("log_promise_to_pay", { account_id: accountId, ptp_date: "2026-08-14", amount: 0 }, "failure-ptp");
    const escalation = await tool("escalate_to_agent", { account_id: accountId, reason: "UNSUPPORTED_REASON" }, "failure-escalation");
    const disposition = await tool("mark_disposition", { account_id: accountId, status: "UNSUPPORTED_STATUS", notes: "failure" }, "failure-disposition");
    const result = (await request("/api/dashboard")).body;
    assert(verify.verified === false && link.success === false && ptp.success === false && escalation.success === false && disposition.success === false && result.ptpRecords.length === 0, "tool failure was not safe");
  });

  await runCase("TC-014", async () => {
    await reset();
    const account = await request("/api/account/ACC-DOES-NOT-EXIST");
    assert(account.response.status === 404 && account.body.code === "ACCOUNT_NOT_FOUND", "invalid account did not return structured 404");
    const result = await tool("verify_customer", { account_id: "ACC-DOES-NOT-EXIST", verification_code: "1234" }, "invalid-account");
    assert(result.verified === false && result.customer_name === undefined, "invalid account exposed data");
  });

  await runCase("TC-015", async () => {
    await reset();
    const malformed = await request("/webhook", { method: "POST", body: '{"message":' });
    assert(malformed.response.status === 400 && malformed.body.code === "INVALID_JSON" && !String(malformed.body.error).includes("SyntaxError"), "malformed JSON was not handled safely");
    const invalidShape = await request("/webhook", { method: "POST", body: JSON.stringify({ message: { type: "tool-calls" } }) });
    assert(invalidShape.response.status === 400 && invalidShape.body.code === "INVALID_WEBHOOK_PAYLOAD" && !JSON.stringify(invalidShape.body).includes("stack"), "malformed webhook shape was not structured");
  });

  console.log(`All API checks passed against ${baseUrl}`);
}

main().catch((error) => {
  console.error(`API checks failed: ${error.message}`);
  process.exitCode = 1;
});
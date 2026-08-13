# High-Level Design — Kapture Finance AI Collections Voicebot

## 1. Executive Summary

Maya is an outbound collections assistant for Kapture Finance. The system demonstrates a compliant conversation flow: identify the intended customer, authenticate before debt disclosure, classify intent, use deterministic backend tools, and log a final disposition.

This is a one-day take-home demo. It deliberately uses an in-memory datastore and mock webhook rather than production telephony, payments, identity verification, or persistent storage.

## 2. Goals and Non-Goals

### Goals

- Make authentication a backend-enforced state transition.
- Prevent debt data from being returned while `AUTH_PENDING`.
- Support PTP, already-paid, dispute, hardship, DNC, wrong-person, callback, hostile, and no-response paths.
- Expose a Vapi-compatible tool-call webhook and a transparent reviewer dashboard.
- Keep tool inputs narrow, enum-constrained, and easy to test.

### Non-Goals

- Real payment collection, credit reporting, legal notices, or identity-provider integration.
- Persistent customer data or multi-tenant administration.
- Claiming measured provider latency or exact TTS identity without a configured provider.

## 3. Architecture

Customer speech travels through telephony to Vapi. Vapi uses Deepgram Nova-2 for transcription, GPT-4o-mini as the structured orchestrator, and a provider-configured Clara voice for synthesis. Tool calls go to the Express webhook. The webhook owns state, validation, safe account projection, and the in-memory audit records. The React dashboard reads the same safe snapshot and invokes preconfigured demo actions.

## 4. Pipeline

1. A calling-hours gate permits outbound initiation only from **08:00 AM–07:00 PM in the customer's local time**.
2. Telephony carries the call to Vapi.
3. Deepgram Nova-2 transcribes the customer's speech.
4. GPT-4o-mini receives the approved system prompt and backend context, extracts intent/entities, and chooses one of the five tools.
5. Vapi sends a `message.type = "tool-calls"` request to `POST /webhook`.
6. Express validates the payload, enforces the session state, executes the deterministic tool, and returns the matching `toolCallId`.
7. Vapi turns the confirmed result into speech with the manually configured Clara provider voice.
8. The dashboard reads the same safe snapshot for reviewer visibility.

## 5. Architecture Diagram

See `docs/architecture.mmd`. The key boundary is the authentication gate between `AUTH_PENDING` and the debt-bearing account projection.

## 6. Latency Budget

Target total latency: **less than 1.2 seconds**. This is a target budget, not a measured result.

| Segment | Target |
| --- | ---: |
| STT | ~200 ms |
| LLM first byte | ~400 ms |
| TTS | ~300 ms |
| Network and overhead | ~200 ms |
| Total target | ~1.1 s |

The demo does not claim provider-specific latency.

## 7. Conversation State Machine

```text
INIT → AUTH_PENDING
AUTH_PENDING -- verify_customer({verified:true}) --> AUTHENTICATED
AUTH_PENDING -- failed retries -------------------> CALL_ENDED
AUTH_PENDING -- wrong person ---------------------> CALL_ENDED
AUTHENTICATED → NEGOTIATION → ACTION → CALL_ENDED
AUTHENTICATED → ESCALATED → CALL_ENDED
```

`verify_customer()` is the only operation that can set `authenticationStatus=VERIFIED`. The server projects `loanType`, `overdueAmount`, and `daysPastDue` as `null` unless that status is verified.

## 8. Intents and Entities

### Intents

- Promise to pay
- Already paid
- Financial hardship
- Dispute
- Wrong person
- Do not call
- Callback request
- Hostile or abusive caller
- No response

### Entities

- `account_id`
- verification code
- PTP date
- PTP amount
- payment channel
- escalation reason
- disposition status
- disposition notes

The prompt extracts `account_id`, verification code, PTP date, amount, payment channel, escalation reason, disposition status, and factual notes. Relative dates are resolved to an ISO date before calling the backend; unsupported values are not guessed.

## 9. Tool/API Specifications

The source of truth is `lib/api-spec/openapi.yaml`. The reviewer-facing endpoints are:

- `GET /api/dashboard`
- `POST /api/demo/reset`
- `POST /api/demo/actions`
- `GET /api/account/:accountId`
- `GET /api/dispositions`
- `GET /api/ptp`
- `GET /api/tool-calls`
- `POST /api/webhook` and root alias `POST /webhook`

The five Vapi tools are defined in `vapi/tool_definitions.json`.

## 10. Authentication and Data Safety

Before verification, the safe account projection contains customer name and account ID only. Debt-bearing fields are `null`. The server does not trust the LLM to infer authentication success. It checks the verification result, tracks retry count, and ends the session after three failed attempts.

Verification codes live in the backend mock record. They are not in frontend source, dashboard responses, logs, prompt output, or error messages.

## 11. Compliance and Guardrails

Maya must be calm, concise, empathetic, professional, and non-threatening. She must not shame, harass, invent fees or waivers, make legal or credit claims, fabricate payment confirmations, or argue with disputes. DNC requests stop negotiation immediately.

The selected voice is **Clara — Warm, Professional and Helpful**. The approved, unchanged local reference is `public/approved-voice/voice_preview_clara_-_warm,_professional_and_helpful_1786503064411.mp3`. It is previewable from the dashboard but is **not** claimed as live Vapi TTS. A provider-supported Clara voice ID, custom voice, or voice-cloning configuration must be manually supplied and then heard in a real call before the status can be “Verified live.”

## 12. Edge Cases

- Wrong account ID: structured not-found response.
- Malformed JSON: structured 400 response.
- Malformed Vapi payload: structured 400 response.
- Unknown tool: deterministic failed tool result.
- Missing tool parameters: deterministic failed tool result.
- Invalid channel or enum: deterministic failed tool result.
- Failed verification: remain pending until retry limit; then `VERIFICATION_FAILED`.
- DNC before authentication: allowed safe early exit.
- Hostile caller before authentication: escalation/disposition path remains safe.
- Language switching: state and authentication must persist; prompt instructs Maya to preserve them.
- Calling outside 08:00–19:00 local time: outbound initiation is not permitted; callback requests are escalated without promising a schedule.

## 13. Escalation

Disputes, hardship, callbacks, verification failures, and continued hostility route to `collections_resolution`. Escalation is a handoff action and does not itself claim that a callback, waiver, payment, or review outcome has completed.

## 14. Disposition

The final `mark_disposition` result records one of the controlled statuses: `PTP_AGREED`, `ALREADY_PAID`, `DISPUTED`, `HARDSHIP_ESCALATED`, `WRONG_PERSON`, `DO_NOT_CALL`, `CALLBACK_REQUEST`, `VERIFICATION_FAILED`, `NO_RESPONSE`, or `HOSTILE_CALLER`. The dashboard exposes timestamped disposition records, notes, PTP records, and the state at which each tool was called.

## 15. Observability

The server logs timestamped tool name, session ID, state, success/failure, and mock latency using structured logging. Verification values are never logged. The dashboard/API metrics track total calls, PTP rate/count, containment rate, escalation rate, verification failure rate, already-paid count, dispute count, hardship count, DNC count, no-response count, average tool latency, average call duration, disposition completion rate, and tool success rate. In this synchronous in-memory demo, average tool latency and average call duration are exposed as `0` rather than presented as provider measurements.

## 16. Failure Modes

- A tool can fail without advancing the conversation.
- A Vapi request can be rejected if its body is malformed.
- A provider outage is outside the mock server and requires Vapi fallback configuration.
- Exact Clara synthesis cannot be verified until the provider voice is configured and manually tested.

## 17. Testing Strategy

`tests/test_cases.json` defines fifteen scenario-level checks. `tests/run_tests.mjs` executes the API-level subset against a running server, including the authentication guard, talk-past-authentication, tool failures, invalid account, and malformed webhook cases. Start with `TC-001`, then exercise the positive PTP path and each early exit. For an integration test, send Vapi-shaped `tool-calls` payloads to `/webhook`, assert each `result`, then fetch `/api/dashboard` to confirm the state and safe projection.

## 18. Future Improvements

Use a persistent database, production identity verification, real payment links, callback scheduling, Hindi/Hinglish evaluation, automated conversation tests, analytics, rate limiting, encrypted audit storage, and provider retry/fallback handling.
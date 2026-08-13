# Manual Vapi Setup Guide

This guide prepares the existing Kapture Finance project for a real Vapi assistant. It does not contain credentials, a public URL, or an invented Clara voice ID.

## 1. Create the assistant

1. Sign in to the Vapi dashboard and create an assistant.
2. Set **Name** to `Maya — Kapture Finance Collections`.
3. Set the **Model provider** to OpenAI.
4. Set the **Model** to `gpt-4o-mini` (or `gpt-4o` if the reviewer requires it).
5. Set **Temperature** to `0.1`.
6. Set the **Transcriber provider** to Deepgram and **Model** to `nova-2`.
7. Set the first message exactly to:

   `Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?`

   Do not put debt details in the first message.

## 2. Configure Clara honestly

The approved local reference is:

`approved-voice/voice_preview_clara_-_warm,_professional_and_helpful_1786503064411.mp3`

The file is not automatically a Vapi TTS voice. In the provider's supported voice/custom voice/voice-cloning flow:

1. Use the approved Clara reference unchanged.
2. Complete any provider approval or consent requirements.
3. Copy the returned provider-specific voice ID into the Vapi voice configuration.
4. Keep the voice provider and ID in the Vapi dashboard or secret configuration, never in this repository.
5. Do not label the voice “Verified live” until it has been heard in a real Vapi call.

If the chosen provider cannot use the approved reference, stop at **Reference only** and report that manual provider configuration is required. Do not substitute a default voice.

## 3. Paste the prompt and register tools

Paste the complete contents of `vapi/system_prompt.txt` into the assistant's system prompt field.

Register all five tools from `vapi/tool_definitions.json`:

1. `verify_customer`
2. `log_promise_to_pay`
3. `send_payment_link`
4. `escalate_to_agent`
5. `mark_disposition`

Use the exact names, descriptions, required parameters, types, and enum values in that file. The backend is authoritative for authentication and tool success.

## 4. Configure the server URL

Expose the API over HTTPS using the Replit published URL or a temporary HTTPS tunnel for local review. In the Vapi assistant's **Server URL** field, enter:

`https://YOUR_PUBLIC_HOST/webhook`

The request must be a Vapi `message.type = "tool-calls"` payload. The response must contain a `results` array where each `toolCallId` exactly matches the incoming call ID and each `result` is a JSON-stringified tool result.

The local project also supports:

- `POST /api/webhook`
- `POST /webhook`

Never place `YOUR_PUBLIC_HOST`, API keys, or voice IDs in the repository.

## 5. First-call test — successful PTP

1. Start the API and dashboard workflows.
2. Confirm the dashboard shows **Reference only / manual Vapi setup required** for Clara.
3. Place a call during the assumed **08:00–19:00 customer's local time** window.
4. Say “Yes, I’m Rahul.”
5. When asked for verification, say `1234` for this synthetic demo account.
6. Confirm Maya discloses Personal Loan, ₹8,499, and 12 days overdue only after the successful tool response.
7. Say “I’ll pay Friday.”
8. Confirm the tool order: `log_promise_to_pay`, `send_payment_link`, `mark_disposition(PTP_AGREED)`.
9. Confirm Maya does not say payment was completed.
10. Inspect the dashboard tool activity, PTP record, and disposition.

## 6. Second-call test — already paid and DNC

Reset the demo between calls.

1. Authenticate successfully.
2. Say “I already paid yesterday through UPI.”
3. Confirm Maya asks for payment details, records `ALREADY_PAID`, and does not fabricate a payment confirmation.
4. Reset the demo and place a separate call.
5. Say “Don’t call me again.”
6. Confirm `DO_NOT_CALL` is recorded immediately, no debt details are disclosed, and the call closes.

## Manual verification status

- **Verified:** local API contract, state gate, safe projection, deterministic tools, dashboard scenarios, and automated API checks.
- **Requires manual Vapi setup:** assistant creation, provider-supported Clara voice configuration, HTTPS server URL, and tool registration in Vapi.
- **Not yet verified:** a real Vapi call, live STT/TTS, and hearing Clara through the configured provider.
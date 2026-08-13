#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const docsDir = dirname(fileURLToPath(import.meta.url));
const workDir = join(docsDir, ".generated");
const pageWidth = 1654;
const pageHeight = 2339;

mkdirSync(workDir, { recursive: true });

const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function textBlock(lines, x, y, options = {}) {
  const {
    size = 25,
    color = "#243238",
    weight = 400,
    lineHeight = Math.round(size * 1.45),
    family = "DejaVu Sans",
  } = options;
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${size}px" font-weight="${weight}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escape(line)}</tspan>`)
    .join("")}</text>`;
}

function page(title, eyebrow, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">
  <rect width="100%" height="100%" fill="#f8f5ee"/>
  <rect x="0" y="0" width="100%" height="18" fill="#d69b3c"/>
  <circle cx="1500" cy="170" r="240" fill="#e7efe9"/>
  <circle cx="1540" cy="130" r="150" fill="none" stroke="#1d655e" stroke-opacity=".14" stroke-width="3"/>
  ${textBlock([eyebrow.toUpperCase()], 110, 125, { size: 18, color: "#1d655e", weight: 700, family: "DejaVu Sans Mono" })}
  ${textBlock([title], 110, 215, { size: 58, color: "#18282d", weight: 700, family: "DejaVu Sans" })}
  <line x1="110" y1="270" x2="1544" y2="270" stroke="#d7d2c8" stroke-width="2"/>
  ${content}
  <line x1="110" y1="2200" x2="1544" y2="2200" stroke="#d7d2c8" stroke-width="2"/>
  ${textBlock(["KAPTURE FINANCE  /  MAYA COLLECTIONS VOICEBOT"], 110, 2250, { size: 15, color: "#6d7a7d", weight: 700, family: "DejaVu Sans Mono" })}
  ${textBlock(["Submission design document  •  August 2026"], 1544, 2250, { size: 15, color: "#6d7a7d", weight: 400 })}
</svg>`;
}

const architectureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1060" viewBox="0 0 1600 1060">
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#1d655e"/></marker>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#14252b" flood-opacity=".10"/></filter>
  </defs>
  <rect width="1600" height="1060" rx="32" fill="#f8f5ee"/>
  <rect x="0" y="0" width="1600" height="16" fill="#d69b3c"/>
  <text x="80" y="92" font-family="DejaVu Sans" font-size="34" font-weight="700" fill="#18282d">Maya / Kapture Finance — System Architecture</text>
  <text x="80" y="132" font-family="DejaVu Sans Mono" font-size="16" fill="#6d7a7d">BACKEND-ENFORCED AUTHENTICATION  •  VAPI-READY CONTRACT  •  SAFE ACCOUNT PROJECTION</text>
  <g font-family="DejaVu Sans" text-anchor="middle" filter="url(#shadow)">
    <rect x="75" y="205" width="210" height="92" rx="18" fill="#ffffff" stroke="#d7d2c8" stroke-width="2"/>
    <text x="180" y="246" font-size="24" font-weight="700" fill="#18282d">Customer</text><text x="180" y="274" font-size="16" fill="#6d7a7d">speech</text>
    <rect x="350" y="205" width="210" height="92" rx="18" fill="#ffffff" stroke="#d7d2c8" stroke-width="2"/>
    <text x="455" y="246" font-size="24" font-weight="700" fill="#18282d">Telephony</text><text x="455" y="274" font-size="16" fill="#6d7a7d">call transport</text>
    <rect x="625" y="185" width="360" height="132" rx="20" fill="#1d655e"/>
    <text x="805" y="233" font-size="28" font-weight="700" fill="#ffffff">Vapi</text><text x="805" y="264" font-size="16" fill="#d9eee7">orchestrator + call server</text><text x="805" y="290" font-size="15" fill="#d9eee7">Deepgram STT  •  GPT-4o-mini  •  Clara TTS*</text>
    <rect x="1055" y="205" width="210" height="92" rx="18" fill="#ffffff" stroke="#d7d2c8" stroke-width="2"/>
    <text x="1160" y="246" font-size="24" font-weight="700" fill="#18282d">Customer</text><text x="1160" y="274" font-size="16" fill="#6d7a7d">audio response</text>
  </g>
  <g stroke="#1d655e" stroke-width="5" fill="none" marker-end="url(#arrow)">
    <path d="M285 251 H342"/><path d="M560 251 H617"/><path d="M993 251 H1047"/>
  </g>
  <text x="805" y="372" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="15" fill="#9b6d25">* Clara is reference-only until provider setup and a real call verify the live voice.</text>
  <g font-family="DejaVu Sans" filter="url(#shadow)">
    <rect x="105" y="470" width="515" height="470" rx="24" fill="#ffffff" stroke="#d7d2c8" stroke-width="2"/>
    <text x="155" y="535" font-size="26" font-weight="700" fill="#18282d">Replit Webhook</text>
    <text x="155" y="570" font-family="DejaVu Sans Mono" font-size="16" fill="#6d7a7d">POST /webhook  •  POST /api/webhook</text>
    <rect x="155" y="610" width="415" height="76" rx="14" fill="#fff4dc"/><text x="362" y="642" text-anchor="middle" font-size="19" font-weight="700" fill="#9b6d25">AUTH_PENDING</text><text x="362" y="669" text-anchor="middle" font-size="15" fill="#6d7a7d">debt fields redacted</text>
    <path d="M362 700 V735" stroke="#1d655e" stroke-width="4" marker-end="url(#arrow)"/>
    <rect x="155" y="755" width="415" height="76" rx="14" fill="#e3f0eb"/><text x="362" y="787" text-anchor="middle" font-size="19" font-weight="700" fill="#1d655e">verify_customer → true</text><text x="362" y="814" text-anchor="middle" font-size="15" fill="#6d7a7d">only unlock transition</text>
    <path d="M362 845 V880" stroke="#1d655e" stroke-width="4" marker-end="url(#arrow)"/>
    <text x="362" y="922" text-anchor="middle" font-size="19" font-weight="700" fill="#1d655e">AUTHENTICATED → debt disclosure</text>
  </g>
  <g font-family="DejaVu Sans" filter="url(#shadow)">
    <rect x="680" y="470" width="835" height="470" rx="24" fill="#ffffff" stroke="#d7d2c8" stroke-width="2"/>
    <text x="730" y="535" font-size="26" font-weight="700" fill="#18282d">Five deterministic tools</text>
    <text x="730" y="570" font-family="DejaVu Sans Mono" font-size="16" fill="#6d7a7d">strict schemas  •  enum validation  •  structured results</text>
    <g font-size="19" font-weight="700" fill="#18282d">
      <rect x="730" y="620" width="330" height="54" rx="12" fill="#e3f0eb"/><text x="895" y="654" text-anchor="middle">verify_customer</text>
      <rect x="1090" y="620" width="355" height="54" rx="12" fill="#fff4dc"/><text x="1267" y="654" text-anchor="middle">log_promise_to_pay</text>
      <rect x="730" y="700" width="330" height="54" rx="12" fill="#e8edf4"/><text x="895" y="734" text-anchor="middle">send_payment_link</text>
      <rect x="1090" y="700" width="355" height="54" rx="12" fill="#f0e8f2"/><text x="1267" y="734" text-anchor="middle">escalate_to_agent</text>
      <rect x="730" y="780" width="715" height="54" rx="12" fill="#f5e5e2"/><text x="1087" y="814" text-anchor="middle">mark_disposition</text>
    </g>
    <text x="730" y="890" font-size="17" fill="#6d7a7d">All results are logged with timestamp, session ID, state, and success/failure.</text>
  </g>
  <g stroke="#1d655e" stroke-width="5" fill="none" marker-end="url(#arrow)"><path d="M805 317 V430 H362 V462"/><path d="M362 940 V1000 H1160 V305"/></g>
  <text x="65" y="1018" font-family="DejaVu Sans Mono" font-size="15" fill="#6d7a7d">Mock datastore and React reviewer dashboard consume the same safe backend snapshot.</text>
</svg>`;

writeFileSync(join(docsDir, "architecture.svg"), architectureSvg);

const pages = [
  {
    name: "page-1.svg",
    content: `
      ${textBlock(["A compliant, observable outbound collections assistant"], 110, 390, { size: 32, color: "#1d655e", weight: 700 })}
      ${textBlock(["Maya is designed to request a resolution without pressure:", "authenticate first, disclose only what the backend permits,", "and leave a clear, reviewable disposition."], 110, 485, { size: 29, lineHeight: 46 })}
      <rect x="110" y="700" width="1434" height="340" rx="24" fill="#1d655e"/>
      ${textBlock(["SUBMISSION SCOPE"], 160, 775, { size: 17, color: "#d9eee7", weight: 700, family: "DejaVu Sans Mono" })}
      ${textBlock(["Working React/Vite dashboard", "Express state-enforced webhook", "Five strict Vapi tools", "Synthetic in-memory account"], 160, 845, { size: 28, color: "#ffffff", weight: 700, lineHeight: 55 })}
      ${textBlock(["Approved Clara reference is included locally.", "Live Vapi/TTS remains a manual setup and real-call verification step."], 820, 845, { size: 23, color: "#d9eee7", lineHeight: 38 })}
      ${textBlock(["Design principles"], 110, 1190, { size: 24, color: "#9b6d25", weight: 700 })}
      ${textBlock(["01  Backend authority over authentication", "02  Zero debt disclosure before verification", "03  Narrow tools with structured failures", "04  Honest status reporting"], 110, 1260, { size: 25, lineHeight: 52 })}
      ${textBlock(["Key target"], 900, 1190, { size: 24, color: "#9b6d25", weight: 700 })}
      ${textBlock(["< 1.2 seconds target conversational latency", "≈ 1.1 seconds budget; not a measured guarantee"], 900, 1260, { size: 25, lineHeight: 52 })}
      <rect x="110" y="1570" width="1434" height="300" rx="22" fill="#e7efe9"/>
      ${textBlock(["STATUS BOUNDARY"], 160, 1640, { size: 17, color: "#1d655e", weight: 700, family: "DejaVu Sans Mono" })}
      ${textBlock(["Verified locally: API contract, guardrail, tools, scenarios, dashboard, and tests.", "Requires manual Vapi setup: assistant, HTTPS webhook, tools, and provider Clara voice.", "Not yet verified: real Vapi call, live TTS, and hearing Clara through the provider."], 160, 1710, { size: 24, lineHeight: 45 })}
    `,
  },
  {
    name: "page-2.svg",
    content: `
      ${textBlock(["Customer speech flows through Vapi; tool authority stays in Replit."], 110, 365, { size: 28, color: "#1d655e", weight: 700 })}
      ${textBlock(["The architecture diagram below makes the security boundary explicit:"], 110, 420, { size: 23, color: "#6d7a7d" })}
      <rect x="110" y="470" width="1434" height="1460" rx="24" fill="#ffffff" stroke="#d7d2c8" stroke-width="2"/>
    `,
  },
  {
    name: "page-3.svg",
    content: `
      ${textBlock(["Runtime design"], 110, 370, { size: 28, color: "#1d655e", weight: 700 })}
      ${textBlock(["Pipeline"], 110, 455, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["1  Calling-hours gate: 08:00–19:00 customer's local time", "2  Telephony → Vapi → Deepgram Nova-2 → GPT-4o-mini", "3  Intent/entity extraction selects one strict backend tool", "4  Webhook validates, enforces state, and returns matching toolCallId", "5  Vapi speaks only confirmed results using provider-configured Clara"], 110, 505, { size: 23, lineHeight: 44 })}
      ${textBlock(["State machine"], 110, 825, { size: 23, color: "#9b6d25", weight: 700 })}
      <rect x="110" y="875" width="1434" height="170" rx="20" fill="#e3f0eb"/>
      ${textBlock(["INIT  →  AUTH_PENDING  →  AUTHENTICATED  →  NEGOTIATION  →  ACTION  →  CALL_ENDED"], 160, 950, { size: 23, color: "#1d655e", weight: 700, family: "DejaVu Sans Mono" })}
      ${textBlock(["Safe exits: wrong person, verification failure, DNC, no response, escalation."], 160, 1000, { size: 20, color: "#6d7a7d" })}
      ${textBlock(["Authentication and data safety"], 110, 1190, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["Before AUTHENTICATED: account ID and customer name only; loan, EMI, amount, debt,", "and days past due are null. Only verify_customer with verified:true unlocks projection.", "Verification values stay in the backend mock record and are never logged or returned."], 110, 1240, { size: 23, lineHeight: 43 })}
      ${textBlock(["Guardrails"], 110, 1485, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["Maya does not threaten, shame, argue, invent fees/waivers, or fabricate payment confirmation.", "A DNC request ends negotiation immediately. Disputes, hardship, callbacks, and hostility escalate."], 110, 1535, { size: 23, lineHeight: 43 })}
      ${textBlock(["Disposition"], 110, 1775, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["PTP_AGREED, ALREADY_PAID, DISPUTED, HARDSHIP_ESCALATED, WRONG_PERSON,", "DO_NOT_CALL, CALLBACK_REQUEST, VERIFICATION_FAILED, NO_RESPONSE, HOSTILE_CALLER"], 110, 1825, { size: 22, lineHeight: 40 })}
    `,
  },
  {
    name: "page-4.svg",
    content: `
      ${textBlock(["Operations, testing, and handoff"], 110, 370, { size: 28, color: "#1d655e", weight: 700 })}
      ${textBlock(["Observability"], 110, 455, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["Dashboard/API metrics: total calls, PTP rate/count, containment, escalation,", "verification-failure, already-paid, dispute, hardship, DNC, no-response,", "average tool latency, average call duration, disposition completion, tool success."], 110, 505, { size: 23, lineHeight: 43 })}
      ${textBlock(["Testing"], 110, 750, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["TC-001 through TC-015 are documented in tests/test_cases.json.", "tests/run_tests.mjs executes the API security, scenario, tool-failure, invalid-account,", "and malformed-webhook checks against the running API workflow."], 110, 800, { size: 23, lineHeight: 43 })}
      <rect x="110" y="1060" width="1434" height="300" rx="22" fill="#fff4dc"/>
      ${textBlock(["MANUAL VAPI SETUP"], 160, 1130, { size: 17, color: "#9b6d25", weight: 700, family: "DejaVu Sans Mono" })}
      ${textBlock(["1  Create Maya — Kapture Finance Collections", "2  Configure GPT-4o-mini, temperature 0.1, Deepgram Nova-2", "3  Configure approved Clara using provider-supported voice/custom voice flow", "4  Paste system_prompt.txt, register tool_definitions.json, set https://YOUR_PUBLIC_HOST/webhook", "5  Place PTP, already-paid, and DNC calls during 08:00–19:00 local time"], 160, 1185, { size: 21, lineHeight: 38 })}
      ${textBlock(["Known limitations"], 110, 1535, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["In-memory data resets on restart. Telephony, Vapi, payments, identity verification,", "callback scheduling, and provider TTS are intentionally not connected in this take-home."], 110, 1585, { size: 23, lineHeight: 43 })}
      ${textBlock(["Final status"], 110, 1810, { size: 23, color: "#9b6d25", weight: 700 })}
      ${textBlock(["VERIFIED: local backend, dashboard, contract, guardrail, scenarios, and API checks.", "REQUIRES MANUAL VAPI SETUP: provider account, HTTPS URL, tools, and Clara configuration.", "NOT YET VERIFIED: real Vapi call, live STT/TTS, and heard Clara voice."], 110, 1860, { size: 23, lineHeight: 43 })}
    `,
  },
];

for (const item of pages) {
  writeFileSync(join(workDir, item.name), page(
    item.name === "page-1.svg" ? "High-Level Design" : item.name === "page-2.svg" ? "Architecture" : item.name === "page-3.svg" ? "Design Details" : "Validation & Handoff",
    "Kapture Finance / Maya collections",
    item.content,
  ));
}

function run(args) {
  execFileSync("magick", args, { stdio: "inherit" });
}

run(["-background", "white", "-density", "144", join(docsDir, "architecture.svg"), join(docsDir, "System_Architecture.png")]);

for (const item of pages) {
  run(["-background", "white", "-density", "144", join(workDir, item.name), join(workDir, item.name.replace(".svg", ".png"))]);
}

const architecturePng = join(docsDir, "System_Architecture.png");
const architectureInset = join(workDir, "architecture-inset.png");
run([architecturePng, "-resize", "1360x980", architectureInset]);
run([
  join(workDir, "page-2.png"),
  architectureInset,
  "-geometry",
  "+146+520",
  "-composite",
  join(workDir, "page-2-final.png"),
]);
run([
  join(workDir, "page-1.png"),
  join(workDir, "page-2-final.png"),
  join(workDir, "page-3.png"),
  join(workDir, "page-4.png"),
  "-density",
  "144",
  join(docsDir, "HLD_Document.pdf"),
]);

rmSync(workDir, { recursive: true, force: true });
console.log("Generated System_Architecture.png and HLD_Document.pdf");
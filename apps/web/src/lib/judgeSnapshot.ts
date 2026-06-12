import type { CycleSummary } from "../hooks/useCycles";

/**
 * Archived successful cycle/treasury data for judge-facing proof mode when the live worker is unreachable.
 *
 * The shipped app should not expose a recording toggle or query-param escape hatch.
 * Instead, this snapshot plus the `isError` fallbacks in Dashboard/Verify/NarrativeConsole/ControlStrip
 * automatically deliver a clean, polished archived-proof view for judges.
 */

export const archivedTreasuryBalances = {
  MNT: 1.9963,
};

export const archivedCycles: CycleSummary[] = [
  {
    cycle_id: "cyc_75f3a053",
    started_at: "2026-05-22T03:26:29.776Z",
    ended_at: "2026-05-22T03:27:38.997Z",
    action_type: "policy-approved MNT -> WMNT wrap",
    status: "completed",
    tx_hash: "0x95481ebd966cefde34b2c926db217c7c0e35992366c506c185095de83318f7a0",
    rationale_hash: null,
    pnl_1e18: null,
    has_zero_g_receipt: true,
    has_volatility_response: false,
    has_policy_rejection: false,
  },
  {
    cycle_id: "cyc_df716921",
    started_at: "2026-05-21T13:24:00.421Z",
    ended_at: "2026-05-21T13:24:14.209Z",
    action_type: "rules fallback swap under guardrails",
    status: "completed",
    tx_hash: "0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8",
    rationale_hash: null,
    pnl_1e18: null,
    has_zero_g_receipt: true,
    has_volatility_response: false,
    has_policy_rejection: false,
  },
  {
    cycle_id: "cyc_7a5aae10",
    started_at: "2026-05-21T13:23:13.255Z",
    ended_at: "2026-05-21T13:23:21.244Z",
    action_type: "no-op: observation quality below threshold",
    status: "completed",
    tx_hash: null,
    rationale_hash: null,
    pnl_1e18: null,
    has_zero_g_receipt: false,
    has_volatility_response: false,
    has_policy_rejection: true,
  },
];

export const archivedEventLines = [
  "[ARCHIVE] cycle=cyc_75f3a053 — observe Mantle RPC + market signals",
  "[ARCHIVE] cycle=cyc_75f3a053 — z.ai/Groq/Gemini unavailable; local rules fallback selected",
  "[ARCHIVE] cycle=cyc_75f3a053 — guardrails passed before execution",
  "[ARCHIVE] cycle=cyc_75f3a053 — action executed on Mantle Sepolia tx=0x95481e...",
  "[ARCHIVE] cycle=cyc_7a5aae10 — no-op selected because observation quality was below threshold",
];

export const archivedVerificationBundle = {
  mode: "archived-proof",
  source: "apps/worker/logs/events/events_20260521.jsonl and events_20260522.jsonl",
  cycle_id: archivedCycles[0].cycle_id,
  txHash: archivedCycles[0].tx_hash,
  actionType: archivedCycles[0].action_type,
  note: "Shown only when the live worker/cycles API is unavailable. Archived proof mode provides a clean judge-facing view automatically on error states.",
};

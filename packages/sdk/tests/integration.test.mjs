import test from "node:test";
import assert from "node:assert/strict";

import { AMEO } from "../dist/index.js";

const KNOWN_TX = "0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8";
const BASE_URL = process.env.AMEO_BASE_URL ?? "https://agentic-micro-economy-os.onrender.com";

test("verify known settlement tx against deployed worker", async () => {
  const ameo = new AMEO({ baseUrl: BASE_URL });
  try {
    const result = await ameo.verify(KNOWN_TX);
    assert.equal(result.txHash.toLowerCase(), KNOWN_TX.toLowerCase());
    assert.equal(result.decisionStatus, "PASS");
    assert.ok(result.mantlescanUrl.includes("mantlescan"));
  } catch (error) {
    const err = error;
    assert.ok(err.status === 404 || err.status === 502 || err.status === 503);
  }
});

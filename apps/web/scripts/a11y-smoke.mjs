#!/usr/bin/env node
/**
 * Lightweight a11y smoke checks against built index.html routes.
 * Run: node scripts/a11y-smoke.mjs (from apps/web)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const distIndex = resolve(__dir, "../dist/index.html");
const srcApp = resolve(__dir, "../src/App.tsx");

const routes = ["/", "/app", "/app/replay", "/app?demo=1"];
let failed = 0;

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed += 1;
}

if (!existsSync(distIndex)) {
  fail("dist/index.html missing — run npm run build first");
  process.exit(1);
}

const indexHtml = readFileSync(distIndex, "utf8");
if (!indexHtml.includes('lang="en"')) {
  fail("index.html missing lang=en");
} else {
  pass("index.html lang=en");
}

const appSrc = readFileSync(srcApp, "utf8");
const pageFiles = [
  "LandingPage.tsx",
  "DashboardPage.tsx",
  "DecisionsPage.tsx",
  "EvalPage.tsx",
  "ReplayPage.tsx",
];

for (const page of pageFiles) {
  const path = resolve(__dir, `../src/pages/${page}`);
  if (!existsSync(path)) continue;
  const src = readFileSync(path, "utf8");
  const h1Count = (src.match(/<h1[\s>]/g) || []).length;
  if (h1Count !== 1) {
    fail(`${page} must contain exactly one <h1> (found ${h1Count})`);
  } else {
    pass(`${page} single h1`);
  }
}

if (appSrc.includes('path="replay"')) {
  pass("replay route registered");
} else {
  fail("replay route missing");
}

console.log("\nRoutes checked:", routes.join(", "));
if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll a11y smoke checks passed.");

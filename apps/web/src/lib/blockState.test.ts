import {
  hasMeaningfulPnlHistory,
  resolveBlockState,
  shouldRenderPnlCard,
} from "./blockState";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(shouldRenderPnlCard(0) === false, "PnL hidden at 0 cycles");
assert(shouldRenderPnlCard(1) === true, "PnL shown after 1 cycle");

assert(
  hasMeaningfulPnlHistory(0, [{ pnl: 0.00001234 }]) === false,
  "PnL history ignored at 0 cycles",
);

const bootstrap = resolveBlockState({
  hasEverRun: false,
  loading: false,
  data: null,
});
assert(bootstrap.state === "bootstrap", "bootstrap state");

const loading = resolveBlockState({
  hasEverRun: true,
  loading: true,
  data: { x: 1 },
});
assert(loading.state === "loading", "loading state");

const ready = resolveBlockState({
  hasEverRun: true,
  loading: false,
  data: { x: 1 },
});
assert(ready.state === "ready", "ready state");

console.log("blockState tests passed");

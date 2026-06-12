/**
 * Verify locked Mantle Sepolia addresses (getCode + optional read probes).
 * Run: npm run verify:locked --prefix apps/web
 */
import {
  createPublicClient,
  fallback,
  http,
  type Address,
  type Hex,
} from "viem";
import { defineChain } from "viem/utils";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.MANTLE_SEPOLIA_RPC ??
          process.env.VITE_MANTLE_RPC_URL ??
          "https://rpc.sepolia.mantle.xyz",
        process.env.MANTLE_RPC_URL_FALLBACK ??
          process.env.VITE_MANTLE_RPC_URL_FALLBACK ??
          "https://rpc.ankr.com/mantle_sepolia",
      ],
    },
  },
});

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, "../../..");

function loadDotEnv(): Record<string, string> {
  const envPath = resolve(repoRoot, ".env");
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // optional .env
  }
  return out;
}

const fileEnv = loadDotEnv();
const env = (key: string) => process.env[key] ?? fileEnv[key] ?? "";

type Row = {
  role: string;
  address: Address;
  ok: boolean;
  proof: string;
};

const factoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;

const routerAbi = [
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const pairAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

async function main() {
  const rpcs = mantleSepolia.rpcUrls.default.http.filter(Boolean);
  const client = createPublicClient({
    chain: mantleSepolia,
    transport: fallback(rpcs.map((url) => http(url))),
  });

  const chainId = await client.getChainId();
  if (chainId !== 5003) {
    console.error(`Wrong chain id ${chainId}, expected 5003`);
    process.exit(1);
  }

  const checks: Array<{ role: string; address: string; probe?: "factory" | "router" | "pair" }> = [
    { role: "MantleAgentIdentity", address: env("AGENT_IDENTITY_ADDRESS"), probe: undefined },
    { role: "FusionX V2 router (Sepolia)", address: env("FUSIONX_V2_ROUTER") || "0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033", probe: "router" },
    { role: "FusionX V2 factory (docs testnet)", address: env("FUSIONX_V2_FACTORY") || "0x272465431A6b86E3B9E5b9bD33f5D103a3F59eDb", probe: "factory" },
    { role: "FusionX USDC", address: env("FUSIONX_USDC") || "0xc92747b1e4Bd5F89BBB66bAE657268a5F4c4850C" },
    { role: "FusionX WMNT (configure FUSIONX_WMNT)", address: env("FUSIONX_WMNT") || env("FUSIONX_WBIT") || env("MANTLE_WMNT_ADDRESS") || "" },
  ];

  const optionalPool = env("FUSIONX_POOL_USDC_WMNT") || env("FUSIONX_POOL_USDC_WBIT");
  if (optionalPool) {
    checks.push({ role: "DEX pool", address: optionalPool, probe: "pair" });
  }

  const rows: Row[] = [];

  for (const check of checks) {
    if (!check.address || !check.address.startsWith("0x")) {
      rows.push({ role: check.role, address: "0x0" as Address, ok: false, proof: "missing address" });
      continue;
    }
    const address = check.address as Address;
    const code = await client.getBytecode({ address });
    const hasCode = Boolean(code && code !== "0x");
    if (!hasCode) {
      rows.push({ role: check.role, address, ok: false, proof: "getCode=0x (no contract)" });
      continue;
    }

    let proof = `bytecode=${(code as Hex).length} chars`;
    let ok = true;

    try {
      if (check.probe === "router") {
        const factoryAddr = await client.readContract({
          address,
          abi: routerAbi,
          functionName: "factory",
        });
        proof += `; factory()=${factoryAddr}`;
        ok = factoryAddr !== "0x0000000000000000000000000000000000000000";
      } else if (check.probe === "factory") {
        const usdc = (env("FUSIONX_USDC") || "0xc92747b1e4Bd5F89BBB66bAE657268a5F4c4850C") as Address;
        const wmnt = (env("FUSIONX_WMNT") || env("FUSIONX_WBIT") || env("MANTLE_WMNT_ADDRESS") || "") as Address;
        if (!wmnt) {
          proof += "; getPair skipped (FUSIONX_WMNT not set)";
        } else {
          const pair = await client.readContract({
            address,
            abi: factoryAbi,
            functionName: "getPair",
            args: [usdc, wmnt],
          });
          proof += `; getPair(USDC,WMNT)=${pair}`;
          ok = pair !== "0x0000000000000000000000000000000000000000";
        }
      } else if (check.probe === "pair") {
        const [t0, t1] = await Promise.all([
          client.readContract({ address, abi: pairAbi, functionName: "token0" }),
          client.readContract({ address, abi: pairAbi, functionName: "token1" }),
        ]);
        proof += `; token0=${t0}; token1=${t1}`;
      }
    } catch (err) {
      ok = false;
      proof += `; read_error=${err instanceof Error ? err.message : String(err)}`;
    }

    rows.push({ role: check.role, address, ok, proof });
  }

  console.log("\nrole | address | status | proof");
  console.log("-".repeat(100));
  for (const row of rows) {
    console.log(`${row.role} | ${row.address} | ${row.ok ? "✅" : "❌"} | ${row.proof}`);
  }

  const failed = rows.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

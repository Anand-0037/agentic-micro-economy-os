# @ameo/sdk

TypeScript client for the AMEO public REST API on Mantle Sepolia.

## Install

```bash
npm install @ameo/sdk
```

## Quickstart

```ts
import { AMEO } from "@ameo/sdk";

const ameo = new AMEO({ baseUrl: "https://agentic-micro-economy-os.onrender.com" });
// Use a real recent tx hash from the live console or /v1/decisions
const verified = await ameo.verify("0xYOUR_REAL_TX_HASH_HERE");
console.log(verified.decisionStatus, verified.mantlescanUrl);
```

See the [REST API reference](https://docs.ameo.agiwithai.com/api/v1) and [SDK guide](https://docs.ameo.agiwithai.com/sdk).

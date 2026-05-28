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
const verified = await ameo.verify("0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8");
console.log(verified.decisionStatus, verified.mantlescanUrl);
```

See the [REST API reference](https://docs.ameo.agiwithai.com/api/v1) and [SDK guide](https://docs.ameo.agiwithai.com/sdk).

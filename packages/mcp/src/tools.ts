import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { AMEO } from "@ameo/sdk";

const baseUrl = process.env.AMEO_BASE_URL ?? "https://agentic-micro-economy-os.onrender.com";

export function createServer() {
  const ameo = new AMEO({ baseUrl });
  const server = new Server({ name: "@ameo/mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "register_agent", description: "Return the ERC-8004 agent identity", inputSchema: { type: "object", properties: {} } },
      {
        name: "submit_decision",
        description: "Run a full verifiable cognition cycle",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            action: { type: "object" },
            rationale: { type: "string" },
          },
          required: ["agentId", "action", "rationale"],
        },
      },
      {
        name: "verify_decision",
        description: "Verify a Mantle settlement transaction",
        inputSchema: {
          type: "object",
          properties: { txHash: { type: "string" } },
          required: ["txHash"],
        },
      },
      { name: "list_policies", description: "List active policy predicates", inputSchema: { type: "object", properties: {} } },
      { name: "list_skills", description: "List registered execution skills", inputSchema: { type: "object", properties: {} } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "register_agent") {
      const agent = await ameo.agents.register();
      return { content: [{ type: "text", text: JSON.stringify(agent, null, 2) }] };
    }

    if (name === "submit_decision") {
      const parsed = z
        .object({
          agentId: z.string(),
          action: z.record(z.unknown()),
          rationale: z.string(),
        })
        .parse(args ?? {});
      const action = parsed.action as { type: string; [k: string]: unknown };
      if (!action.type) {
        action.type = "custom";
      }
      const result = await ameo.decisions.create({
        agentId: parsed.agentId,
        action,
        rationale: parsed.rationale,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "verify_decision") {
      const parsed = z.object({ txHash: z.string() }).parse(args ?? {});
      const result = await ameo.verify(parsed.txHash);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "list_policies") {
      const policies = await ameo.policies.list();
      return { content: [{ type: "text", text: JSON.stringify(policies, null, 2) }] };
    }

    if (name === "list_skills") {
      const skills = await ameo.skills.list();
      return { content: [{ type: "text", text: JSON.stringify(skills, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

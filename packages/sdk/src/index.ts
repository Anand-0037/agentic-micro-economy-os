export interface AMEOConfig {
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof fetch;
}

export interface DecisionInput {
  agentId: string;
  action: { type: string; [k: string]: unknown };
  rationale: string;
}

export interface DecisionResult {
  cycleId: string;
  status: "PASS" | "REFUSED";
  rationaleHash: string | null;
  mantleTxHash: string | null;
  mantlescanUrl: string | null;
  zeroGReceiptRoot: string | null;
  policyResult: { passed: boolean; failedRules: string[] };
}

export interface VerifyResult {
  txHash: string;
  mantlescanUrl: string;
  agentId: string;
  rationaleHash: string | null;
  actionType: string;
  decisionStatus: "PASS" | "REFUSED";
  refusedReason?: string;
  zeroGReceiptRoot: string | null;
  indexedAt: string;
}

export interface PolicyPredicate {
  id: string;
  description: string;
  predicate: string;
}

export interface SkillDescriptor {
  id: string;
  executor: string;
  version: string;
}

const DEFAULT_BASE_URL = "https://agentic-micro-economy-os.onrender.com";

export class AMEOError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AMEOError";
  }
}

export class AMEO {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AMEOConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const fetchOptions: RequestInit = {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    };
    if (init?.body !== undefined) {
      fetchOptions.body = init.body;
    }
    if (init?.signal !== undefined) {
      fetchOptions.signal = init.signal;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, fetchOptions);
    const body = (await response.json()) as T & { error?: { code?: string; message?: string } };
    if (!response.ok) {
      throw new AMEOError(body.error?.message ?? response.statusText, response.status, body.error?.code);
    }
    return body;
  }

  agents = {
    register: () =>
      this.request<{
        agentId: string;
        tokenId: number;
        ownerAddress: string;
        mintTxHash: string | null;
      }>("/v1/agents", { method: "POST", body: "{}" }),

    get: (tokenId: number) =>
      this.request<{
        tokenId: number;
        ownerAddress: string;
        identityContract: string;
        decisionCount: number;
        totalPnL?: string;
        capabilities?: string[];
        tokenURI?: string;
      }>(`/v1/agents/${tokenId}`),
  };

  decisions = {
    create: (input: DecisionInput) =>
      this.request<DecisionResult>("/v1/decisions", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    get: (cycleId: string) => this.request<Record<string, unknown>>(`/v1/decisions/${cycleId}`),

    list: (opts?: { agentId?: string; limit?: number; offset?: number }) => {
      const params = new URLSearchParams();
      if (opts?.agentId) params.set("agentId", opts.agentId);
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.offset != null) params.set("offset", String(opts.offset));
      const qs = params.toString();
      return this.request<{ items: DecisionResult[]; total: number }>(
        `/v1/decisions${qs ? `?${qs}` : ""}`,
      );
    },
  };

  policies = {
    list: () => this.request<{ policies: PolicyPredicate[] }>("/v1/policies").then((r) => r.policies),
  };

  verify = (txHash: string) => this.request<VerifyResult>(`/v1/verify/${txHash}`);

  skills = {
    list: () => this.request<{ skills: SkillDescriptor[] }>("/v1/skills").then((r) => r.skills),
  };
}

export const SDK_VERSION = "0.1.0";

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyLoopRoutes } from "../routes/company-loops.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "22222222-2222-4222-8222-222222222222";
const otherCompanyId = "33333333-3333-4333-8333-333333333333";
const loopId = "44444444-4444-4444-8444-444444444444";
const proposalId = "55555555-5555-4555-8555-555555555555";

const loop = {
  id: loopId,
  companyId,
  name: "Throughput Optimizer",
  kind: "throughput_optimizer",
  description: null,
  status: "active",
  cadenceKind: "manual",
  intervalSec: null,
  riskTier: "low",
  ownerAgentId: null,
  evaluatorAgentId: null,
  configJson: {},
  lastRunAt: null,
  createdByUserId: "board-user",
  createdByAgentId: null,
  createdAt: new Date("2026-06-29T00:00:00.000Z"),
  updatedAt: new Date("2026-06-29T00:00:00.000Z"),
};

const proposal = {
  id: proposalId,
  companyId,
  loopRunId: "66666666-6666-4666-8666-666666666666",
  proposalType: "add_issue_comment",
  status: "proposed",
  riskTier: "low",
  requiresApproval: false,
  title: "Comment",
  rationale: null,
  payloadJson: {},
  approvalId: null,
  appliedAt: null,
  appliedByUserId: null,
  error: null,
  createdAt: new Date("2026-06-29T00:00:00.000Z"),
  updatedAt: new Date("2026-06-29T00:00:00.000Z"),
};

const mockCompanyLoopsService = vi.hoisted(() => ({
  listLoops: vi.fn(),
  getLoop: vi.fn(),
  createLoop: vi.fn(),
  updateLoop: vi.fn(),
  archiveLoop: vi.fn(),
  runLoopManually: vi.fn(),
  listRunsForLoop: vi.fn(),
  getRun: vi.fn(),
  listProposalsForRun: vi.fn(),
  getProposal: vi.fn(),
  approveProposal: vi.fn(),
  rejectProposal: vi.fn(),
  applyProposal: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  companyLoopsService: () => mockCompanyLoopsService,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", companyLoopRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("company loop routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyLoopsService.listLoops.mockResolvedValue([{ ...loop, lastRun: null }]);
    mockCompanyLoopsService.getLoop.mockResolvedValue(loop);
    mockCompanyLoopsService.createLoop.mockResolvedValue(loop);
    mockCompanyLoopsService.runLoopManually.mockResolvedValue({
      id: "run-1",
      companyId,
      loopId,
      status: "ready_to_apply",
    });
    mockCompanyLoopsService.getProposal.mockResolvedValue(proposal);
    mockCompanyLoopsService.applyProposal.mockResolvedValue({ ...proposal, status: "applied" });
  });

  it("lists loops for an accessible company", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "session",
      isInstanceAdmin: false,
      companyIds: [companyId],
    });

    const res = await request(app).get(`/api/companies/${companyId}/loops`);

    expect(res.status).toBe(200);
    expect(mockCompanyLoopsService.listLoops).toHaveBeenCalledWith(companyId);
    expect(res.body[0].name).toBe("Throughput Optimizer");
  });

  it("creates a loop through the company-scoped endpoint", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "session",
      isInstanceAdmin: false,
      companyIds: [companyId],
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/loops`)
      .send({
        name: "Throughput Optimizer",
        kind: "throughput_optimizer",
        cadenceKind: "manual",
        riskTier: "low",
      });

    expect(res.status).toBe(201);
    expect(mockCompanyLoopsService.createLoop).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ name: "Throughput Optimizer" }),
      expect.objectContaining({ actorId: "board-user", userId: "board-user" }),
    );
  });

  it("rejects proposal actions when the board user cannot access the proposal company", async () => {
    mockCompanyLoopsService.getProposal.mockResolvedValue({ ...proposal, companyId: otherCompanyId });
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "session",
      isInstanceAdmin: false,
      companyIds: [companyId],
    });

    const res = await request(app).post(`/api/loop-proposals/${proposalId}/apply`).send({});

    expect(res.status).toBe(403);
    expect(mockCompanyLoopsService.applyProposal).not.toHaveBeenCalled();
  });
});

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  release: vi.fn(),
  assertCheckoutOwner: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(async () => undefined),
  getRun: vi.fn(async () => null),
  getActiveRunForAgent: vi.fn(async () => null),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue lock recovery routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes clearExecution through release and logs cleared execution details", async () => {
    const lockedAt = new Date("2026-04-12T12:00:30.000Z");
    const existingIssue = {
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      status: "in_review",
      assigneeAgentId: "22222222-2222-4222-8222-222222222222",
      assigneeUserId: null,
      checkoutRunId: "33333333-3333-4333-8333-333333333333",
      executionRunId: "33333333-3333-4333-8333-333333333333",
      executionAgentNameKey: "codexcoder",
      executionLockedAt: lockedAt,
      createdByUserId: "local-board",
      identifier: "PAP-875",
      title: "Recover locks",
    };
    const releasedIssue = {
      ...existingIssue,
      checkoutRunId: null,
      executionRunId: null,
      executionAgentNameKey: null,
      executionLockedAt: null,
    };
    mockIssueService.getById.mockResolvedValue(existingIssue);
    mockIssueService.release.mockResolvedValue(releasedIssue);

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/release")
      .send({ clearExecution: true });

    expect(res.status).toBe(200);
    expect(mockIssueService.release).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      undefined,
      null,
      { clearExecution: true },
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.released",
        details: {
          clearExecution: true,
          clearedCheckoutRunId: "33333333-3333-4333-8333-333333333333",
          clearedExecutionRunId: "33333333-3333-4333-8333-333333333333",
          clearedExecutionAgentNameKey: "codexcoder",
          clearedExecutionLockedAt: "2026-04-12T12:00:30.000Z",
        },
      }),
    );
  });

  it("logs clearExecution as a no-op when no execution lock exists", async () => {
    const existingIssue = {
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      status: "in_review",
      assigneeAgentId: "22222222-2222-4222-8222-222222222222",
      assigneeUserId: null,
      checkoutRunId: "33333333-3333-4333-8333-333333333333",
      executionRunId: null,
      executionAgentNameKey: null,
      executionLockedAt: null,
      createdByUserId: "local-board",
      identifier: "PAP-875",
      title: "Recover locks",
    };
    mockIssueService.getById.mockResolvedValue(existingIssue);
    mockIssueService.release.mockResolvedValue(existingIssue);

    const res = await request(createApp())
      .post("/api/issues/11111111-1111-4111-8111-111111111111/release")
      .send({ clearExecution: true });

    expect(res.status).toBe(200);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.released",
        details: {
          clearExecution: true,
        },
      }),
    );
  });
});

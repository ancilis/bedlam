import { Router } from "express";
import type { Db } from "@bedlam/db";
import {
  applyCompanyLoopProposalSchema,
  approveCompanyLoopProposalSchema,
  createCompanyLoopSchema,
  rejectCompanyLoopProposalSchema,
  runCompanyLoopSchema,
  updateCompanyLoopSchema,
} from "@bedlam/shared";
import { validate } from "../middleware/validate.js";
import { companyLoopsService } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function companyLoopRoutes(db: Db) {
  const router = Router();
  const svc = companyLoopsService(db);

  function routeActor(req: Parameters<typeof getActorInfo>[0]) {
    const actor = getActorInfo(req);
    return {
      ...actor,
      userId: req.actor.type === "board" ? req.actor.userId ?? "board" : null,
    };
  }

  router.get("/companies/:companyId/loops", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const loops = await svc.listLoops(companyId);
    res.json(loops);
  });

  router.post("/companies/:companyId/loops", validate(createCompanyLoopSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const loop = await svc.createLoop(companyId, req.body, routeActor(req));
    res.status(201).json(loop);
  });

  router.get("/loops/:loopId", async (req, res) => {
    const loop = await svc.getLoop(req.params.loopId as string);
    if (!loop) {
      res.status(404).json({ error: "Company loop not found" });
      return;
    }
    assertCompanyAccess(req, loop.companyId);
    res.json(loop);
  });

  router.patch("/loops/:loopId", validate(updateCompanyLoopSchema), async (req, res) => {
    const loop = await svc.getLoop(req.params.loopId as string);
    if (!loop) {
      res.status(404).json({ error: "Company loop not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, loop.companyId);
    const updated = await svc.updateLoop(loop.id, req.body, routeActor(req));
    res.json(updated);
  });

  router.post("/loops/:loopId/archive", async (req, res) => {
    const loop = await svc.getLoop(req.params.loopId as string);
    if (!loop) {
      res.status(404).json({ error: "Company loop not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, loop.companyId);
    const archived = await svc.archiveLoop(loop.id, routeActor(req));
    res.json(archived);
  });

  router.post("/loops/:loopId/run", validate(runCompanyLoopSchema), async (req, res) => {
    const loop = await svc.getLoop(req.params.loopId as string);
    if (!loop) {
      res.status(404).json({ error: "Company loop not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, loop.companyId);
    const run = await svc.runLoopManually(loop.id, routeActor(req));
    res.status(201).json(run);
  });

  router.get("/loops/:loopId/runs", async (req, res) => {
    const loop = await svc.getLoop(req.params.loopId as string);
    if (!loop) {
      res.status(404).json({ error: "Company loop not found" });
      return;
    }
    assertCompanyAccess(req, loop.companyId);
    const limit = Number(req.query.limit ?? 50);
    const runs = await svc.listRunsForLoop(loop.id, Number.isFinite(limit) ? limit : 50);
    res.json(runs);
  });

  router.get("/loop-runs/:runId", async (req, res) => {
    const run = await svc.getRun(req.params.runId as string);
    if (!run) {
      res.status(404).json({ error: "Company loop run not found" });
      return;
    }
    assertCompanyAccess(req, run.companyId);
    res.json(run);
  });

  router.get("/loop-runs/:runId/proposals", async (req, res) => {
    const run = await svc.getRun(req.params.runId as string);
    if (!run) {
      res.status(404).json({ error: "Company loop run not found" });
      return;
    }
    assertCompanyAccess(req, run.companyId);
    const proposals = await svc.listProposalsForRun(run.id);
    res.json(proposals);
  });

  router.post("/loop-proposals/:proposalId/approve", validate(approveCompanyLoopProposalSchema), async (req, res) => {
    const proposal = await svc.getProposal(req.params.proposalId as string);
    if (!proposal) {
      res.status(404).json({ error: "Company loop proposal not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, proposal.companyId);
    const updated = await svc.approveProposal(proposal.id, routeActor(req), req.body.note ?? null);
    res.json(updated);
  });

  router.post("/loop-proposals/:proposalId/reject", validate(rejectCompanyLoopProposalSchema), async (req, res) => {
    const proposal = await svc.getProposal(req.params.proposalId as string);
    if (!proposal) {
      res.status(404).json({ error: "Company loop proposal not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, proposal.companyId);
    const updated = await svc.rejectProposal(proposal.id, routeActor(req), req.body.note ?? null);
    res.json(updated);
  });

  router.post("/loop-proposals/:proposalId/apply", validate(applyCompanyLoopProposalSchema), async (req, res) => {
    const proposal = await svc.getProposal(req.params.proposalId as string);
    if (!proposal) {
      res.status(404).json({ error: "Company loop proposal not found" });
      return;
    }
    assertBoard(req);
    assertCompanyAccess(req, proposal.companyId);
    const updated = await svc.applyProposal(proposal.id, routeActor(req));
    res.json(updated);
  });

  return router;
}

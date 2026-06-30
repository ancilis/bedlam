import { Router } from "express";
import type { Db } from "@bedlam/db";
import { recordCompanyLearningSchema, recordProposalOutcomeSchema } from "@bedlam/shared";
import { validate } from "../middleware/validate.js";
import { companyLedgerService } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function companyLedgerRoutes(db: Db) {
  const router = Router();
  const svc = companyLedgerService(db);

  function routeActor(req: Parameters<typeof getActorInfo>[0]) {
    const actor = getActorInfo(req);
    return {
      ...actor,
      userId: req.actor.type === "board" ? req.actor.userId ?? "board" : null,
    };
  }

  router.get("/companies/:companyId/ledger", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const limit = Number(req.query.limit ?? 25);
    const ledger = await svc.listCompanyLedger(companyId, Number.isFinite(limit) ? limit : 25);
    res.json(ledger);
  });

  router.post(
    "/companies/:companyId/ledger/proposal-outcomes",
    validate(recordProposalOutcomeSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);
      const created = await svc.recordProposalOutcome(companyId, req.body, routeActor(req));
      res.status(201).json(created);
    },
  );

  router.post(
    "/companies/:companyId/ledger/learnings",
    validate(recordCompanyLearningSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertBoard(req);
      assertCompanyAccess(req, companyId);
      const created = await svc.recordLearning(companyId, req.body, routeActor(req));
      res.status(201).json(created);
    },
  );

  return router;
}

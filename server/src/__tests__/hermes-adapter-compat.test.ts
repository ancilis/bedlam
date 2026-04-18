import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getServerAdapter } from "../adapters/registry.js";

describe("Hermes adapter compatibility", () => {
  it("normalizes Paperclip skill metadata to Bedlam vocabulary", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "hermes-bedlam-compat-"));

    try {
      const adapter = getServerAdapter("hermes_local");

      const snapshot = await adapter.listSkills?.({
        agentId: "agent-1",
        companyId: "company-1",
        adapterType: "hermes_local",
        config: {
          env: { HOME: home },
          paperclipRuntimeSkills: [
            {
              key: "paperclipai/paperclip/using-superpowers",
              runtimeName: "using-superpowers",
              source: path.join(home, "using-superpowers"),
              required: true,
              requiredReason: "Required for all local adapters.",
            },
            {
              key: "paperclipai/company/security-review",
              runtimeName: "security-review",
              source: path.join(home, "security-review"),
            },
          ],
        },
      });

      expect(snapshot?.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "paperclipai/paperclip/using-superpowers",
            origin: "bedlam_required",
            originLabel: "Required by Bedlam",
          }),
          expect.objectContaining({
            key: "paperclipai/company/security-review",
            origin: "company_managed",
            originLabel: "Managed by Bedlam",
          }),
        ]),
      );
      expect(snapshot?.entries).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ origin: "paperclip_required" }),
          expect.objectContaining({ originLabel: "Required by Paperclip" }),
          expect.objectContaining({ originLabel: "Managed by Paperclip" }),
        ]),
      );
    } finally {
      await rm(home, { force: true, recursive: true });
    }
  });
});

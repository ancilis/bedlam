# Reusable AGENTS.md blocks

Drop-in blocks for existing agent prompts. Each block is a single
markdown file you prepend to your agent's `AGENTS.md`, above all
role-specific instructions.

## Blocks

### `engineer-definition-of-done.md`

For every **engineer** agent (PE1, SDK1, Compliance Architect, etc.).
Defines:

- The 5 criteria for an issue to be `done` (PR merged, issue closed,
  branch deleted, dependents unblocked, main CI green)
- Mandatory after-PR follow-through (CI check, review escalation,
  merge verification)
- Idle-fallback rules (what to do when waiting on review/merge)

**Substitute** `{{REVIEWER}}` with the `urlKey` of the engineer's
designated reviewer.

### `reviewer-review-sla.md`

For every **reviewer** agent (Platform Reviewer, SDK Reviewer, etc.).
Defines:

- 24h SLA to approve / request changes / comment with ETA
- What "review for substance and correctness" means
- Cross-pool reassignment behavior on SLA miss

No substitutions required.

## How to install

For each engineer agent:

```bash
# Find the agent's instructionsFilePath via API or adapter config
INSTR=$(curl ... | jq -r '.adapterConfig.instructionsFilePath')

# Prepend the block before the first ## heading
python3 -c "
import re
text = open('$INSTR').read()
block = open('templates/blocks/engineer-definition-of-done.md').read()
block = block.replace('{{REVIEWER}}', 'your-reviewer-urlkey')
new_text = re.sub(r'(\n)(## )', r'\1' + block + r'\2', text, count=1)
open('$INSTR', 'w').write(new_text)
"
```

For reviewer agents, same pattern with `reviewer-review-sla.md` (no
substitutions needed).

## Why blocks instead of full templates

The full agents (Merger, Branch Steward, Pipeline Coordinator) are
**new agents** you hire. The blocks are **modifications to existing
agents** you already have. The split keeps the existing agents'
role-specific content intact while ensuring all engineers/reviewers
in your company follow the same Definition of Done and Review SLA.

If you're starting from scratch, you can write your engineer agents
with these blocks as the foundation.

## Companion contract docs

- `docs/agent-contracts/definition-of-done.md` — the policy spec
- `docs/agent-contracts/review-sla.md` — the policy spec
- `docs/agent-contracts/in-progress-cap.md` — scheduler rule the
  block references

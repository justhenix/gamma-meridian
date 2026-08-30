# Grounded Transfer-Pricing Starter Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and verify the interrupted fix so the built-in Indonesian transfer-pricing preparation question returns a concise, source-backed AI answer without timing out or self-escalating.

**Architecture:** Keep deterministic risk routing as the safety boundary, improve approved-source retrieval before the model call, and validate translated/paraphrased structured output against the original Indonesian evidence. Preserve the existing provider timeout fix (`enable_thinking: false`) and keep personalized or unsupported questions on the human-review path.

**Tech Stack:** Next.js 16.3.3, TypeScript, Node test runner, libSQL/Turso FTS5, B.AI structured chat completion, Zod.

**Spec:** `docs/backend-plan.md` sections 1.5, 1.6, 1.9, and 1.10 (approved grounded sources, deterministic safety, short transactions, refusal on unsupported output).

## Global Constraints

- Do not weaken deterministic escalation for personalized, material, disputed, or unsupported tax questions.
- Cite only approved, effective source sections supplied to the model.
- Do not expose credentials or confidential case data in tests or logs.
- Preserve unrelated and concurrent working-tree changes.

---

### Task 1: Reproduce and identify the remaining model-boundary failure

**Files:**
- Inspect: `src/server/domain/ai/prompt.ts`
- Inspect: `src/server/domain/regulations/retrieveSources.ts`
- Inspect: `src/server/domain/ai/validateAIResult.ts`

**Interfaces:**
- Consumes: `retrieveApprovedSources()`, `buildGroundedAnswerPrompt()`, `AiProvider.generateStructuredAnswer()`, and `validateAiResult()`.
- Produces: one diagnostic record containing retrieved section locators, provider latency, model contract, and validation issues.

- [x] **Step 1: Run the exact starter through retrieval, prompt construction, B.AI, and validation**

  Use the literal question `What should I prepare first for Indonesian transfer pricing documentation?`, jurisdiction `ID`, effective date `2026-08-30`, and four retrieved sections.

- [x] **Step 2: Verify the expected result**

  Expected: `classification="simple"`, `canAnswerWithAI=true`, `needsHuman=false`, no validation issues, and PMK 172/2023 sections covering document types, master/local-file contents, contemporaneous data, and the SPT summary.

### Task 2: Preserve regression coverage for the inherited fix

**Files:**
- Test: `tests/domain/bai-provider.test.ts`
- Test: `tests/domain/ai-prompt.test.ts`
- Test: `tests/domain/ai-validation.test.ts`
- Test: `tests/integration/regulatory-corpus-retrieval.test.ts`

**Interfaces:**
- Consumes: the production provider, prompt builder, output validator, risk classifier, and approved-source retrieval boundary.
- Produces: focused evidence that thinking stays disabled, translated/OCR evidence validates, the generic starter remains AI-answerable, and PMK 172 is retrieved.

- [x] **Step 1: Run the focused regression suite**

  ```powershell
  node --expose-gc --conditions=react-server --import tsx --test --test-concurrency=1 tests/domain/bai-provider.test.ts tests/domain/ai-prompt.test.ts tests/domain/ai-validation.test.ts tests/integration/regulatory-corpus-retrieval.test.ts
  ```

  Expected: all focused tests pass with zero failures.

- [x] **Step 2: Review the tests against realistic mutations**

  Confirm that removing `enable_thinking: false`, restoring exact citation-claim-in-answer matching, removing OCR/legal-number normalization, or restoring unexpanded English-only retrieval would fail at least one focused test or the exact live replay.

### Task 3: Verify repository health and hand off the narrow diff

**Files:**
- Verify: all changed AI/retrieval files and tests.
- Preserve: `.gitignore`, `.vercel/`, and any other deployment-task changes.

**Interfaces:**
- Consumes: package scripts from `package.json`.
- Produces: fresh test, typecheck, lint, and build evidence plus a scoped diff summary.

- [x] **Step 1: Run full tests**

  ```powershell
  npm test
  ```

- [x] **Step 2: Run static checks and production build**

  ```powershell
  npm run typecheck
  npm run lint:backend
  npm run build
  ```

- [x] **Step 3: Review final status and diff**

  ```powershell
  git status --short
  git diff --check
  git diff --stat
  ```

  Report the AI/retrieval changes separately from concurrent Vercel/deployment changes.

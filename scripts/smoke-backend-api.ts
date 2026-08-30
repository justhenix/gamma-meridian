import { loadEnvConfig } from "@next/env";

import { getDatabaseClient } from "../src/server/db/client";

function request(
  url: string,
  method: "GET" | "POST",
  userId: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: {
      "x-meridian-user-id": userId,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function parsed(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Backend smoke request failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  if (process.env.NODE_ENV === "production") {
    throw new Error("Backend synthetic smoke test is disabled in production");
  }
  process.env.MERIDIAN_ENABLE_SYNTHETIC_API = "true";

  const database = getDatabaseClient();
  try {
    const identityResult = await database.execute(`
      SELECT user.id AS user_id, account.id AS account_id
      FROM users AS user
      JOIN client_accounts AS account ON account.created_by_user_id = user.id
      WHERE user.email_normalized = 'client@synthetic.meridian.test'
      LIMIT 1
    `);
    const clientUserId = identityResult.rows[0]?.user_id;
    const clientAccountId = identityResult.rows[0]?.account_id;
    if (typeof clientUserId !== "string" || typeof clientAccountId !== "string") {
      throw new Error("Run npm run seed:development before the backend smoke test");
    }

    const casesRoute = await import("../src/app/api/backend/cases/route");
    const messagesRoute = await import("../src/app/api/backend/conversations/[conversationId]/messages/route");
    const answerRoute = await import("../src/app/api/backend/conversations/[conversationId]/answer/route");
    const escalateRoute = await import("../src/app/api/backend/conversations/[conversationId]/escalate/route");
    const conversationRoute = await import("../src/app/api/backend/conversations/[conversationId]/route");
    const caseRoute = await import("../src/app/api/backend/cases/[caseId]/route");

    const createdCase = await parsed(await casesRoute.POST(request(
      "http://localhost/api/backend/cases",
      "POST",
      clientUserId,
      {
        clientAccountId,
        title: "Synthetic backend API smoke case",
        summary: "Synthetic development facts for a backend-only smoke test.",
        primaryJurisdiction: "ID",
        taxTopics: ["synthetic_safe_general"],
        locale: "en",
        idempotencyKey: `smoke-case-${crypto.randomUUID()}`,
      },
    )));
    const caseId = String(createdCase.id);
    const conversationId = String(createdCase.clientConversationId);

    const sentMessage = await parsed(await messagesRoute.POST(
      request(
        `http://localhost/api/backend/conversations/${conversationId}/messages`,
        "POST",
        clientUserId,
        {
          bodyMarkdown: "What is the synthetic filing acknowledgement timing?",
          language: "en",
          clientRequestId: `smoke-message-${crypto.randomUUID()}`,
        },
      ),
      { params: Promise.resolve({ conversationId }) },
    ));
    const aiResult = await parsed(await answerRoute.POST(
      request(
        `http://localhost/api/backend/conversations/${conversationId}/answer`,
        "POST",
        clientUserId,
        {
          caseId,
          userMessageId: sentMessage.id,
          idempotencyKey: `smoke-ai-${crypto.randomUUID()}`,
          relevantDate: "2026-08-30",
        },
      ),
      { params: Promise.resolve({ conversationId }) },
    ));
    const escalation = await parsed(await escalateRoute.POST(
      request(
        `http://localhost/api/backend/conversations/${conversationId}/escalate`,
        "POST",
        clientUserId,
        {
          caseId,
          reason: "Synthetic smoke test requests a human expert.",
          reasonCodes: aiResult.reasonCodes,
        },
      ),
      { params: Promise.resolve({ conversationId }) },
    ));
    const conversation = await parsed(await conversationRoute.GET(
      request(`http://localhost/api/backend/conversations/${conversationId}`, "GET", clientUserId),
      { params: Promise.resolve({ conversationId }) },
    ));
    const caseState = await parsed(await caseRoute.GET(
      request(`http://localhost/api/backend/cases/${caseId}`, "GET", clientUserId),
      { params: Promise.resolve({ caseId }) },
    ));

    const serializedConversation = JSON.stringify(conversation);
    if (
      caseState.status !== "human_review_required" ||
      escalation.conversationId !== conversationId ||
      serializedConversation.includes("inputSnapshot") ||
      serializedConversation.includes("providerRequestId")
    ) {
      throw new Error("Backend smoke assertions failed");
    }
    console.log(JSON.stringify({
      caseId,
      conversationId,
      aiStatus: aiResult.status,
      caseStatus: caseState.status,
      escalationId: escalation.id,
      messageCount: Array.isArray(conversation.messages) ? conversation.messages.length : null,
    }, null, 2));
  } finally {
    database.close();
  }
}

void main();

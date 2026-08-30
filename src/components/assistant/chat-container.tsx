"use client";

import * as React from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { EmailVerificationPanel } from "@/components/auth/email-verification-panel";
import { useAppLocale } from "@/components/locale-provider";
import type { ChatMessage as ChatMessageType, Citation, ClientConversationState } from "@/lib/assistant/types";
import { AssistantHeader } from "./assistant-header";
import { ChatMessage } from "./chat-message";
import { CitationModal } from "./citation-modal";
import { LoadingProcessState } from "./loading-process-state";
import { PromptBar } from "./prompt-bar";

interface ChatContainerProps {
  isEnglish?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  embedded?: boolean;
}

interface SessionMessage {
  id: string;
  sender: "client" | "ai" | "staff" | "system";
  bodyMarkdown: string;
  language: "id" | "en";
  createdAt: string;
  authorName: string | null;
}

interface AssistantSession {
  caseId: string;
  conversationId: string;
  caseReference: string;
  status: string;
  messages: SessionMessage[];
}

interface ApiErrorBody {
  error?: { message?: string };
}

interface AnswerResult {
  status: "answered" | "needs_human";
  answer: string;
  messageId: string;
  citations: Array<{
    sourceSectionId: string;
    officialIdentifier: string;
    title: string;
    authority: string;
    canonicalUrl: string;
    locator: string;
  }>;
}

interface AssistantMessageResult {
  userMessage: {
    id: string;
    createdAt: string;
  };
  answer: AnswerResult;
}

const STARTER_PROMPTS_ID = [
  { topic: "Transfer Pricing", preview: "Apa yang perlu disiapkan?", prompt: "Apa hal utama yang perlu saya siapkan untuk dokumentasi transfer pricing?" },
  { topic: "Pendirian Usaha", preview: "Bagaimana mulai usaha di Indonesia?", prompt: "Saya warga negara asing dan ingin membuka usaha di Indonesia. Dari mana saya harus mulai?" },
  { topic: "Pajak Perusahaan", preview: "Apa kewajiban pajak awalnya?", prompt: "Apa kewajiban pajak awal untuk perusahaan baru di Indonesia?" },
];

const STARTER_PROMPTS_EN = [
  { topic: "Transfer Pricing", preview: "What should I prepare first?", prompt: "What should I prepare first for Indonesian transfer pricing documentation?" },
  { topic: "Business Setup", preview: "How do I start in Indonesia?", prompt: "I am a foreign founder planning to open a business in Indonesia. Where should I start?" },
  { topic: "Corporate Tax", preview: "What are the first tax obligations?", prompt: "What are the first tax obligations for a newly established Indonesian company?" },
];

function welcomeMessage(isEnglish: boolean): ChatMessageType {
  return {
    id: "welcome-msg",
    sender: "ai",
    body: isEnglish
      ? "Welcome to **Meridian Assistant**.\n\nAsk about your tax or business situation in Indonesia, or choose a common topic to get started."
      : "Selamat datang di **Asisten Meridian**.\n\nTanyakan mengenai situasi perpajakan atau bisnis Anda di Indonesia, atau pilih topik umum untuk memulai.",
    timestamp: new Date().toISOString(),
  };
}

function mapSessionMessage(message: SessionMessage): ChatMessageType {
  return {
    id: message.id,
    sender: message.sender === "staff" ? "consultant" : message.sender,
    authorName: message.authorName ?? undefined,
    body: message.bodyMarkdown,
    timestamp: message.createdAt,
  };
}

function mapCitation(citation: AnswerResult["citations"][number]): Citation {
  return {
    id: citation.sourceSectionId,
    code: citation.officialIdentifier,
    title: citation.title,
    authority: citation.authority,
    locator: citation.locator,
    excerpt: "",
    officialUrl: citation.canonicalUrl,
    verified: true,
  };
}

function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export function ChatContainer({
  isEnglish,
  onClose,
  isExpanded,
  onToggleExpand,
  embedded = false,
}: ChatContainerProps) {
  const { locale } = useAppLocale();
  const effectiveIsEnglish = isEnglish !== undefined ? isEnglish : locale === "en";
  const [session, setSession] = React.useState<AssistantSession | null>(null);
  const [messages, setMessages] = React.useState<ChatMessageType[]>([welcomeMessage(effectiveIsEnglish)]);
  const [conversationState, setConversationState] = React.useState<ClientConversationState>("ai_assistant");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSessionLoading, setIsSessionLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [identityOpen, setIdentityOpen] = React.useState(false);
  const [activeCitation, setActiveCitation] = React.useState<Citation | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const starters = effectiveIsEnglish ? STARTER_PROMPTS_EN : STARTER_PROMPTS_ID;

  const applySession = React.useCallback((next: AssistantSession) => {
    setSession(next);
    setError(null);
    setMessages([welcomeMessage(effectiveIsEnglish), ...next.messages.map(mapSessionMessage)]);
    const hasStaff = next.messages.some((message) => message.sender === "staff");
    setConversationState(
      hasStaff
        ? "expert_joined"
        : ["human_review_required", "consultant_working", "waiting_for_client"].includes(next.status)
          ? "expert_requested"
          : "ai_assistant",
    );
  }, [effectiveIsEnglish]);

  const loadSession = React.useCallback(async (createIfMissing: boolean) => {
    const response = await fetch("/api/assistant/session", {
      method: createIfMissing ? "POST" : "GET",
      headers: createIfMissing ? { "Content-Type": "application/json" } : undefined,
      body: createIfMissing ? JSON.stringify({ locale: effectiveIsEnglish ? "en" : "id" }) : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ApiErrorBody;
      throw new Error(body.error?.message ?? (effectiveIsEnglish ? "Assistant session is unavailable." : "Sesi asisten tidak tersedia."));
    }
    applySession(await response.json() as AssistantSession);
  }, [applySession, effectiveIsEnglish]);

  React.useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      loadSession(true)
        .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause)); })
        .finally(() => { if (!cancelled) setIsSessionLoading(false); });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [loadSession]);

  React.useEffect(() => {
    if (conversationState !== "expert_requested") return;
    const interval = window.setInterval(() => loadSession(false).catch(() => undefined), 10_000);
    return () => window.clearInterval(interval);
  }, [conversationState, loadSession]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, identityOpen]);

  async function handleSendMessage(text: string) {
    if (!text.trim() || isLoading || !session) return;
    setIsLoading(true);
    setError(null);
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    setMessages((current) => [...current, {
      id: optimisticId,
      sender: "client",
      body: text,
      timestamp: new Date().toISOString(),
    }]);
    try {
      const response = await fetch("/api/assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: session.conversationId,
          bodyMarkdown: text,
          language: effectiveIsEnglish ? "en" : "id",
          clientRequestId: `client-${crypto.randomUUID()}`,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as ApiErrorBody;
        throw new Error(body.error?.message ?? "Message could not be sent.");
      }
      const result = await response.json() as AssistantMessageResult;
      const sent = result.userMessage;
      setMessages((current) => current.map((message) => message.id === optimisticId
        ? { ...message, id: sent.id, timestamp: sent.createdAt }
        : message));
      const answer = result.answer;
      setMessages((current) => [...current, {
        id: answer.messageId,
        sender: "ai",
        body: answer.answer,
        timestamp: new Date().toISOString(),
        citations: deduplicateCitations(answer.citations.map(mapCitation)),
        escalationRecommended: answer.status === "needs_human",
        escalationState: answer.status === "needs_human" ? "recommended" : "none",
        freeEscalationConfirmed: false,
        isStreaming: true,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await loadSession(false).catch(() => undefined);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerified() {
    setIdentityOpen(false);
    await loadSession(false);
    setConversationState("expert_requested");
  }

  const handleReset = React.useCallback(async () => {
    setIsSessionLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: effectiveIsEnglish ? "en" : "id", reset: true }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(
          body.error?.message ??
            (effectiveIsEnglish
              ? "Could not reset assistant session."
              : "Gagal memulai ulang sesi asisten."),
        );
      }
      applySession((await response.json()) as AssistantSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSessionLoading(false);
    }
  }, [applySession, effectiveIsEnglish]);

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg ${embedded ? "rounded-none border-0 shadow-none" : ""}`}>
      <AssistantHeader
        state={conversationState}
        isEnglish={effectiveIsEnglish}
        onClose={onClose}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onReset={handleReset}
      />
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm sm:px-6">
        {isSessionLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {effectiveIsEnglish ? "Opening your secure assistant session…" : "Membuka sesi asisten yang aman…"}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isEnglish={effectiveIsEnglish}
                onCitationClick={setActiveCitation}
                onFollowUpClick={handleSendMessage}
                onEscalate={() => setIdentityOpen(true)}
                onStreamComplete={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, isStreaming: false } : item))}
              />
            ))}
            {isLoading && <LoadingProcessState isEnglish={effectiveIsEnglish} />}
            {messages.length === 1 && !isLoading && session && (
              <div className="pt-2 pb-4">
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                  {effectiveIsEnglish ? "Common topics:" : "Topik umum:"}
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {starters.map((item) => (
                    <button key={item.topic} type="button" onClick={() => handleSendMessage(item.prompt)} className="group rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/70">
                      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-primary dark:text-amber-400">
                        <span>{item.topic}</span><ArrowRight className="size-3 opacity-0 group-hover:opacity-100" />
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{item.preview}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {identityOpen && (
              <EmailVerificationPanel
                purpose="claim"
                isEnglish={effectiveIsEnglish}
                onVerified={handleVerified}
                onCancel={() => setIdentityOpen(false)}
              />
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p>{error}</p>
                  {!session && (
                    <button
                      type="button"
                      className="mt-2 underline"
                      onClick={() => {
                        setIsSessionLoading(true);
                        loadSession(true)
                          .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
                          .finally(() => setIsSessionLoading(false));
                      }}
                    >
                      {effectiveIsEnglish ? "Try again" : "Coba lagi"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t border-border bg-background/95 p-3 sm:p-4">
        <PromptBar
          onSend={handleSendMessage}
          isLoading={isLoading}
          isEnglish={effectiveIsEnglish}
          disabled={!session || isSessionLoading || identityOpen}
        />
      </div>
      <CitationModal citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
}

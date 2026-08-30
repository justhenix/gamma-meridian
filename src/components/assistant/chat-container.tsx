"use client";

import * as React from "react";
import { Sparkles, Shield, ArrowRight, BookOpen, AlertCircle } from "lucide-react";
import type { ChatMessage as ChatMessageType, Citation, ClientConversationState } from "@/lib/assistant/types";
import { generateAssistantResponse } from "@/lib/assistant/chat-engine";
import { ChatMessage } from "./chat-message";
import { LoadingProcessState } from "./loading-process-state";
import { PromptBar } from "./prompt-bar";
import { CitationModal } from "./citation-modal";
import { AssistantHeader } from "./assistant-header";

interface ChatContainerProps {
  isEnglish?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  embedded?: boolean;
}

const STARTER_PROMPTS_ID = [
  {
    topic: "Transfer Pricing (PMK-172/2023)",
    prompt: "Kapan batas waktu pembuatan Local File & Master File untuk tahun pajak 2025?",
  },
  {
    topic: "Tanggapan SP2DK Pajak",
    prompt: "Kami menerima SP2DK atas royalti afiliasi. Apa langkah dan batas waktu tanggapan?",
  },
  {
    topic: "Dividen & PPh Badan (UU HPP)",
    prompt: "Apakah dividen dari anak perusahaan lokal masih dipotong PPh 23?",
  },
  {
    topic: "Tax Treaty & Form DGT",
    prompt: "Bagaimana ketentuan pengisian Form DGT untuk pemanfaatan tarif P3B luar negeri?",
  },
];

const STARTER_PROMPTS_EN = [
  {
    topic: "Transfer Pricing (PMK-172/2023)",
    prompt: "What is the mandatory availability deadline for 2025 Local & Master Files?",
  },
  {
    topic: "SP2DK Tax Audit Notice",
    prompt: "We received an SP2DK regarding intercompany royalties. What is the statutory timeline?",
  },
  {
    topic: "Corporate Income Tax (CIT)",
    prompt: "Are domestic intercompany dividends exempt from withholding tax under UU HPP?",
  },
  {
    topic: "Tax Treaty & Form DGT",
    prompt: "What are the requirements for Form DGT electronic filing for foreign consultants?",
  },
];

import { useAppLocale } from "@/components/locale-provider";

export function ChatContainer({
  isEnglish,
  onClose,
  isExpanded,
  onToggleExpand,
  embedded = false,
}: ChatContainerProps) {
  const { locale } = useAppLocale();
  const effectiveIsEnglish = isEnglish !== undefined ? isEnglish : locale === "en";
  const [messages, setMessages] = React.useState<ChatMessageType[]>([]);
  const [conversationState, setConversationState] =
    React.useState<ClientConversationState>("ai_assistant");
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeCitation, setActiveCitation] = React.useState<Citation | null>(null);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const starters = effectiveIsEnglish ? STARTER_PROMPTS_EN : STARTER_PROMPTS_ID;

  // Initial welcome message
  React.useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome-msg",
          sender: "ai",
          body: effectiveIsEnglish
            ? "Welcome to **Meridian Assistant**.\n\nAsk about your tax or business situation in Indonesia, or choose a common topic to get started."
            : "Selamat datang di **Meridian Assistant**.\n\nTanyakan mengenai situasi perpajakan atau bisnis Anda di Indonesia, atau pilih topik umum untuk memulai.",
          timestamp: new Date().toISOString(),
          isStreaming: false,
        },
      ]);
    }
  }, [effectiveIsEnglish, messages.length]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  const handleSendMessage = (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      sender: "client",
      body: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    setTimeout(() => {
      const generated = generateAssistantResponse(text, effectiveIsEnglish);
      const aiResponseMsg: ChatMessageType = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        body: generated.body,
        timestamp: new Date().toISOString(),
        citations: generated.citations,
        suggestedFollowUps: generated.suggestedFollowUps,
        escalationRecommended: generated.escalationRecommended,
        freeEscalationConfirmed: true,
        escalationState: generated.escalationRecommended ? "recommended" : "none",
        isStreaming: true,
      };

      setIsLoading(false);
      setMessages((prev) => [...prev, aiResponseMsg]);
    }, 1200);
  };

  const handleStreamComplete = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isStreaming: false } : m))
    );
  };

  const handleEscalateToExpert = (msgId: string) => {
    setConversationState("expert_requested");

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, escalationState: "requested", freeEscalationConfirmed: true }
          : m
      )
    );

    setTimeout(() => {
      setConversationState("expert_joined");
      const consultantMsg: ChatMessageType = {
        id: `consultant-${Date.now()}`,
        sender: "consultant",
        authorName: "Hendrik Prasetyo, BAP, S.H.",
        authorTitle: effectiveIsEnglish ? "Senior Tax Litigation Partner" : "Partner Litigasi Pajak Senior",
        body: effectiveIsEnglish
          ? "Hello, I am Hendrik Prasetyo, Senior Tax Partner at Meridian. I have reviewed your inquiry and the preliminary statutory analysis above. We are preparing a structured strategy regarding this matter. Please feel free to provide any additional notices or relevant fiscal years."
          : "Halo, saya Hendrik Prasetyo, Partner Pajak Senior di Meridian. Saya telah membaca kronologi dan telaah regulasi awal di atas. Kami sedang menyiapkan langkah mitigasi terstruktur untuk kasus ini. Anda dapat menyampaikan surat SP2DK atau tahun pajak terkait untuk pendalaman.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, consultantMsg]);
    }, 2500);
  };

  const handleReset = () => {
    setConversationState("ai_assistant");
    setMessages([
      {
        id: "welcome-msg",
        sender: "ai",
        body: effectiveIsEnglish
          ? "Welcome to **Meridian Assistant**.\n\nAsk about your tax or business situation in Indonesia, or choose a common topic to get started."
          : "Selamat datang di **Meridian Assistant**.\n\nTanyakan mengenai situasi perpajakan atau bisnis Anda di Indonesia, atau pilih topik umum untuk memulai.",
        timestamp: new Date().toISOString(),
        isStreaming: false,
      },
    ]);
  };

  return (
    <div
      className={`flex flex-col h-full bg-background rounded-lg border border-border shadow-lg overflow-hidden ${
        embedded ? "border-0 shadow-none rounded-none" : ""
      }`}
    >
      {/* Assistant Header */}
      <AssistantHeader
        state={conversationState}
        isEnglish={effectiveIsEnglish}
        onReset={handleReset}
        onClose={onClose}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4 text-sm"
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isEnglish={effectiveIsEnglish}
            onCitationClick={(citation) => setActiveCitation(citation)}
            onFollowUpClick={(question) => handleSendMessage(question)}
            onEscalate={() => handleEscalateToExpert(msg.id)}
            onStreamComplete={() => handleStreamComplete(msg.id)}
          />
        ))}

        {isLoading && <LoadingProcessState isEnglish={effectiveIsEnglish} />}

        {/* Starter Prompts (shown only at start) */}
        {messages.length === 1 && !isLoading && (
          <div className="pt-2 pb-4">
            <span className="block text-xs font-semibold text-muted-foreground mb-2">
              {effectiveIsEnglish ? "Common Practice Topics:" : "Topik Konsultasi Populer:"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {starters.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  className="text-left p-3 rounded-lg bg-card hover:bg-muted/70 border border-border hover:border-amber-400/60 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-primary dark:text-amber-400 mb-1">
                    <span>{item.topic}</span>
                    <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prompt Bar Footer */}
      <div className="p-3 sm:p-4 bg-background/95 border-t border-border">
        <PromptBar
          onSend={handleSendMessage}
          isLoading={isLoading}
          isEnglish={effectiveIsEnglish}
        />
      </div>

      {/* Statutory Citation Modal */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}

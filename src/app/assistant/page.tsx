import * as React from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ChatContainer } from "@/components/assistant/chat-container";

export const metadata = {
  title: "Meridian Assistant | Statutory Tax Advisory",
  description: "AI-powered regulatory inquiry engine grounded in verified Indonesian tax statutes.",
};

export default function AssistantPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex-1 h-[750px] min-h-[500px]">
          <ChatContainer embedded={false} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

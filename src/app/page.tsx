import * as React from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { StatutoryStrip } from "@/components/sections/statutory-strip";
import { InsightsSection } from "@/components/sections/insights";
import { PracticePillars } from "@/components/sections/practice-pillars";
import { IndustriesSection } from "@/components/sections/industries";
import { ClientStoriesSection } from "@/components/sections/client-stories";
import { Differentiators } from "@/components/sections/differentiators";
import { ConsultationForm } from "@/components/sections/consultation-form";
import { AssistantDrawer } from "@/components/assistant/assistant-drawer";

export default function Home() {
  return (
    <div suppressHydrationWarning className="min-h-screen flex flex-col bg-background text-foreground selection:bg-accent/30 selection:text-foreground">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Hero />
        <StatutoryStrip />
        <InsightsSection />
        <PracticePillars />
        <IndustriesSection />
        <ClientStoriesSection />
        <Differentiators />
        <ConsultationForm />
      </main>
      <Footer />
      <AssistantDrawer />
    </div>
  );
}

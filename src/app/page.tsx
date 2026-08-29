import * as React from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { StatutoryStrip } from "@/components/sections/statutory-strip";
import { PracticePillars } from "@/components/sections/practice-pillars";
import { Differentiators } from "@/components/sections/differentiators";
import { ConsultationForm } from "@/components/sections/consultation-form";

export default function Home() {
  return (
    <div suppressHydrationWarning className="min-h-screen flex flex-col bg-background text-foreground selection:bg-accent/30 selection:text-foreground">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Hero />
        <StatutoryStrip />
        <PracticePillars />
        <Differentiators />
        <ConsultationForm />
      </main>
      <Footer />
    </div>
  );
}

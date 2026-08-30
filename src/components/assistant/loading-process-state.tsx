"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

const PROCESS_STEPS_ID = [
  "Memahami konteks pertanyaan...",
  "Memeriksa regulasi perpajakan yang disetujui...",
  "Menelaah rujukan pasal & yurisprudensi...",
  "Menyusun jawaban terstruktur...",
];

const PROCESS_STEPS_EN = [
  "Understanding your question...",
  "Checking approved regulations...",
  "Reviewing relevant sources...",
  "Preparing your answer...",
];

interface LoadingProcessStateProps {
  isEnglish?: boolean;
}

export function LoadingProcessState({ isEnglish = false }: LoadingProcessStateProps) {
  const steps = isEnglish ? PROCESS_STEPS_EN : PROCESS_STEPS_ID;
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % steps.length);
    }, 900);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-lg bg-muted/50 border border-border/80 text-foreground w-fit max-w-md animate-in fade-in-0 duration-200">
      <Loader2 className="size-4 animate-spin text-primary dark:text-amber-400 shrink-0" />
      <span className="text-[13px] font-medium text-muted-foreground transition-all duration-300">
        {steps[currentStepIndex]}
      </span>
    </div>
  );
}

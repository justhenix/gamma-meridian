"use client";

import * as React from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PromptBarProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  isEnglish?: boolean;
  disabled?: boolean;
}

export function PromptBar({
  onSend,
  isLoading = false,
  isEnglish = false,
  disabled = false,
}: PromptBarProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const placeholder = isEnglish
    ? "Ask Meridian about your business or tax situation..."
    : "Tanyakan kepada Meridian mengenai situasi pajak atau bisnis Anda...";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!value.trim() || isLoading || disabled) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-expand textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="relative w-full border border-border bg-card rounded-lg shadow-sm focus-within:border-primary dark:focus-within:border-amber-400/80 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading || disabled}
        className="w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 max-h-[140px] leading-relaxed"
      />
      <div className="flex items-center justify-between px-3 pb-2.5 pt-0 text-xs text-muted-foreground border-t border-border/40 mt-1">
        <span className="hidden sm:inline-block font-normal">
          {isEnglish
            ? "Your enquiry is handled confidentially."
            : "Pertanyaan Anda ditangani secara rahasia."}
        </span>
        <span className="sm:hidden font-normal">
          {isEnglish ? "Handled confidentially" : "Rahasia terjamin"}
        </span>

        <Button
          type="button"
          size="sm"
          variant="accent"
          onClick={handleSend}
          disabled={!value.trim() || isLoading || disabled}
          className="size-8 p-0 rounded-lg shrink-0 cursor-pointer shadow-xs"
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4 stroke-[2.5]" />
          )}
        </Button>
      </div>
    </div>
  );
}

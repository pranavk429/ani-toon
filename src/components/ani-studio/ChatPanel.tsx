"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Bot,
  Check,
  CornerDownLeft,
  Loader2,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import type { ChatMessage, SourceKind, StudioStatus } from "./types";
import { changedTrackCount, summarizeChanges } from "./utils";
import type { AnimationDirectionSuccess } from "@/lib/ai/contracts";

export type ChatPanelProps = {
  messages: ChatMessage[];
  instruction: string;
  onInstructionChange: (val: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isSending: boolean;
  status: StudioStatus;
  lastResponse: AnimationDirectionSuccess | null;
  sourceKind: SourceKind;
  onSelectChip: (text: string) => void;
};

const SUGGESTION_CHIPS = [
  "Make it more playful",
  "Make the jump higher",
  "Slow down the landing",
  "Add a blink",
  "Change the shirt to blue",
  "Make the logo reveal itself",
] as const;

export function ChatPanel({
  messages,
  instruction,
  onInstructionChange,
  onSend,
  onCancel,
  isSending,
  status,
  lastResponse,
  sourceKind,
  onSelectChip,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isSending && instruction.trim()) {
        onSend();
      }
    }
  };

  return (
    <aside
      aria-label="AI Director chat"
      className="flex h-full w-full flex-col border-l border-[#D7D4CB] bg-[#FEFDF9] xl:w-[340px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#D7D4CB] bg-[#F1EEE6]/60 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#4B63FF]" />
          <h2 className="font-display text-xs font-bold text-[#111111]">
            AI Director
          </h2>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-1.5 font-mono text-[9px]">
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              status.phase === "error" && "bg-[#FF5A45]",
              isSending && "animate-pulse bg-[#FFC53D]",
              status.phase === "ready" && "bg-[#22C55E]",
              status.phase === "idle" && "bg-[#6F6759]",
            )}
          />
          <span className="text-[#6F6759]">
            {status.phase === "generating_character"
              ? "Generating character..."
              : status.phase === "planning_motion"
                ? "Planning motion..."
                : status.phase === "validating"
                  ? "Validating..."
                  : status.phase === "error"
                    ? "Error"
                    : "Ready"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-3.5"
      >
        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-[12px] rounded-tr-[2px] bg-[#111111] px-3 py-2 text-xs text-[#FEFDF9] shadow-xs">
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.role === "error") {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[90%] rounded-[12px] rounded-tl-[2px] border border-[#FF5A45]/40 bg-[#FF5A45]/10 p-3 text-xs text-[#B93B2B] shadow-xs">
                  <div className="flex items-start gap-1.5 font-bold">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>Direction failed</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.role === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="rounded-[8px] border border-dashed border-[#D7D4CB] bg-[#F1EEE6]/50 px-2.5 py-1 text-center font-mono text-[9px] text-[#6F6759]">
                  {msg.content}
                </div>
              </div>
            );
          }

          // Assistant
          const hasChanges = msg.changes && changedTrackCount(msg.changes) > 0;

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[92%] rounded-[12px] rounded-tl-[2px] border border-[#D7D4CB] bg-[#F1EEE6]/50 p-3 text-xs shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Bot size={13} className="text-[#4B63FF]" />
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#111111]">
                      Director
                    </span>
                  </div>

                  {msg.isFallback ? (
                    <span className="rounded-full bg-[#FFC53D]/30 px-1.5 py-0.2 font-mono text-[8px] font-bold text-[#8A6A13]">
                      Local fallback
                    </span>
                  ) : msg.providerLabel ? (
                    <span className="rounded-full bg-[#4B63FF]/15 px-1.5 py-0.2 font-mono text-[8px] font-bold text-[#4B63FF]">
                      {msg.providerLabel}
                    </span>
                  ) : null}
                </div>

                <p className="text-[11px] leading-relaxed text-[#111111]">
                  {msg.content}
                </p>

                {/* Track Change Badges */}
                {msg.changes && (
                  <div className="rounded-[8px] border border-[#D7D4CB]/80 bg-[#FEFDF9] p-2">
                    <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">
                      Track changes: {summarizeChanges(msg.changes)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.changes.added.length > 0 && (
                        <span className="rounded-[4px] bg-[#22C55E]/15 px-1 py-0.5 font-mono text-[8px] font-bold text-[#15803D]">
                          +{msg.changes.added.length} added
                        </span>
                      )}
                      {msg.changes.modified.length > 0 && (
                        <span className="rounded-[4px] bg-[#4B63FF]/15 px-1 py-0.5 font-mono text-[8px] font-bold text-[#3247D4]">
                          ~{msg.changes.modified.length} modified
                        </span>
                      )}
                      {msg.changes.removed.length > 0 && (
                        <span className="rounded-[4px] bg-[#FF5A45]/15 px-1 py-0.5 font-mono text-[8px] font-bold text-[#B93B2B]">
                          -{msg.changes.removed.length} removed
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {msg.warnings && msg.warnings.length > 0 && (
                  <div className="rounded-[6px] bg-[#FFC53D]/15 p-1.5 text-[10px] text-[#8A6A13]">
                    {msg.warnings.map((w, idx) => (
                      <p key={idx}>• {w}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-[12px] border border-[#D7D4CB] bg-[#F1EEE6]/50 px-3 py-2 text-xs text-[#6F6759]">
              <Loader2 size={13} className="animate-spin text-[#4B63FF]" />
              <span className="font-mono text-[10px]">
                {status.message || "Directing animation..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion Chips */}
      <div className="border-t border-[#D7D4CB]/60 bg-[#FEFDF9] px-3 py-2">
        <p className="font-mono text-[8px] uppercase tracking-wider text-[#6F6759]">
          Suggestions
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={isSending}
              onClick={() => onSelectChip(chip)}
              className="rounded-full border border-[#D7D4CB] bg-[#F1EEE6]/40 px-2 py-0.5 text-[10px] font-medium text-[#111111] transition-colors hover:border-[#4B63FF] hover:bg-[#FEFDF9] disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="border-t border-[#D7D4CB] bg-[#FEFDF9] p-3">
        <div className="relative rounded-[12px] border border-[#D7D4CB] bg-[#F1EEE6]/30 transition-colors focus-within:border-[#4B63FF] focus-within:bg-[#FEFDF9]">
          <textarea
            ref={textareaRef}
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to animate or revise..."
            rows={2}
            disabled={isSending}
            className="w-full resize-none rounded-[12px] bg-transparent p-2.5 text-xs text-[#111111] placeholder:text-[#6F6759]/60 outline-none"
          />

          <div className="flex items-center justify-between border-t border-[#D7D4CB]/50 px-2 py-1.5">
            <span className="font-mono text-[9px] text-[#6F6759]">
              Enter to send · Shift+Enter newline
            </span>

            <div className="flex items-center gap-1">
              {isSending ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex h-6 items-center gap-1 rounded-[6px] border border-[#FF5A45]/40 bg-[#FF5A45]/10 px-2 text-[10px] font-bold text-[#B93B2B] hover:bg-[#FF5A45]/20"
                >
                  <X size={10} />
                  <span>Cancel</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!instruction.trim() || isSending}
                  className="flex h-6 items-center gap-1 rounded-[6px] bg-[#4B63FF] px-2.5 text-[10px] font-bold text-[#FEFDF9] transition hover:bg-[#3247D4] disabled:opacity-30"
                >
                  <Send size={10} />
                  <span>Send</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

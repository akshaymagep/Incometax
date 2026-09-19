import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useTaxReturn } from "../context/TaxReturnContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { financialYear } = useTaxReturn();

  useEffect(() => {
    if (!open || messages.length > 0) return;
    api
      .chatHistory()
      .then((res) => setMessages(res.messages.map((m) => ({ role: m.role, content: m.content }))))
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await api.sendChat(text, financialYear);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the AI assistant. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 rounded-full bg-brand-600 text-white shadow-lg px-5 py-3 text-sm font-semibold hover:bg-brand-700"
      >
        Ask the AI assistant
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-[22rem] max-w-[calc(100vw-2.5rem)] h-[28rem] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-brand-600 text-white">
        <span className="font-semibold text-sm">Tax Assistant</span>
        <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-sm">
          ✕
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm">
        {messages.length === 0 && (
          <p className="text-slate-400 text-xs">
            Ask about deductions, old vs new regime, HRA, capital gains, or anything about your saved income
            details. This assistant offers general guidance, not professional tax advice.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <div className="text-xs text-slate-400">Thinking…</div>}
        {error && <div className="text-xs text-red-500">{error}</div>}
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 p-2 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          placeholder="Ask a tax question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={sending}
          className="rounded-md bg-brand-600 text-white px-3 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Search, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ContactResults, parseContacts } from "@/components/contact-results";
import { useThreads } from "@/lib/threads";

const CREDIT_ERROR_MESSAGE =
  "AI credits are unavailable right now, so this search could not run. Your search was saved — please try again when credits are available.";

const SUGGESTIONS = [
  "VP of Engineering at Series B fintechs in Berlin",
  "Email of the press contact at OpenAI",
  "Founders of YC W24 climate startups",
  "Head of Talent at design agencies in NYC",
];

export function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const { updateThread } = useThreads();
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<UIMessage[]>(initialMessages);
  const [chatError, setChatError] = useState<string | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      console.error("chat error", err);
      const message = normalizeChatError(err);
      setChatError(message);
      setMessages((current) => ensureAssistantError(current, message));
    },
  });

  const submitSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === "submitted" || status === "streaming") return;
    setChatError(null);
    void sendMessage({ text: trimmed }).catch((err: unknown) => {
      const message = normalizeChatError(err);
      setChatError(message);
      setMessages((current) => ensureAssistantError(ensureUserMessage(current, trimmed), message));
    });
  };

  // Persist messages whenever they change
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    messagesRef.current = messages;
    const sig = JSON.stringify(messages);
    if (sig === lastSavedRef.current) return;
    lastSavedRef.current = sig;
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title =
      firstUser?.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(" ")
        .slice(0, 60) || "New search";
    updateThread(threadId, { title, messages });
  }, [messages, threadId, updateThread]);

  // Focus textarea on mount, thread change, and after streaming completes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Search className="h-8 w-8" />}
              title="Find anyone's email."
              description="Describe who you're looking for — by name, role, company, or any combination. Reachly searches the open web, including LinkedIn."
            >
              <div className="flex flex-col items-center gap-6 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
                  <Search className="h-6 w-6" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h2 className="text-2xl font-semibold tracking-tight">Find anyone&apos;s email.</h2>
                  <p className="text-sm text-muted-foreground">
                    Describe who you&apos;re looking for. Reachly searches the open web — including LinkedIn — and returns verified emails, contact pages, and avatars.
                  </p>
                </div>
                <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submitSearch(s)}
                      className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => <MessageItem key={m.id} message={m} />)
          )}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <Shimmer>Searching the web for contacts…</Shimmer>
            </div>
          )}
          {chatError && !isLoading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {chatError}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(msg) => {
              submitSearch(msg.text ?? "");
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="e.g. Head of Marketing at Series A SaaS in London — include phone numbers"
            />
            <PromptInputFooter className="justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Add &quot;include phone numbers&quot; to your query if needed.
              </div>
              <PromptInputSubmit status={status} disabled={isLoading} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function normalizeChatError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.toLowerCase().includes("credit") || raw.includes("402")
    ? CREDIT_ERROR_MESSAGE
    : raw || "Search failed. Please try again.";
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

function createTextMessage(role: "user" | "assistant", text: string): UIMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    parts: [{ type: "text", text }],
  };
}

function ensureUserMessage(messages: UIMessage[], text: string) {
  if (messages.some((message) => message.role === "user" && getMessageText(message) === text)) {
    return messages;
  }
  return [...messages, createTextMessage("user", text)];
}

function ensureAssistantError(messages: UIMessage[], text: string) {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && getMessageText(last) === text) return messages;
  return [...messages, createTextMessage("assistant", text)];
}

function MessageItem({ message }: { message: UIMessage }) {
  const text = getMessageText(message);

  const toolParts = message.parts.filter((p) => p.type?.startsWith("tool-"));

  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent>{text}</MessageContent>
      </Message>
    );
  }

  const { prose, contacts, streaming } = parseContacts(text);

  return (
    <Message from="assistant">
      <MessageContent className="w-full max-w-full">
        {toolParts.length > 0 && !contacts && (
          <div className="mb-2 flex flex-wrap gap-2">
            {toolParts.map((p, i) => {
              const name = (p.type || "").replace(/^tool-/, "");
              const state = (p as { state?: string }).state ?? "";
              const input = (p as { input?: Record<string, unknown> }).input ?? {};
              const label =
                name === "search_web"
                  ? `Searching: "${String(input.query ?? "")}"`
                  : name === "scrape_url"
                  ? `Reading ${String(input.url ?? "").replace(/^https?:\/\//, "").slice(0, 50)}`
                  : name;
              const done = state === "output-available";
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground/80"
                >
                  {done ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/60" />
                  )}
                  {done ? label : <Shimmer>{label}</Shimmer>}
                </span>
              );
            })}
          </div>
        )}


        {prose && (
          <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-p:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{prose}</ReactMarkdown>
          </div>
        )}
        {streaming && (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <Shimmer>Compiling contacts…</Shimmer>
          </div>
        )}
        {contacts && (
          <div className="mt-3">
            <ContactResults contacts={contacts} />
          </div>
        )}
      </MessageContent>
    </Message>
  );
}

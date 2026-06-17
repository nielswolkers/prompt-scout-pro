import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { ChatWindow } from "@/components/chat-window";
import { loadThread } from "@/lib/threads";

export const Route = createFileRoute("/$threadId")({
  component: ThreadPage,
  head: () => ({
    meta: [
      { title: "Reachly — Find anyone's email" },
      {
        name: "description",
        content: "AI-powered contact research. Find verified emails, contact pages, and phone numbers for people and companies across the open web.",
      },
    ],
  }),
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    const t = loadThread(threadId);
    setInitial(t?.messages ?? []);
  }, [threadId]);

  if (initial === null) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return <ChatWindow key={threadId} threadId={threadId} initialMessages={initial} />;
}

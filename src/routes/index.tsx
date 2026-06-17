import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { newThreadId } from "@/lib/threads";

export const Route = createFileRoute("/")({
  component: HomeRedirect,
});

function HomeRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = newThreadId();
    navigate({ to: "/$threadId", params: { threadId: id }, replace: true });
  }, [navigate]);
  return null;
}

import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Plus, MessageSquare, Trash2, Mail } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useThreads, newThreadId } from "@/lib/threads";
import { cn } from "@/lib/utils";

export function AppSidebar(): ReactNode {
  const { threads, deleteThread } = useThreads();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleNew = () => {
    const id = newThreadId();
    navigate({ to: "/$threadId", params: { threadId: id } });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteThread(id);
    if (pathname === `/${id}`) navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
            <Mail className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Reachly
          </span>
        </div>
        <button
          onClick={handleNew}
          className="mx-1 mb-1 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Plus className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">New search</span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            History
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {threads.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                No searches yet.
              </div>
            )}
            <SidebarMenu>
              {threads.map((t) => {
                const active = pathname === `/${t.id}`;
                return (
                  <SidebarMenuItem key={t.id}>
                    <div
                      className={cn(
                        "group/row flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      <Link
                        to="/$threadId"
                        params={{ threadId: t.id }}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate group-data-[collapsible=icon]:hidden">
                          {t.title || "New search"}
                        </span>
                      </Link>
                      <button
                        onClick={(e) => handleDelete(e, t.id)}
                        className="rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100 group-data-[collapsible=icon]:hidden"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

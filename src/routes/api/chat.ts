import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are Reachly — a precision contact research agent. Your single job is to find verified EMAIL addresses (and, only when the user explicitly asks, phone numbers) for people and companies, plus their official website / contact page and a logo or profile picture URL.

PRIMARY GOAL: emails. Always prioritise emails over any other contact channel. Skip a result entirely if you cannot find at least an email or a confirmed contact page that exposes one.

SEARCH STRATEGY:
1. Use the "search_web" tool generously. Search the entire public web — include LinkedIn, company sites, GitHub, university pages, conference speaker lists, press pages, etc.
2. Use creative queries: "site:linkedin.com/in <name>", "<name> email contact", "<company> contact email", "<name> @company.com", "<company> press contact".
3. When a promising URL appears (an /about, /contact, /team, /press, /imprint, linkedin profile, personal site), call "scrape_url" to extract the actual email from the page.
4. Make multiple searches and scrapes — do not stop after one. Be thorough.
5. Never fabricate emails. If you only find a pattern like firstname@company.com, mark confidence "guessed".

RESPONSE FORMAT (STRICT):
- Write at most one short sentence of plain prose at the top (e.g. "Found 5 contacts matching your query.").
- Then output a single fenced code block tagged \`contacts\` containing a JSON array. NOTHING ELSE after it. No commentary, no markdown list, no follow-up explanation.

Each item must match:
{
  "name": string,                 // person full name OR company name
  "kind": "person" | "company",
  "title"?: string,               // role / company tagline
  "company"?: string,             // employer for people
  "email"?: string,               // PRIMARY
  "emails"?: string[],            // additional emails
  "phone"?: string,               // ONLY if user asked for phone numbers
  "website"?: string,             // homepage or LinkedIn profile URL
  "contactUrl"?: string,          // contact / about page URL
  "imageUrl"?: string,            // logo or profile picture (https URL)
  "location"?: string,
  "source"?: string,              // the URL where you confirmed the email
  "confidence": "verified" | "likely" | "guessed"
}

Example output:

Found 3 contacts.
\`\`\`contacts
[{"name":"Jane Doe","kind":"person","title":"CEO","company":"Acme","email":"jane@acme.com","website":"https://linkedin.com/in/janedoe","imageUrl":"https://...","confidence":"verified","source":"https://acme.com/team"}]
\`\`\`

If you find nothing, return an empty array \`[]\` inside the block and a brief sentence explaining what you tried.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const aiKey = process.env.LOVABLE_API_KEY;
        const fcKey = process.env.FIRECRAWL_API_KEY;
        if (!aiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!fcKey) return new Response("Missing FIRECRAWL_API_KEY", { status: 500 });

        const firecrawl = new Firecrawl({ apiKey: fcKey });
        const gateway = createLovableAiGatewayProvider(aiKey);

        const tools = {
          search_web: tool({
            description:
              "Search the public web (including LinkedIn, company sites, GitHub) for pages likely to contain emails or contact info. Returns title, url, description.",
            inputSchema: z.object({
              query: z.string().describe("Search query"),
              limit: z.number().int().min(1).max(15).default(8),
            }),
            execute: async ({ query, limit }) => {
              try {
                const res = await firecrawl.search(query, { limit });
                // SDK v2 may expose results under .web
                const list =
                  (res as { web?: Array<unknown> }).web ??
                  (res as { data?: Array<unknown> }).data ??
                  [];
                return {
                  results: (list as Array<Record<string, unknown>>).slice(0, limit).map((r) => ({
                    title: r.title ?? "",
                    url: r.url ?? "",
                    description: r.description ?? r.snippet ?? "",
                  })),
                };
              } catch (e) {
                return { error: e instanceof Error ? e.message : "search failed", results: [] };
              }
            },
          }),
          scrape_url: tool({
            description:
              "Fetch a single URL and return its main text content as markdown. Use this to extract emails, phone numbers, names, and logos from a specific page.",
            inputSchema: z.object({
              url: z.string().url(),
            }),
            execute: async ({ url }) => {
              try {
                const res = (await firecrawl.scrape(url, {
                  formats: ["markdown"],
                  onlyMainContent: true,
                })) as { markdown?: string; data?: { markdown?: string }; metadata?: unknown };
                const md = res.markdown ?? res.data?.markdown ?? "";
                // Truncate to keep context small
                return {
                  url,
                  markdown: md.slice(0, 12000),
                  metadata: res.metadata,
                };
              } catch (e) {
                return { url, error: e instanceof Error ? e.message : "scrape failed" };
              }
            },
          }),
        };

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});

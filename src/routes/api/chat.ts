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

const SYSTEM_PROMPT = `You are Reachly — a precision contact research agent. Find emails, LinkedIn profiles, profile pictures / logos, websites, contact forms, and (only when explicitly requested) phone numbers for people and companies.

ALWAYS RETURN SOMETHING. Never return an empty list if the user named a specific person/role/company. Infer missing data from patterns and mark confidence "guessed".

EMAIL INFERENCE:
- If you can't confirm an email, derive from patterns at the same domain. Search for ANY email "@domain" and replicate the format (firstname.lastname@, f.lastname@, firstname@, etc.).
- Schools: look for student subdomains (e.g. "@leerling.nicolaas.nl").

LINKEDIN — almost everyone has one:
- Always run "site:linkedin.com/in <name> <company>" and "site:linkedin.com/company <company>" EARLY in every search.
- For companies use linkedin.com/company/<slug>; for schools linkedin.com/school/<slug>.
- The linkedinUrl field is what drives the avatar fallback in the UI — setting it correctly is THE most important thing for getting a profile picture.

IMAGES — LINKEDIN FIRST, THEN SCRAPE FOR A DIRECT URL:
- Strategy:
  1. Set linkedinUrl correctly. The UI auto-resolves a LinkedIn avatar from the handle, so often you don't need to supply imageUrl at all.
  2. To improve reliability, also scrape pages for a DIRECT, public, hot-linkable image URL and put it in imageUrl. Good sources: company team/about pages (og:image or <img>), Wikipedia/Wikimedia Commons, personal sites, university bios, GitHub avatars (avatars.githubusercontent.com), conference pages, blogs.
  3. DO NOT use media.licdn.com URLs in imageUrl — they are referer-locked and won't render. The UI will skip them. Leave imageUrl empty and rely on linkedinUrl in that case.
  4. For COMPANIES: prefer Wikipedia/Wikimedia logos (en.wikipedia.org/wiki/<brand> → og:image, or commons.wikimedia.org) over generic favicons. Scrape the homepage for og:image / a logo <img>.
- If after thorough searching there's truly no LinkedIn and no scrape-able image, omit imageUrl and the UI will render initials on a grey background.

TITLE: max 4 words. "company" populated for every person. "location" = "City, Country".

CONTACT FILTERING & BUTTONS (UI shows max 4 buttons per card):
- Tune contacts to the user's request: country filter, role filter (investor relations / press / recruitment / sales / careers), language. Don't dump generic info.
- Include phones ONLY if the user explicitly asked for phone numbers.
- If the user asked for recruitment / careers / press / investor relations: search the company site for the dedicated CONTACT FORM and set "formUrl". Still include a real email or phone when one exists — don't return ONLY a form.
- For plain company lookups, ALWAYS set "website" (the homepage). It is the primary button for companies.
- Cap "emails" at 3 and "phones" at 2 per contact.

SEARCH STRATEGY (4–8 tool calls per contact):
1. search_web: name+company, site:linkedin.com/in, site:linkedin.com/company, "<company> contact form", "<company> press contact", "<company> investor relations", "<company> careers email".
2. scrape_url: /about, /team, /contact, /press, /investors, /careers, LinkedIn profiles, Wikipedia, personal sites — extract emails, phones, form URLs, og:image.

RESPONSE FORMAT (STRICT):
- One short prose sentence (e.g. "Found 3 contacts.").
- Then a single fenced \`contacts\` JSON array. NOTHING after the closing fence.

Each item:
{
  "name": string,
  "kind": "person" | "company",
  "title"?: string,               // MAX 4 WORDS
  "company"?: string,             // ALWAYS for people
  "email"?: string,
  "emails"?: string[],            // max 3
  "phone"?: string,               // only if user asked
  "phones"?: string[],            // max 2, only if user asked
  "website"?: string,             // homepage; primary button for companies
  "linkedinUrl"?: string,         // ALWAYS attempt
  "contactUrl"?: string,
  "formUrl"?: string,             // online contact / careers / press / IR form
  "imageUrl"?: string,            // direct public image URL — NOT media.licdn.com
  "location"?: string,
  "source"?: string,
  "confidence": "verified" | "likely" | "guessed"
}`;


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

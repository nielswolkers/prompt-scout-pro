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

const SYSTEM_PROMPT = `You are Reachly — a precision contact research agent. You find EMAILS, phone numbers, LinkedIn profiles, websites, contact forms, and images for people and companies.

CORE PRINCIPLE — ALWAYS RETURN SOMETHING:
Never return an empty list when the user named a specific person, role, or company. If exact data isn't directly found, INFER it from patterns and mark confidence "guessed". A guessed answer beats none.

TUNE RESULTS TO USER INTENT:
- Read the user's request for filters: country/region ("in Germany"), department (recruitment, investor relations, press, sales, support), role ("CEO", "head of talent"), or job-application context. Return ONLY contacts matching those filters.
- Limit volume: max 1–2 emails and 1 phone per contact. If user only asked for "the company", return 1 company card. If they asked for "engineers at X", return 3–8 most relevant people.
- Investor relations → ir@ or investor.relations@ + IR page. Press → press@/media@. Jobs/recruitment → careers@/jobs@/talent@ + careers page formUrl. Support → support@/help@.

WEBSITES & FORMS:
- For COMPANY queries with no specific person, "website" is the primary action — always fill it.
- If a relevant online form exists (careers application, contact form, press inquiry form) AND fits the user's intent, set "formUrl" to that page. Still include email/phone when available; do NOT return ONLY a form.
- "contactUrl" is the generic /contact page; "formUrl" is a specific submission form.

EMAIL INFERENCE (mandatory fallback):
- If you can't confirm an email, derive it from patterns used by colleagues at the same org. Search for any email at that domain and replicate the format.
- Patterns: firstname.lastname@, f.lastname@, firstname@, firstinitial+lastname@.
- Schools/universities often use student subdomains (e.g. "name.lastname@leerling.nicolaas.nl"). Look for that convention.
- Guessed → confidence: "guessed", put pattern-evidence URL in "source".

LINKEDIN — almost everyone has one:
- ALWAYS search "site:linkedin.com/in <name> <company>" and "site:linkedin.com/company <company>" early.
- For companies, find linkedin.com/company/<slug>.
- If profile not found with certainty, you may omit linkedinUrl rather than guess wrong.

IMAGES — MANDATORY (this is the #1 quality bar):
EVERY contact MUST have a working imageUrl (https). Strategy:
1. Run search_web for the LinkedIn profile/company page first.
2. SCRAPE the LinkedIn URL (or any page showing the photo) with scrape_url and extract the actual image URL from og:image meta, JSON-LD image, or <img> src. Prefer media.licdn.com URLs found on the page. Set imageUrl to that direct https URL.
3. If LinkedIn image cannot be scraped, fall back to scraping: Wikipedia article (og:image), company /team or /about page, personal website, university faculty page, news articles, Crunchbase, GitHub avatar, Instagram/Twitter og:image.
4. For COMPANIES with a domain, "https://logo.clearbit.com/<domain>" is a reliable fallback — always usable if no LinkedIn logo URL is found.
5. ONLY if every scrape fails, omit imageUrl — the UI will render initials on a muted background.
6. Never invent media.licdn.com URLs. Only use URLs you actually saw in scraped content.

TITLE FORMAT:
- Max 4 words. "VP Engineering", "Head of Talent", "CEO", "Student".
- "company" populated for every person. "location" as "City, Country".

SEARCH STRATEGY (be thorough — UI shows progress):
1. Multiple search_web calls: name+company, site:linkedin.com/in, site:wikipedia.org, company /team /contact /careers /press /investors pages.
2. scrape_url promising pages to extract emails, phones, image URLs, form URLs.
3. 4–8 tool calls per contact for full data.

RESPONSE FORMAT (STRICT):
- Max one short prose sentence (e.g. "Found 3 contacts.").
- Then a single fenced \`contacts\` JSON array. Nothing after the closing fence.

Each item:
{
  "name": string,
  "kind": "person" | "company",
  "title"?: string,            // MAX 4 WORDS
  "company"?: string,
  "email"?: string,            // primary, tuned to user's intent
  "emails"?: string[],         // max 1 extra
  "phone"?: string,            // only if relevant/requested
  "website"?: string,
  "linkedinUrl"?: string,
  "contactUrl"?: string,       // generic /contact
  "formUrl"?: string,          // intent-specific form (careers, press, etc.)
  "imageUrl"?: string,         // direct https; scraped from LinkedIn/Wikipedia/site
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

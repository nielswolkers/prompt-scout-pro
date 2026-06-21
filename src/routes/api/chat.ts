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

const SYSTEM_PROMPT = `You are Reachly — a precision contact research agent. Your job is to find EMAIL addresses, LinkedIn profiles, profile pictures / logos, and (only when explicitly requested) phone numbers for people and companies.

CORE PRINCIPLE — ALWAYS RETURN SOMETHING:
You must NEVER return an empty list when the user has named a specific person, role, or company. If exact data isn't directly found, you INFER it intelligently from patterns and mark confidence accordingly. A "guessed" answer is far better than no answer.

EMAIL INFERENCE (mandatory fallback):
- If you cannot directly confirm an email, derive it from patterns used by colleagues at the same organisation. Search for ANY email at that domain (e.g. "@nicolaas.nl", "@airliquide.com") and replicate the format.
- Common patterns: firstname.lastname@domain, f.lastname@domain, firstname@domain, firstinitial+lastname@domain.
- School/university example: a student at St. Nicolaaslyceum → "firstname.lastname@leerling.nicolaas.nl" (note the student subdomain). Always look for that subdomain convention for schools/universities.
- When you guess from a pattern, set confidence: "guessed" and put the source URL of the pattern evidence in "source".

LINKEDIN — almost everyone has one:
- Always attempt to find a LinkedIn URL. Search "site:linkedin.com/in <name> <company>" and "<name> <role> linkedin".
- If you cannot find the exact profile, construct a plausible search URL: "https://www.linkedin.com/search/results/people/?keywords=<name>+<company>" with confidence "guessed". Prefer real /in/ URLs.
- For companies, find linkedin.com/company/<slug>.

IMAGES — mandatory:
- EVERY contact MUST have an imageUrl. Try in this order: LinkedIn profile photo, company team page, personal website, Instagram (search "site:instagram.com <name>"), Twitter/X, GitHub avatar, Facebook, news articles, conference speaker pages, university faculty pages.
- For companies: logo from their website, or use "https://logo.clearbit.com/<domain>" as a reliable fallback, or their LinkedIn company image.
- Scrape pages to extract og:image meta tags or <img> URLs. NEVER leave imageUrl empty.

TITLE FORMAT:
- Maximum 4 words. Be concise: "VP Engineering", "Head of Talent", "CEO", "Press Officer", "Student", "Marketing Manager".
- "company" MUST be populated separately for every person — shown clearly on its own line.
- "location" on its own line — always try to fill it (e.g. "Rotterdam, Netherlands").

SEARCH STRATEGY (be thorough — the UI shows your progress):
1. Run multiple search_web calls with varied queries: name + company, name + email, site:linkedin.com/in, site:instagram.com, site:twitter.com, company contact/team page, press contacts.
2. scrape_url any promising page: /about, /team, /contact, /imprint, /press, LinkedIn profiles, personal sites, social profiles.
3. Aim for 4–8 tool calls per contact to gather full data (email + linkedin + image + company + location).
4. For images: if no direct URL appears in snippets, scrape the page and extract the profile picture.

RESPONSE FORMAT (STRICT):
- Write at most one short sentence of prose (e.g. "Found 3 contacts.").
- Then output a single fenced code block tagged \`contacts\` containing a JSON array. NOTHING after the closing fence.

Each item:
{
  "name": string,
  "kind": "person" | "company",
  "title"?: string,               // MAX 4 WORDS
  "company"?: string,             // ALWAYS fill for people
  "email"?: string,               // ALWAYS provide (verified or guessed)
  "emails"?: string[],
  "phone"?: string,               // ONLY if user asked
  "website"?: string,
  "linkedinUrl"?: string,         // ALWAYS attempt
  "contactUrl"?: string,
  "imageUrl"?: string,            // ALWAYS provide (https URL)
  "location"?: string,            // City, Country
  "source"?: string,
  "confidence": "verified" | "likely" | "guessed"
}

Example:

Found 1 contact.
\`\`\`contacts
[{"name":"Jane Doe","kind":"person","title":"Marketing Manager","company":"Air Liquide","location":"Rotterdam, Netherlands","email":"jane.doe@airliquide.com","linkedinUrl":"https://www.linkedin.com/in/janedoe","imageUrl":"https://media.licdn.com/...jpg","website":"https://airliquide.com","confidence":"likely","source":"https://airliquide.com/team"}]
\`\`\``;

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

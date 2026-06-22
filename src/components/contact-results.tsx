import { Mail, Phone, ExternalLink, Globe, MapPin, BadgeCheck, AlertCircle, HelpCircle, User, Building2, Check, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>
    </svg>
  );
}

export type Contact = {
  name: string;
  kind: "person" | "company";
  title?: string;
  company?: string;
  email?: string;
  emails?: string[];
  phone?: string;
  phones?: string[];
  website?: string;
  linkedinUrl?: string;
  contactUrl?: string;
  formUrl?: string;
  imageUrl?: string;
  location?: string;
  source?: string;
  confidence?: "verified" | "likely" | "guessed";
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ConfidenceBadge({ c }: { c?: Contact["confidence"] }) {
  if (!c) return null;
  const map = {
    verified: { Icon: BadgeCheck, label: "Verified", cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" },
    likely: { Icon: HelpCircle, label: "Likely", cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400" },
    guessed: { Icon: AlertCircle, label: "Guessed", cls: "text-muted-foreground bg-muted" },
  } as const;
  const v = map[c];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", v.cls)}>
      <v.Icon className="h-3 w-3" />
      {v.label}
    </span>
  );
}

function ActionButton({
  value,
  icon: Icon,
  label,
  square = false,
  href,
  copyable = true,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  square?: boolean;
  href?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const baseCls = cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 text-sm font-medium text-foreground transition-all hover:border-foreground/30 hover:bg-foreground hover:text-background active:scale-[0.97]",
    square ? "w-10 shrink-0" : "flex-1 min-w-0 px-3",
  );

  if (href && !copyable) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={baseCls} aria-label={label} title={label}>
        <Icon className="h-4 w-4 shrink-0" />
        {!square && <span className="truncate">{label}</span>}
      </a>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <button type="button" onClick={handleClick} className={baseCls} aria-label={`Copy ${label}`} title={`Copy ${value}`}>
      {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-500" /> : <Icon className="h-4 w-4 shrink-0" />}
      {!square && <span className="truncate">{copied ? "Copied" : label}</span>}
    </button>
  );
}

function Initials({ name, kind }: { name: string; kind: Contact["kind"] }) {
  return (
    <div className={cn(
      "flex h-16 w-16 shrink-0 items-center justify-center border border-border bg-muted text-base font-semibold text-muted-foreground",
      kind === "company" ? "rounded-xl" : "rounded-full",
    )}>
      {name ? initials(name) : kind === "company" ? <Building2 className="h-6 w-6" /> : <User className="h-6 w-6" />}
    </div>
  );
}

function ContactAvatar({ c }: { c: Contact }) {
  const [idx, setIdx] = useState(0);

  const domain = (() => {
    const src = c.website || c.email?.split("@")[1] || c.emails?.[0]?.split("@")[1];
    if (!src) return undefined;
    return src.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  })();
  const linkedinHandle = c.linkedinUrl?.match(/linkedin\.com\/(?:in|company|school)\/([^/?#]+)/i)?.[1];

  // Trust AI's scraped imageUrl FIRST (could be og:image, wikipedia, company team page, licdn).
  // Then LinkedIn-based proxies. Then domain logos.
  const candidates = [
    c.imageUrl,
    linkedinHandle && `https://unavatar.io/linkedin/${linkedinHandle}?fallback=false`,
    c.kind === "company" && domain && `https://logo.clearbit.com/${domain}`,
    domain && `https://unavatar.io/${domain}?fallback=false`,
    c.kind === "company" && domain && `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ].filter((u): u is string => !!u);

  const src = candidates[idx];
  if (!src) return <Initials name={c.name} kind={c.kind} />;

  return (
    <img
      src={src}
      alt={c.name}
      onError={() => setIdx((i) => i + 1)}
      referrerPolicy="no-referrer"
      className={cn(
        "h-16 w-16 shrink-0 border border-border bg-muted",
        c.kind === "company" ? "rounded-xl object-contain p-1" : "rounded-full object-cover",
      )}
    />
  );
}

function ContactCard({ c }: { c: Contact }) {
  const primaryEmail = c.email ?? c.emails?.[0];
  const primaryPhone = c.phone ?? c.phones?.[0];
  const formHref = c.formUrl ?? (c.contactUrl && c.contactUrl !== c.website ? c.contactUrl : undefined);

  // Build up to 4 action buttons, ordered by relevance.
  type Action = { key: string; node: React.ReactNode };
  const actions: Action[] = [];

  // For companies without email/phone but with website, lead with the website.
  if (c.kind === "company" && c.website && !primaryEmail && !primaryPhone) {
    actions.push({ key: "web", node: <ActionButton value={c.website} icon={Globe} label="Website" href={c.website} copyable={false} /> });
  }
  if (primaryEmail) {
    actions.push({ key: "email", node: <ActionButton value={primaryEmail} icon={Mail} label={primaryEmail} /> });
  }
  if (primaryPhone) {
    actions.push({ key: "phone", node: <ActionButton value={primaryPhone} icon={Phone} label={primaryPhone} /> });
  }
  if (formHref && actions.length < 3) {
    actions.push({ key: "form", node: <ActionButton value={formHref} icon={FileText} label="Contact form" href={formHref} copyable={false} /> });
  }
  if (c.kind === "company" && c.website && !actions.some((a) => a.key === "web") && actions.length < 3) {
    actions.push({ key: "web", node: <ActionButton value={c.website} icon={Globe} label="Website" href={c.website} copyable={false} /> });
  }
  // LinkedIn always last as a square icon button.
  if (c.linkedinUrl) {
    actions.push({ key: "li", node: <ActionButton value={c.linkedinUrl} icon={LinkedinIcon} label="LinkedIn" href={c.linkedinUrl} copyable={false} square /> });
  }

  const shownActions = actions.slice(0, 4);

  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-4">
        <ContactAvatar c={c} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-base font-semibold text-foreground">{c.name}</h3>
            <ConfidenceBadge c={c.confidence} />
          </div>
          {c.title && <p className="mt-1 truncate text-sm font-medium text-foreground/80">{c.title}</p>}
          {c.company && c.kind === "person" && <p className="truncate text-sm text-muted-foreground">{c.company}</p>}
          {c.location && (
            <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {c.location}
            </p>
          )}
        </div>
      </div>

      {shownActions.length > 0 && (
        <div className="mt-4 flex items-stretch gap-2">
          {shownActions.map((a) => <div key={a.key} className="contents">{a.node}</div>)}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {c.website && (
          <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
            <Globe className="h-3.5 w-3.5" />
            <span className="max-w-[220px] truncate">{c.website.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {c.source && c.source !== c.website && c.source !== c.contactUrl && (
          <a href={c.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
            Source
          </a>
        )}
      </div>
    </div>
  );
}

export function ContactResults({ contacts }: { contacts: Contact[] }) {
  if (!contacts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        No contacts found. Try refining your query — add a company, location, or role.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {contacts.map((c, i) => (
        <ContactCard key={`${c.email ?? c.name}-${i}`} c={c} />
      ))}
    </div>
  );
}

export function parseContacts(text: string): { prose: string; contacts: Contact[] | null; streaming: boolean } {
  const fenceRe = /```contacts\s*([\s\S]*?)(```|$)/i;
  const m = text.match(fenceRe);
  if (!m) return { prose: text, contacts: null, streaming: false };
  const before = text.slice(0, m.index).trim();
  const body = m[1].trim();
  const closed = m[2] === "```";
  if (!closed) return { prose: before, contacts: null, streaming: true };
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return { prose: before, contacts: parsed as Contact[], streaming: false };
  } catch {
    // ignore
  }
  return { prose: before, contacts: null, streaming: false };
}

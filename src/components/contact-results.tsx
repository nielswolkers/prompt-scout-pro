import { Mail, Phone, ExternalLink, Globe, MapPin, BadgeCheck, AlertCircle, HelpCircle, User, Building2, Check } from "lucide-react";

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>
    </svg>
  );
}
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Contact = {
  name: string;
  kind: "person" | "company";
  title?: string;
  company?: string;
  email?: string;
  emails?: string[];
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  contactUrl?: string;
  imageUrl?: string;
  location?: string;
  source?: string;
  confidence?: "verified" | "likely" | "guessed";
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

function CopyButton({
  value,
  icon: Icon,
  label,
  square = false,
  href,
}: {
  value?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  square?: boolean;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleClick = (e: React.MouseEvent) => {
    if (href) return; // let link navigate
    e.preventDefault();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  const baseCls = cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 text-sm font-medium text-foreground transition-all hover:border-foreground/30 hover:bg-foreground hover:text-background active:scale-[0.97]",
    square ? "w-10 shrink-0" : "flex-1 min-w-0 px-3",
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={baseCls} aria-label={label}>
        <Icon className="h-4 w-4 shrink-0" />
        {!square && <span className="truncate">{label}</span>}
      </a>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={baseCls} aria-label={`Copy ${label}`} title={`Copy ${value}`}>
      {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-500" /> : <Icon className="h-4 w-4 shrink-0" />}
      {!square && <span className="truncate">{copied ? "Copied" : label}</span>}
    </button>
  );
}

function ContactCard({ c }: { c: Contact }) {
  const [imgIdx, setImgIdx] = useState(0);
  const allEmails = [c.email, ...(c.emails ?? [])].filter((e): e is string => !!e);
  const primaryEmail = allEmails[0];
  const extraEmails = allEmails.slice(1);

  // Build a prioritized list of image candidates with smart fallbacks.
  const domain = (() => {
    const src = c.website || primaryEmail?.split("@")[1];
    if (!src) return undefined;
    return src.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  })();
  const linkedinHandle = c.linkedinUrl?.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i)?.[1];

  const imageCandidates = [
    linkedinHandle && `https://unavatar.io/linkedin/${linkedinHandle}`,
    c.imageUrl,
    c.kind === "company" && domain && `https://logo.clearbit.com/${domain}`,
    domain && `https://unavatar.io/${domain}`,
    c.kind === "company" && domain && `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ].filter((u): u is string => !!u);

  const currentImg = imageCandidates[imgIdx];

  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-4">
        <Avatar className={cn("h-16 w-16 shrink-0 border border-border", c.kind === "company" ? "rounded-xl" : "rounded-full")}>
          {currentImg && (
            <AvatarImage
              src={currentImg}
              alt={c.name}
              onError={() => setImgIdx((i) => i + 1)}
              className={c.kind === "company" ? "object-contain p-1" : "object-cover"}
            />
          )}
          <AvatarFallback className={cn("bg-muted text-sm font-medium text-muted-foreground", c.kind === "company" ? "rounded-xl" : "rounded-full")}>
            {c.name ? initials(c.name) : c.kind === "company" ? <Building2 className="h-6 w-6" /> : <User className="h-6 w-6" />}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-base font-semibold text-foreground">{c.name}</h3>
            <ConfidenceBadge c={c.confidence} />
          </div>

          {c.title && (
            <p className="mt-1 truncate text-sm font-medium text-foreground/80">{c.title}</p>
          )}
          {c.company && c.kind === "person" && (
            <p className="truncate text-sm text-muted-foreground">{c.company}</p>
          )}
          {c.location && (
            <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {c.location}
            </p>
          )}
        </div>
      </div>

      {(primaryEmail || c.phone || c.linkedinUrl) && (
        <div className="mt-4 flex items-stretch gap-2">
          <CopyButton value={primaryEmail} icon={Mail} label={primaryEmail ?? "Email"} />
          {c.phone && <CopyButton value={c.phone} icon={Phone} label={c.phone} />}
          {c.linkedinUrl && (
            <CopyButton value={c.linkedinUrl} icon={LinkedinIcon} label="LinkedIn" square href={c.linkedinUrl} />
          )}
        </div>
      )}

      {extraEmails.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {extraEmails.map((email) => (
            <CopyButton key={email} value={email} icon={Mail} label={email} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {c.website && (
          <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
            <Globe className="h-3.5 w-3.5" />
            <span className="max-w-[220px] truncate">{c.website.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {c.contactUrl && c.contactUrl !== c.website && (
          <a href={c.contactUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
            Contact page
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

/**
 * Extract `[{...}]` JSON from a fenced ```contacts block in streamed text.
 * Tolerates an in-progress / unterminated block during streaming.
 */
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
    if (Array.isArray(parsed)) {
      return { prose: before, contacts: parsed as Contact[], streaming: false };
    }
  } catch {
    // fall through
  }
  return { prose: before, contacts: null, streaming: false };
}

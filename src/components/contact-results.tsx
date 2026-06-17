import { Mail, Phone, ExternalLink, Globe, MapPin, BadgeCheck, AlertCircle, HelpCircle, User, Building2, Check } from "lucide-react";
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
  contactUrl?: string;
  linkedinUrl?: string;
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
      <v.Icon className="h-3.5 w-3.5" />
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
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  square?: boolean;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <button
      onClick={handleClick}
      title={href ? `Copy ${value}` : value}
      className={cn(
        "group/btn inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted/70 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background",
        square ? "h-9 w-9 shrink-0" : "h-9 min-w-0 flex-1 px-3"
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <Icon className="h-4 w-4 shrink-0" />
      )}
      {label && !square && <span className="truncate">{copied ? "Copied" : label}</span>}
    </button>
  );
}

function LinkedInButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Open LinkedIn"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0A66C2] text-white transition-opacity hover:opacity-90"
    >
      <LinkedinIcon className="h-4 w-4" />
    </a>
  );
}

function truncateTitle(title?: string, max = 4) {
  if (!title) return "";
  const words = title.trim().split(/\s+/);
  if (words.length <= max) return title;
  return words.slice(0, max).join(" ");
}

function ContactCard({ c }: { c: Contact }) {
  const [imgError, setImgError] = useState(false);
  const allEmails = [c.email, ...(c.emails ?? [])].filter((e): e is string => !!e);
  const uniqueEmails = Array.from(new Set(allEmails));
  const primaryEmail = uniqueEmails[0];
  const title = truncateTitle(c.title, 4);
  const linkedinUrl =
    c.linkedinUrl ??
    (c.website && /linkedin\.com/i.test(c.website) ? c.website : undefined) ??
    (c.source && /linkedin\.com/i.test(c.source) ? c.source : undefined);

  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-4">
        <Avatar className={cn("h-14 w-14 shrink-0 border border-border", c.kind === "company" ? "rounded-xl" : "rounded-full")}>
          {c.imageUrl && !imgError && (
            <AvatarImage
              src={c.imageUrl}
              alt={c.name}
              onError={() => setImgError(true)}
              className={c.kind === "company" ? "object-contain p-1" : "object-cover"}
            />
          )}
          <AvatarFallback className={cn("bg-muted text-sm font-medium text-muted-foreground", c.kind === "company" ? "rounded-xl" : "rounded-full")}>
            {c.name ? initials(c.name) : c.kind === "company" ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-base font-semibold text-foreground">{c.name}</h3>
            <ConfidenceBadge c={c.confidence} />
          </div>
          {title && (
            <p className="mt-0.5 truncate text-sm font-medium text-foreground/80">{title}</p>
          )}
          {c.kind === "person" && c.company && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.company}</p>
          )}
          {c.location && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {c.location}
            </p>
          )}

          {(primaryEmail || c.phone || linkedinUrl) && (
            <div className="mt-3 flex items-stretch gap-2">
              {primaryEmail && (
                <CopyButton value={primaryEmail} icon={Mail} label={primaryEmail} href={`mailto:${primaryEmail}`} />
              )}
              {c.phone && (
                <CopyButton value={c.phone} icon={Phone} label={c.phone} href={`tel:${c.phone}`} />
              )}
              {linkedinUrl && <LinkedInButton url={linkedinUrl} />}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {c.website && !/linkedin\.com/i.test(c.website) && (
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

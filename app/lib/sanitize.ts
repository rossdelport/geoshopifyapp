// Keep only simple, safe HTML for previews (our generated copy and store descriptions).

const ALLOWED = new Set(["p", "ul", "ol", "li", "strong", "em", "b", "i", "br", "h2", "h3", "h4", "a", "span"]);

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name: string, attrs: string) => {
      const n = name.toLowerCase();
      if (!ALLOWED.has(n)) return "";
      if (tag.startsWith("</")) return `</${n}>`;
      if (n === "a") {
        const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
        const safe = /^https?:\/\//i.test(href) ? href.replace(/"/g, "%22") : "#";
        return `<a href="${safe}" target="_blank" rel="noreferrer">`;
      }
      return `<${n}>`;
    });
}

export const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

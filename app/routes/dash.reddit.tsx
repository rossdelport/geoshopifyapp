import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { Form, Link, useFetcher, useLoaderData, useNavigation, useRevalidator } from "react-router";
import db from "../db.server";
import { requireWebShop } from "../lib/web-auth.server";
import { getPlan } from "../lib/plans";
import { formatNumber, timeAgo } from "../lib/format";
import { Icon, ICONS, PageHead, Tabs } from "../components/web";

// usegeo.app/dash/reddit: Reddit threads where people ask about the store's kind of product (found weekly,
// lib/reddit.server.ts). Left: every thread. Right: the post and a neutral reply written as the owner, which
// they copy, then post themselves in the thread. We never post for them.

const SHOW = ["all", "todo", "replied"] as const;
type Show = (typeof SHOW)[number];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const url = new URL(request.url);
  const show: Show = (SHOW as readonly string[]).includes(url.searchParams.get("show") ?? "") ? (url.searchParams.get("show") as Show) : "all";
  // Still to reply first, then replied; newest posts first within each.
  const all = (
    await db.redditThread.findMany({
      where: { shopId: shop.id, status: { not: "hidden" } },
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 300,
      select: { id: true, url: true, subreddit: true, title: true, body: true, author: true, postedAt: true, comments: true, score: true, draft: true, status: true },
    })
  ).sort((a, b) => Number(a.status === "replied") - Number(b.status === "replied"));
  const list = all.filter((t) => show === "all" || (show === "todo" ? t.status === "new" : t.status === "replied"));
  const picked = url.searchParams.get("t");
  const open = list.find((t) => t.id === picked) ?? list[0] ?? null;
  return {
    show,
    opened: Boolean(picked && open),
    counts: { all: all.length, todo: all.filter((t) => t.status === "new").length, replied: all.filter((t) => t.status === "replied").length },
    checkedAt: shop.redditCheckedAt?.toISOString() ?? null,
    weekly: getPlan(shop.plan).id !== "free",
    list: list.map((t) => ({
      id: t.id,
      subreddit: t.subreddit,
      title: t.title,
      snippet: (t.body ?? "").slice(0, 120),
      postedAt: t.postedAt?.toISOString() ?? null,
      comments: t.comments,
      score: t.score,
      status: t.status,
    })),
    open: open
      ? {
          id: open.id,
          url: open.url,
          subreddit: open.subreddit,
          title: open.title,
          body: open.body,
          author: open.author,
          postedAt: open.postedAt?.toISOString() ?? null,
          comments: open.comments,
          score: open.score,
          draft: open.draft ?? "",
          status: open.status,
        }
      : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const intent = form.get("intent");
  const where = { id, shopId: shop.id }; // only this store's threads
  let changed = 0;
  if (intent === "save") {
    changed = (await db.redditThread.updateMany({ where, data: { draft: String(form.get("draft") ?? "").slice(0, 3000) } })).count;
  } else if (intent === "replied") {
    // Flip between replied and not, in one statement.
    changed = await db.$executeRaw`
      UPDATE "RedditThread"
      SET "repliedAt" = CASE WHEN status = 'replied' THEN NULL ELSE now() END,
          status = CASE WHEN status = 'replied' THEN 'new' ELSE 'replied' END
      WHERE id = ${id} AND "shopId" = ${shop.id}`;
  } else if (intent === "hide") {
    changed = (await db.redditThread.updateMany({ where, data: { status: "hidden" } })).count;
  }
  return changed ? { ok: true as const } : { ok: false as const };
};

// Saving a draft (when the reply is copied) changes nothing on screen, so the page doesn't reload for it.
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) =>
  formData?.get("intent") === "save" ? false : defaultShouldRevalidate;

type Data = ReturnType<typeof useLoaderData<typeof loader>>;

const TABS: { key: Show; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To reply" },
  { key: "replied", label: "Replied" },
];

function Thread({ t, self }: { t: NonNullable<Data["open"]>; self: string }) {
  const fetcher = useFetcher<typeof action>();
  const nav = useNavigation();
  const box = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  // "Mark as replied" shows its new state as soon as it's clicked; "Not relevant" fades the thread while it goes.
  const flipping = nav.formData?.get("intent") === "replied" && nav.formData?.get("id") === t.id;
  const replied = flipping ? t.status !== "replied" : t.status === "replied";
  const hiding = fetcher.formData?.get("intent") === "hide";

  // Copy the reply, then the link opens the thread in a new tab (the browser does that part).
  const copy = () => {
    const text = box.current?.value ?? t.draft;
    navigator.clipboard?.writeText(text).catch(() => box.current?.select());
    fetcher.submit({ intent: "save", id: t.id, draft: text }, { method: "post" });
    setCopied(true);
  };

  return (
    <article className={`w-rd-post${hiding ? " w-dim" : ""}`} aria-labelledby="rd-title" aria-busy={hiding || undefined}>
      <div className="w-rd-meta">
        <span className="w-rd-sub">r/{t.subreddit}</span>
        {t.postedAt ? <span>{timeAgo(t.postedAt)}</span> : null}
        {t.author ? <span>u/{t.author}</span> : null}
        <a className="w-rd-open" href={t.url} target="_blank" rel="noreferrer">
          Open thread
        </a>
      </div>
      <h2 id="rd-title">{t.title}</h2>
      {t.body ? <p className="w-rd-body">{t.body}</p> : null}
      <div className="w-rd-stats">
        <span>▲ {formatNumber(t.score)} upvotes</span>
        <span>{formatNumber(t.comments)} comments</span>
      </div>

      <div className="w-rd-reply">
        <label htmlFor={`reply-${t.id}`}>Your reply</label>
        <textarea key={t.id} id={`reply-${t.id}`} ref={box} className="w-input" defaultValue={t.draft} rows={7} />
        <p className="w-note">
          Written as you, the owner. Keep the part that says who you are: Reddit asks for it, and people trust an honest reply more.
          Edit anything you like.
        </p>
        <div className="w-rd-btns">
          <a className="w-btn w-btn-sm" href={t.url} target="_blank" rel="noreferrer" onClick={copy}>
            <span key={copied ? "done" : "copy"} className={copied ? "w-swap" : undefined}>
              {copied ? (
                <>
                  <Icon d={ICONS.check} /> Copied. Paste it in the thread
                </>
              ) : (
                "Copy and open thread"
              )}
            </span>
          </a>
          {/* Posts to this thread's own address, so the page stays on it after the list re-sorts. */}
          <Form method="post" action={self} preventScrollReset>
            <input type="hidden" name="id" value={t.id} />
            <button className={`w-btn w-btn-ghost w-btn-sm${replied ? " w-rd-done" : ""}`} type="submit" name="intent" value="replied">
              <span key={replied ? "on" : "off"} className="w-swap">
                {replied ? (
                  <>
                    <Icon d={ICONS.check} /> Replied
                  </>
                ) : (
                  "Mark as replied"
                )}
              </span>
            </button>
          </Form>
          <fetcher.Form method="post">
            <input type="hidden" name="id" value={t.id} />
            <button className="w-link-btn" type="submit" name="intent" value="hide">
              Not relevant
            </button>
          </fetcher.Form>
        </div>
      </div>
    </article>
  );
}

/** While another thread loads: its title and details straight away, grey shapes for the post and reply. */
function ThreadLoading({ t }: { t: Data["list"][number] }) {
  return (
    <article className="w-rd-post" aria-busy="true">
      <div className="w-rd-meta">
        <span className="w-rd-sub">r/{t.subreddit}</span>
        {t.postedAt ? <span>{timeAgo(t.postedAt)}</span> : null}
      </div>
      <h2>{t.title}</h2>
      <span className="w-sk" style={{ height: 88, borderRadius: 10 }} />
      <span className="w-sk" style={{ width: 90, height: 13 }} />
      <span className="w-sk" style={{ height: 150, borderRadius: 10 }} />
    </article>
  );
}

export default function Reddit() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const nav = useNavigation();
  const waiting = !data.checkedAt;
  // A click on a thread or tab shows straight away; the data follows.
  const next = nav.state === "loading" && !nav.formMethod && nav.location.pathname === "/dash/reddit" ? new URLSearchParams(nav.location.search) : null;
  const nextShow = next ? ((SHOW as readonly string[]).includes(next.get("show") ?? "") ? (next.get("show") as Show) : "all") : data.show;
  const nextT = next?.get("t") ?? null;
  const loadingThread = nextT && nextT !== data.open?.id ? data.list.find((t) => t.id === nextT) : undefined;
  const openId = loadingThread?.id ?? data.open?.id;

  // The first look runs right after setup: refresh until it's done.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => !document.hidden && revalidator.state === "idle" && revalidator.revalidate(), 8000);
    return () => clearInterval(t);
  }, [waiting, revalidator]);

  const href = (o: { show?: Show; t?: string }) => {
    const q = new URLSearchParams();
    const show = o.show ?? data.show;
    if (show !== "all") q.set("show", show);
    if (o.t) q.set("t", o.t);
    return `/dash/reddit${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHead
        title="Reddit threads"
        intro="People on Reddit asking about products like yours. Read the post, check the reply we wrote for you, then copy it and post it yourself in the thread."
        right={
          <>
            <span className={`w-chip ${data.counts.todo ? "warn" : "ok"}`}>{data.counts.todo} to reply</span>
            <span className={`w-chip${waiting ? " live" : ""}`}>
              {waiting ? "Looking for threads now" : `${data.weekly ? "New threads weekly" : "Found"} · ${timeAgo(data.checkedAt)}`}
            </span>
          </>
        }
      />

      {!data.weekly && data.checkedAt ? (
        <p className="w-note">On a paid plan, new threads arrive every week.</p>
      ) : null}

      <div className="w-rd" data-open={data.opened ? "1" : undefined}>
        <section className="w-rd-list w-box" aria-label="Threads">
          <Tabs label="Show" items={TABS.map((tab) => ({ to: href({ show: tab.key }), label: tab.label, count: data.counts[tab.key], active: nextShow === tab.key }))} />
          {data.list.length ? (
            <ul>
              {data.list.map((t) => (
                <li key={t.id}>
                  <Link to={href({ t: t.id })} className={openId === t.id ? "active" : undefined} prefetch="intent" preventScrollReset>
                    <span className="w-rd-row">
                      <span className="w-rd-sub">r/{t.subreddit}</span>
                      {t.postedAt ? <span>{timeAgo(t.postedAt)}</span> : null}
                      {t.status === "replied" ? <span className="w-rd-tick">✓ Replied</span> : null}
                    </span>
                    <b>{t.title}</b>
                    {t.snippet ? <span className="w-rd-snip">{t.snippet}</span> : null}
                    <span className="w-rd-row">
                      <span>▲ {formatNumber(t.score)}</span>
                      <span>{formatNumber(t.comments)} comments</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="w-empty">
              {waiting
                ? "We’re looking through Reddit for people asking about products like yours. This takes a few minutes."
                : data.show === "all"
                  ? "No threads found yet. We look again every week."
                  : "Nothing here yet."}
            </p>
          )}
        </section>

        <section className="w-rd-detail w-box">
          {data.opened ? (
            <Link className="w-rd-back" to={href({})}>
              ‹ All threads
            </Link>
          ) : null}
          {loadingThread ? (
            <ThreadLoading key={loadingThread.id} t={loadingThread} />
          ) : data.open ? (
            <Thread key={data.open.id} t={data.open} self={href({ t: data.open.id })} />
          ) : (
            <p className="w-empty">Pick a thread to see the post and your reply.</p>
          )}
        </section>
      </div>
    </>
  );
}

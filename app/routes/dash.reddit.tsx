import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useFetcher, useLoaderData, useRevalidator } from "react-router";
import db from "../db.server";
import { requireWebShop } from "../lib/web-auth.server";
import { getPlan } from "../lib/plans";
import { formatNumber, timeAgo } from "../lib/format";
import { PageHead } from "../components/web";

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
  const thread = await db.redditThread.findFirst({ where: { id, shopId: shop.id } });
  if (!thread) return { ok: false as const };
  const intent = form.get("intent");
  if (intent === "save") {
    await db.redditThread.update({ where: { id }, data: { draft: String(form.get("draft") ?? "").slice(0, 3000) } });
  } else if (intent === "replied") {
    const replied = thread.status !== "replied";
    await db.redditThread.update({ where: { id }, data: { status: replied ? "replied" : "new", repliedAt: replied ? new Date() : null } });
  } else if (intent === "hide") {
    await db.redditThread.update({ where: { id }, data: { status: "hidden" } });
  }
  return { ok: true as const };
};

type Data = ReturnType<typeof useLoaderData<typeof loader>>;

const TABS: { key: Show; label: string }[] = [
  { key: "all", label: "All" },
  { key: "todo", label: "To reply" },
  { key: "replied", label: "Replied" },
];

function Thread({ t, self }: { t: NonNullable<Data["open"]>; self: string }) {
  const fetcher = useFetcher<typeof action>();
  const box = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const replied = t.status === "replied";

  // Copy the reply, then the link opens the thread in a new tab (the browser does that part).
  const copy = () => {
    const text = box.current?.value ?? t.draft;
    navigator.clipboard?.writeText(text).catch(() => box.current?.select());
    fetcher.submit({ intent: "save", id: t.id, draft: text }, { method: "post" });
    setCopied(true);
  };

  return (
    <article className="w-rd-post" aria-labelledby="rd-title">
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
            {copied ? "Copied. Paste it in the thread" : "Copy and open thread"}
          </a>
          {/* Posts to this thread's own address, so the page stays on it after the list re-sorts. */}
          <Form method="post" action={self} preventScrollReset>
            <input type="hidden" name="id" value={t.id} />
            <button className={`w-btn w-btn-ghost w-btn-sm${replied ? " w-rd-done" : ""}`} type="submit" name="intent" value="replied">
              {replied ? "✓ Replied" : "Mark as replied"}
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

export default function Reddit() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const waiting = !data.checkedAt;

  // The first look runs right after setup: refresh until it's done.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 8000);
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
          <nav className="w-rd-tabs" aria-label="Show">
            {TABS.map((tab) => (
              <Link key={tab.key} to={href({ show: tab.key })} className={data.show === tab.key ? "active" : undefined} preventScrollReset>
                {tab.label} <span>{data.counts[tab.key]}</span>
              </Link>
            ))}
          </nav>
          {data.list.length ? (
            <ul>
              {data.list.map((t) => (
                <li key={t.id}>
                  <Link to={href({ t: t.id })} className={data.open?.id === t.id ? "active" : undefined} preventScrollReset>
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
          {data.open ? <Thread key={data.open.id} t={data.open} self={href({ t: data.open.id })} /> : <p className="w-empty">Pick a thread to see the post and your reply.</p>}
        </section>
      </div>
    </>
  );
}

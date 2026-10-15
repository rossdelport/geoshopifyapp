import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { aiConfigured } from "../lib/ai.server";
import { blogScheduleLine, blogState } from "../lib/blog.server";
import { kindLabel, postPath } from "../lib/blog/pages";
import { enqueue } from "../lib/jobs.server";
import { timeAgo } from "../lib/format";
import { abs } from "../lib/tools/site";
import { shortDate } from "../components/admin";

// Admin blog: every post the blog.write job has written (lib/blog.server.ts), with a link, Hide / Show, what the
// schedule does next, how the last write went, and a "Write one now" button.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const [posts, state, job] = await Promise.all([
    db.blogPost.findMany({ orderBy: { publishedAt: "desc" }, select: { id: true, slug: true, title: true, kind: true, words: true, status: true, publishedAt: true } }),
    blogState(),
    db.job.findFirst({ where: { type: "blog.write" }, orderBy: { updatedAt: "desc" }, select: { status: true, error: true, updatedAt: true, attempts: true } }),
  ]);
  return {
    posts: posts.map((p) => ({ ...p, url: abs(postPath(p.slug)), publishedAt: p.publishedAt.toISOString() })),
    schedule: blogScheduleLine(state),
    job: job ? { status: job.status, error: (job.error ?? "").slice(0, 300), at: job.updatedAt.toISOString(), attempts: job.attempts } : null,
    ai: aiConfigured(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");
  if (intent === "hide" || intent === "show") {
    await db.blogPost.updateMany({ where: { id }, data: { status: intent === "hide" ? "hidden" : "published" } });
  }
  if (intent === "write") await enqueue("blog.write", {}, { dedupeKey: "blog.write" });
  return null;
};

function jobLine(job: NonNullable<Awaited<ReturnType<typeof loader>>["job"]>): string {
  if (job.status === "queued") return "A post is queued and will be written in the next minute or two.";
  if (job.status === "running") return "A post is being written right now (about 3 minutes).";
  if (job.status === "failed") return `The last write failed after ${job.attempts} tries (${timeAgo(job.at)}): ${job.error || "no error text"}. It tries again in 3 hours.`;
  return `The last post was written ${timeAgo(job.at)}.`;
}

export default function AdminBlog() {
  const { posts, schedule, job, ai } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const busy = job?.status === "queued" || job?.status === "running" || nav.state !== "idle";
  const live = posts.filter((p) => p.status === "published").length;
  return (
    <>
      <section className="w-sec">
        <div className="w-sec-head">
          <h2>
            {live} live post{live === 1 ? "" : "s"}
            {posts.length > live ? `, ${posts.length - live} hidden` : ""}
          </h2>
          <p>
            {schedule} {job ? jobLine(job) : "No write has run yet."}
            {!ai ? " Claude is not set up, so nothing can be written." : ""}
          </p>
        </div>
        <div className="w-box" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 16 }}>
          <Form method="post">
            <button className="w-btn w-btn-sm" type="submit" name="intent" value="write" disabled={!ai || busy}>
              Write one now
            </button>
          </Form>
          <span className="w-note">
            Writes the next topic in the list (or a new one once the list is done), checks its facts and publishes it. You get an email.
          </span>
        </div>
      </section>
      <section className="w-sec">
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>Post</th>
                <th>Kind</th>
                <th>Words</th>
                <th>Published</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="w-q">
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.title}
                    </a>
                  </td>
                  <td>{kindLabel(p.kind)}</td>
                  <td className="num">{p.words}</td>
                  <td className="num">{shortDate(p.publishedAt)}</td>
                  <td>
                    <span className={`w-pill ${p.status === "published" ? "ok" : ""}`}>{p.status === "published" ? "Live" : "Hidden"}</span>
                  </td>
                  <td>
                    <Form method="post">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="w-link-btn" type="submit" name="intent" value={p.status === "published" ? "hide" : "show"}>
                        {p.status === "published" ? "Hide" : "Show"}
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!posts.length ? <p className="w-empty">No posts yet. The first six are written half an hour apart once the worker is running.</p> : null}
        </div>
      </section>
    </>
  );
}

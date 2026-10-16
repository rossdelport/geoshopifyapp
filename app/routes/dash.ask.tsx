import { useEffect, useRef, useState } from "react";
import { PageHead } from "../components/web";

// usegeo.app/dash/ask: Ask GEO, the help chat (lib/ask.server.ts, answered by dash.ask_.answer.tsx). The chat
// lives in the page only: nothing is saved, and closing or refreshing the page starts a new one.

const MAX_CHARS = 2000; // ASK_LIMITS.messageChars
const FAILED = "Sorry, something went wrong answering that. Please try again, or email ross@usegeo.app.";
type Answer = { ok: true; reply: string; flagged: boolean } | { ok: false; error: string };

type Msg = { role: "user" | "assistant"; content: string; flagged?: boolean; error?: boolean };

const STARTERS = [
  { q: "What should I do first?", note: "The steps that matter most for your store" },
  { q: "How does my visibility score work?", note: "What it counts and how to raise it" },
  { q: "How do I get ChatGPT to recommend my store?", note: "The best ways to get named by AI" },
  { q: "How do I add the tracking code?", note: "See the money that comes from AI" },
];

export default function Ask() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs.length, busy]);

  const send = async (q: string) => {
    const content = q.trim().slice(0, MAX_CHARS);
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setText("");
    setBusy(true);
    let d: Answer = { ok: false, error: FAILED };
    try {
      const res = await fetch("/dash/ask/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }),
      });
      // Signed out meanwhile (the 30-day cookie ran out): the request landed on the sign-in page.
      if (res.redirected || new URL(res.url).pathname.startsWith("/login")) {
        window.location.assign("/login?next=/dash/ask");
        return;
      }
      if (res.ok) d = (await res.json()) as Answer;
    } catch {
      // keep the friendly error
    }
    setMsgs((m) => [...m, d.ok ? { role: "assistant", content: d.reply, flagged: d.flagged } : { role: "assistant", content: d.error, error: true }]);
    setBusy(false);
  };

  return (
    <>
      <PageHead
        title="Ask GEO"
        right={
          msgs.length ? (
            <button className="w-btn w-btn-ghost w-btn-sm" type="button" onClick={() => setMsgs([])} disabled={busy}>
              New chat
            </button>
          ) : null
        }
      />
      <div className="w-ask">
        {msgs.length ? (
          <div className="w-ask-log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`w-ask-msg ${m.role}${m.error ? " err" : ""}`}>
                <p>{m.content}</p>
                {m.flagged ? <span className="w-chip ok">Passed to the GEO team</span> : null}
              </div>
            ))}
            {busy ? (
              <div className="w-ask-msg assistant">
                <span className="w-ask-dots" aria-label="Writing an answer">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : null}
            <div ref={end} />
          </div>
        ) : (
          <div className="w-ask-empty">
            <span className="w-logo" aria-hidden="true">
              <i />
            </span>
            <h2>Ask GEO</h2>
            <p>Ask anything about GEO or getting your store recommended by AI. Straight answers, no fluff.</p>
            <div className="w-ask-starts">
              {STARTERS.map((s) => (
                <button key={s.q} type="button" onClick={() => send(s.q)}>
                  <b>{s.q}</b>
                  <span>{s.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="w-ask-box"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <textarea
            className="w-input"
            rows={1}
            value={text}
            maxLength={MAX_CHARS}
            placeholder="Ask about your score, Reddit, pitches, or how to get recommended by AI…"
            aria-label="Your question"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
          />
          <button className="w-btn w-btn-sm" type="submit" disabled={busy || !text.trim()} aria-label="Send">
            Send
          </button>
        </form>
        <p className="w-note w-ask-foot">Chats aren’t saved. Need billing or account help? Email ross@usegeo.app.</p>
      </div>
    </>
  );
}

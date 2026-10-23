# Interview: Josh Pigford on Firstindex (shared 23 Oct 2026)

Ross shared this video interview. Josh Pigford runs **Firstindex**, a done-for-you service that gets companies found
in Google and named by AI assistants like ChatGPT. It is the closest model to GEO's A$1,000 a month offer. Website: firstindex.com.

## Summary

- **The result:** about US$570,000 a year in recurring revenue within a month of one tweet (25 Sept 2026).
  He said "about 30 clients right now".
- **The offer:** US$1,000 a month at launch, done for you, all talk happens in Slack. (By 23 Oct 2026 his site
  showed US$2,000 a month after a 3-month start, or US$1,500 a month on a 12-month plan.) Sign-up is a bare form that emails him.
  He says anyone promising rankings is "full of it".
- **The team:** just him plus Claude (Claude Opus for nearly everything, a little GPT for images).
- **Clients kept apart:** one GitHub repo per client, and a fresh Claude session for each task, so nothing mixes
  between clients.
- **What each client's repo holds:** a work log, research (up to about 100 sources saved per article), Google Search
  Console numbers, and the answers from asking ChatGPT the questions buyers ask, with whether the client was named.
- **Onboarding:** read the client's site and help docs, then ask lots of questions (where they are, goals,
  competitors, features, tone of voice). It all becomes research documents used for writing.
- **Every day:** a script runs several times a day for each client and picks the most useful job, based on Search
  Console data. It might be a new article, a headline change, a small tool (like a calculator) on their site, or an
  email to fix wrong information someone published about them.
- **Code checks, because AI is not consistent:** a "truth document" of facts per client, with code checking that
  numbers stay right across every article; a limit on links per article; tests for any tool he builds.
- **Admin work automated too:** skills set up new clients (Notion pages), ask clients in Slack to review content or
  answer questions, and gather their replies in one place. It all runs on a Mac mini, with small Cloudflare apps
  linking Slack and Notion. Notion is his database, including for AI answer tracking.
- **Data costs:** DataForSEO, about US$100 a week for 30 clients, against "many thousands" for Ahrefs.
- **Mostly on-site work**, plus some email outreach (often correcting wrong facts so AI repeats the right ones).
- **No Reddit marketing.** He calls it using AI "to fake community" and thinks it will burn people in the long run.
- **The big idea:** clients don't care that AI is involved. They want the problem solved and no app to log into,
  maybe a report now and then. Use AI so one person does the work of a team of 10, and keep a human for judgment
  calls. He runs the same model in another business, Knockoff (copycat takedowns, US$800 a month).

## What it means for GEO

- It backs the A$1,000 a month done-for-you offer: buyers pay for the result, not the software.
- He works with software companies and has turned store owners away, so ecommerce is GEO's opening.
- Ideas worth copying: a facts file per client checked by code, a daily "most useful next job" picker, and
  correcting wrong facts about a brand on other sites.
- GEO's Reddit finder is different from what he criticises (the store owner posts the reply themselves and says
  who they are), but his view is a reminder to keep that rule strict.

---

## Transcript

Lightly tidied for reading: filler words removed, obvious mishearings fixed (for example "clawed" to Claude,
"ChachiPT" to ChatGPT, "data for SEO" to DataForSEO). The original had no speaker names, so the labels below are
best guesses.

**Host:** This guy reached $570,000 in annual recurring revenue within a month of launching his idea. You see, he
realized that he had a system for getting his site to rank in ChatGPT, Google, and other discovery tools. So, he
offered it as a paid service. He signed up dozens of clients and then he let Claude do most of the work. This is the
kind of business that can really take off in an AI-driven world. So, I asked my friend Josh Pigford to talk about how
it's done. Let's get into it.

*[Presented by Zapier, the AI automation company.]*

**Host:** Josh, this is the tweet that made me just reach out to you on tech so many times to have you come on here.
You are up to, is this still accurate? $474,000 in annual recurring revenue.

**Josh:** No, it's about 100,000 short now.

**Host:** What do you mean? Where is it?

**Josh:** I mean, it's at like 570,000 [laughter] something now.

**Host:** And this is an idea that wasn't public a month ago, correct? So, what was the...

**Josh:** This is the first tweet. This was on a Friday at almost 5:00 PM on September 25th, was what kicked this off.
So, it hasn't even been a month yet.

**Host:** Summarize this message. What was the offer that you made in that first tweet?

**Josh:** Yeah. So, I've been an entrepreneur for two decades and so obviously I've done a lot of SEO stuff with
different businesses over the years. So, I had sort of turned all of this SEO plus AI mention tracking stuff into this
whole system that I've been using on my own sites for most of the year. And so I said, hey, I would love to do this
for some other companies and just see if there's anything here.

So that was very much like, I'm wrapping up at work for the day, about to go downstairs and eat dinner with the
family, and so I just threw this out and said, like, a thousand bucks a month. You know, this all happens in Slack,
shoot me a DM if you're interested.

**Host:** And the offer is that when somebody is searching for them on OpenAI's different chat apps, on Claude, etc.,
that you will help them be the answer that those AI engines offer up, right?

**Josh:** Correct. That's the basic value proposition.

**Host:** How can you do that? What's the approach that you take? Because this is also new and mysterious, curious,
that nobody has an easy answer, do they?

**Josh:** Sure. No. No. Anybody who's promising rankings is full of it, but all this stuff is rooted in good SEO, which
has been around since the beginning of the internet. And so at the foundation, it's just good SEO practices. And then
we're tracking both SEO and what would be called AEO or GEO, and making changes that address the ways that these
different LLMs approach finding information and gearing it towards them, and then tracking what works, what doesn't,
and then adjusting. So this isn't a one-and-done thing. This is like every single day we're making tweaks to your
content and deciding what's most important to do in a given day.

**Host:** When you say "we", how many people are on the team doing this?

**Josh:** Me and a bunch of AI bots.

**Host:** What's the AI that you're using to run it? What's the overall approach?

**Josh:** Yeah. So, it's Claude at the foundation. That's for pretty much everything. There's a little bit of GPT
sprinkled in around some image generation stuff when that's required, but even that's pretty rare. So, it's basically
Claude Opus at pretty much every step.

**Host:** Okay, how do you keep them separated, all these different clients? Is it different Claude chats? Is it
something else?

**Josh:** Yeah. So they are all, from a technical perspective, very siloed. So there's not this bleed between clients.
They've each got their own... so we operate through GitHub repos. So both their own, and then we also have our own
versions, or sort of instances, that we're tracking all this stuff in. So again, there's no bleed between files or
anything like that. And then there's different sessions with Claude to do each task. So there's no context bleed or
anything like that.

**Host:** What do you keep in a repo in GitHub for each client to make sure that you're organized with them?

**Josh:** Yeah. So a lot of it is data. It's both what would be a work log, like here are the things that we did,
here's all of the research that we've done. So when you produce an article, we might go find a hundred different
pieces of content to use as reference for producing that content. So we're saving all of that. It's Google Search
Console for different numbers. It's us doing actual calls to ChatGPT to track different ways that people could be
looking for what you're solving. Not just looking for your company, but looking for the specific thing that your
company does, and seeing if you come up for that, and then tracking if you get mentioned or not, all that kind of
stuff. It's a massive amount of data per client that we're tracking.

**Host:** All stored in there. And what's your approach? Is it to get them on Reddit? Is it to create YouTube videos
for them? Is it just on-site content? And then we'll talk about the tools that you use to keep track of it.

**Josh:** Yeah, so it's kind of a mix of everything. We do some outreach via email, sort of what would be considered
link building, not just asking for links, but a lot of it is correcting information that somebody might have posted
about your company, so that LLMs are repeating correct data. But most of it is on-site optimization kind of stuff.
The Reddit stuff I think is mostly shady, scammy. It's going to get you. I think it's a short-term play that's going
to burn you in the long run. So we're focused on these long, slow-moving bits that pay off in the long run.

**Host:** Interesting. I've got to say, I've actually talked to multiple companies that are very big on saying that
Reddit and YouTube are a big source of content for LLMs, and they're active on both platforms and they're not doing
anything shady. They're using their own accounts, but they are filling in answers. They're asking questions that lead
to the kinds of answers that they want. But you're not?

**Josh:** I think most people are giving a very polished view of what they're doing. I think most of the people who
are doing that at a scale level, like companies that say that they do Reddit marketing for you, are shady as hell. So
I have a very low amount of respect.

**Host:** What are they doing that's so shady? What's the bad thing that they're doing?

**Josh:** It's the epitome to me of the dead internet theory. So maybe they're not automating responses, but they're
using AI to fake community. And I think that's...

**Host:** I see. Okay.

**Josh:** I think that's lowbrow.

**Host:** Okay. So, how do you know what content to write for each client?

**Josh:** Yeah, so there's an onboarding process where we ingest all the stuff that we can find from your own site,
from your own help docs. We also ask a ton of questions just to learn more about where you're at, where you've been,
and then where you want to go with the company, and who your competitors are, features, all sorts of stuff. And then
we use that, and the tone that you want to take when you're talking to potential customers. And all of that gets
rolled up into essentially these research documents that we use for reference when producing content.

**Host:** You know, in the old days, people would have SOPs, standard operating procedures, for stuff like this.
Today, it's skills. Is that what you have? A skill that guides you to asking questions, a skill that then guides you
to creating the content. Is that right?

**Josh:** Yeah, so there's certainly a lot of skills. There's also a lot of... I mean, really it's Python ultimately.
There's a ton of code that happens in the background to make this stuff repeatable. The pros and cons of an LLM is
it's non-deterministic, meaning you run it 10 times, you're going to get 10 different outcomes basically. So we use a
lot of code to help make that a little bit more reliable or repeatable. But a lot of it is these very specific skills
for doing different tasks.

**Host:** Like what? Onboarding, I'm assuming, is a skill with a set of questions that you need answered.

**Josh:** Mhm. And a lot of this stuff is also systems, operational stuff, which I find fascinating about all this.
Like, okay, if I've got a few dozen clients, I'm personally having to repeat a lot of this stuff. So I've got skills
for setting up new clients, where it creates all the Notion documents and fills all of them out with the things that
I need from them. Reaching out to them when we've got some new piece of content that we need them to review. It's
automating the "okay, we're going to produce this piece of content, but I need some clarifications on the way that
your app works". So it'll automatically post something in Slack for them to respond to, and then ingest all of their
responses, so that I can keep track of the hundred different places that they could respond in Slack or in Notion,
and I have all that in one place so I can manage all of that stuff. So there's a lot of just operational stuff that
happens there.

**Host:** And all those triggers are happening in what? In the terminal, or the Claude Code desktop app or something?
How are you keeping track of it all?

**Josh:** Yeah. So the main tools that I'm using here are Slack, Notion, and then Claude Code via the terminal.
There's a few things that happen with APIs to make Slack and Notion talk to each other, and that's these tiny little
apps that I have hosted on Cloudflare. But for the most part, correct. And then at the end of the day, it's all
running on a Mac mini here in my office.

**Host:** So, wait, the trigger that says "we need a new article for this client" is a Notion doc?

**Josh:** No. Well, the trigger is multiple times a day. I have basically a Python script that says kick off all of
these different tasks for each client. What happens, though, is it's different for every client, based on what our
system has decided is most impactful. That could be an outreach email to fix something that somebody wrote about
you. It could be a mini tool that we're going to build for you on your site. It could be changing a headline within
one article. It could be writing a new article. It could be one of dozens of things, but it decides based on data
from Google Search Console, etc. It decides what's likely most impactful and then does it.

**Host:** So you've got an automation that checks Google Search Console for each client, that then, based on your
approach, says what you should do today for each of these clients. You then trigger a message to them on Slack if
you need something, or you just write the article yourself and publish it to their site.

**Josh:** Correct.

**Host:** I see. Okay. This is an interesting way of doing it. Now, you and I talked last about how you were setting
up Hermes Agent and trying to figure out what LLM to add to it. And I'm surprised that you wouldn't use Hermes Agent
or Grockbot or Hyper Agent or any one of these tools to say "each one of my clients has an agent and the agent is
managing them according to our process". Why do you prefer to do it this way?

**Josh:** I've essentially built my own version of those. My problem, I guess, with Hermes or OpenClaw or whatever is
there's a lot of bloat that I just don't need. And so at the end of the day, I would be fixing problems with those
versus just building what I need. So I've just built this system to run this specific business. And so I can move a
lot faster than having to work within the confines of someone else's system.

**Host:** And when you started it off, what existed before you built your version of Hermes Agent?

**Josh:** Nothing. I mean, it did start as a single SEO skill. That was at the root of it. And then it just kept
expanding past that.

**Host:** So in the beginning it was a skill handling all your approaches for yourself. Great. Then you added another
client, still using the skill. Then you started to find little things that needed to happen and you started building
on top of it. And then at some point it sounds like the lack of predictability of an AI model made you decide you
needed to start writing code. What are some of the things where you said "I cannot leave this to chance"? I know that
AI is a probabilistic machine, and it's good, but it's probably going to make mistakes. What are some of the things
that you turned into code because of that?

**Josh:** Yeah. So there's a lot of checking for the validity of statements made. For every client we've essentially
got a truth document: here are facts about the company and what they offer. So using code to make sure that numbers
stay accurate across, you know, a thousand articles. It's making sure that we don't use too many links in a given
article, so counting the number of links. It's bug fixing, because we're actually coding here. If we build a
calculator for something for some client, we need to actually run code on the machine to run tests for it and build
all the code and make sure it works. So there's a lot of moving pieces there.

**Host:** Can I see the site itself? It's pretty bare bones. When I was looking at it with my agent, my agent said
there's not much here. Even the "get started" took the agent to your email.

**Josh:** Yeah, it's a little form here that just sends me an email.

**Host:** That's it?

**Josh:** That's it.

**Host:** By the way, on...

**Josh:** I think...

**Host:** Uh-huh. Go ahead.

**Josh:** I think long term it would make sense for me to build this thing out to have this sort of major SEO and AI
presence. At the moment I'm too busy making money though [laughter], so I don't necessarily need to do a really
elaborate site at the moment.

**Host:** You know, the other tab that you have open is one of the tools that you use. Can you click over? Tell me
how you use it. What is this?

**Josh:** Yeah. So, DataForSEO. Anybody who's dabbled in SEO, certainly from a programmatic perspective, is familiar
with them. It looks very dated. It's probably had the same design for who knows how long, but it's exactly what it
is, right? So, they're rolling in it. It's basically an alternative to... there's lots of different SEO tools that
people pay hundreds or thousands of dollars for to get data access to Google rankings and things like that. And this
just gives you very inexpensive access to those tools.

**Host:** How much is it, roughly, for all the clients? How many clients do you have and how much are you paying for
this data?

**Josh:** So, I think we're 30 clients right now, and I spend maybe $100 a week...

**Host:** ...on all the data, versus if you're using Ahrefs or...

**Josh:** I would be spending many thousands.

**Host:** Wow.

**Josh:** Yeah.

**Host:** This is incredible. I mean, really, within a month, you're at over half a million dollars in annual
recurring revenue. You could potentially end up with a multi-million dollar business here that's run by just you and
Claude, and a set of skills and tools that you're building yourself.

**Josh:** That's the hope.

**Host:** What's the big takeaway for somebody who's listening to this?

**Josh:** So, where I've found myself going on the entrepreneurial side of things, as someone who builds too many
things and has a hundred random projects going at any given time: in a world where anybody can build software quickly
now, it's using AI to make humans more efficient versus replacing them. I think what's valuable about Firstindex and
what I'm offering is it's a thing that people want to have done for them, and they don't want to think about it. So
it's this done-for-you, agency services kind of component. So focusing on automating that kind of stuff, stuff that
still needs a human in the loop, and makes me more efficient where otherwise it would have taken a team of 10 to do
this, is some low-hanging fruit at the moment.

So I also do this with another business I have called Knockoff, which is finding people who are copycats, kind of
stealing people's images, ecommerce sites using their brand to try to phish people, that kind of stuff. There are
these takedown processes that you can do across Amazon, Walmart, whatever, but they're very time-intensive to do. But
I can use AI to heavily automate the process for companies. So then companies pay 800 bucks a month for that.

**Host:** That's the model behind Knockoff. Knockoff is this browser plugin that lets you know, if you're on Amazon,
if what you're looking at is a junky knockoff that's not going to work within a few weeks, versus the original. And I
know you were looking for a business model once you created this tool. That's the model you came up with. The
question I have on that is: can't somebody just say, "I see that there's a process here, I'm going to give it to
Claude or give it to one of these agent tools and tell it to go figure this out for me"?

**Josh:** You would think that, but no. There's a lot of legal documents involved. Most of these tools are
diabolically opposed to automated processes, like an automated browser going in and trying to fill this stuff out for
you. You get blocked instantly. And you're making legal statements. So having AI basically make a legal declaration
on your behalf is pretty risky. And it's also ripe for missing stuff, or doing it incorrectly.

**Host:** If it's a one-man operation, how do you get to make the declarations for people?

**Josh:** I'm basically a registered agent. So they sign an agreement for me to operate on their behalf.

**Host:** But isn't it your agent that's doing it? So then ultimately, are we still doing it?

**Josh:** No. It's me filling out the form, but what I have AI do is collect... In the same way that if you have a
chargeback and you're trying to prove that the chargeback is illegitimate for your company, you have to put together
a package basically proving that this was a legitimate customer. We're using AI to create the entire takedown
package: assembling the images, writing all the legal jargon. And then I go in and click the buttons to submit all
the data.

**Host:** I see. So your vision is AI companies that require a human in the loop: just make that human much more
efficient. And what you do is look around and say, what do I as a business owner do already? Maybe I already have
these skills built up for myself. How do I sell them? And you make an offer on Twitter. (Let me see your site again,
just so we have that up on the screen while we do it.) Or, what do I see that's necessary for others? And I will be
the human in the loop that has all this automation designed to make my work super easy, and all I have to do is the
human part. That's the model that we need to follow from this.

**Josh:** Correct. And I think where people get caught up is they think that AI is the selling point. In some cases
it is, but in this case, with Firstindex and with Knockoff, the people who are paying kind of don't give a rip that
AI is involved. They just want the problem solved. For both of those, there's not really any UI. There's not some
fancy app for them to be involved in. They set it up and then they might get a report that gives them some
information, an update, but they don't want to interact with my tools. They want the thing done and their business
to keep growing, and they can focus on what they're good at.

**Host:** Well, Josh, why can't Firstindex, for example, just be a fully software-as-a-service business where people
sign up and then the whole thing is automated? What do they need you for?

**Josh:** Because there's the judgment calls, which I do think can eventually be automated. But again, that goes back
to the software side of things, where people don't want to be involved. A developer doesn't want to have to go and
build a mini tool or whatever. They want to just continue building the product, and then all the marketing stuff gets
done for them, essentially.

**Host:** All right. And finally, what other software are you using? What are you using to keep track of your
clients' results in LLM answers and other tools?

**Josh:** That's saved in Notion.

**Host:** Because you have Claude go and ask ChatGPT a question and then save the answer in Notion, to see where
they're showing?

**Josh:** Essentially, yeah. Notion is just the database, plus some files, and GitHub for saving it.

**Host:** You personally, or your agent, is going in and asking the questions on behalf of your client's users, and
then storing where the answers are, and then watching if it rises up.

**Josh:** Correct.

**Host:** But then don't you need to have it on different IP addresses or different users or anything like that?
Isn't that why people use those third-party tools?

**Josh:** Yeah. Yeah. So, there's a little bit of secret sauce there on pulling that off. But at the end of the day,
yes, you're correct on what you're saying, but I am also pulling it off.

**Host:** But you're building your own version of it. I cannot believe you're using Notion as a database for AEO.
That's unreal.

**Josh:** Yeah.

**Host:** That makes me feel so much better about my Notion database usage. I just store everything in there.

**Josh:** People have a tendency to want to overcomplicate things, and at the end of the day, building something that
solves a problem... it kind of doesn't matter what the tools are, certainly at this stage. It'll get cleaner as we
go, but right now it's fine being a little bit messy.

**Host:** Really impressive. All right. I love that you have the .com, firstindex.com, by the way.

*[Sponsor segment]*

**Host:** When you talked about how AI is a prediction machine and at some point you need to shift to code: I don't
write my own code for things like this, but I come across these problems all the time. My solution is to use my
sponsor. If you're listening to this, you should see the video that I did with Wade, the founder of Zapier, where he
said, "Listen, I recognize that this is an issue. Things end up going to LLMs that really should be set in code. Most
people don't want to write their own code. That's what the next-gen Zaps from Zapier will do." He has examples of it.
I've got a link to next-gen Zaps from Zapier if you want Zapier to handle the code for you.

In fact, Josh, I have a whole Grockbot whose whole mission is, every day, look at what all the other bots are doing
and then see if any of it should be turned into code, and then put it on Zapier so that I don't pay money to Grock
anymore. I just published how much I spend every month on software, and people said, "Why do you have all these lines
for Cursor?" It's because my agents keep running out of tokens. So my solution is to move more of it into code. And
if you want that, that video is right here up on the screen. And I'll see you in that video next.

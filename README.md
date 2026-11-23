# Vantage

Run 1:1s people look forward to.

Vantage is a manager's workspace for 1:1s. Add the people who report to you, answer a few questions about each, and Vantage sets up a cadence, a shared agenda and a running record for every person: what each of you committed to, their goals, the blockers that keep coming back, the feedback you gave, where they want to go, how their workload is holding up and why they stay.

Everything lives in your browser. There is no account, no server and no network call.

**Live demo:** https://kevindargas.github.io/vantage/

The demo is the full app. It opens with a sample team, and anything you add stays in your own browser.

## What it does

**Before the 1:1**

- A morning brief for the day's conversations: commitments carried over, what changed on the record since last time and two or three questions worth asking.
- A shared agenda where the direct report's items come first, with a ready-made note asking for their top item a day ahead.
- Nudges drawn from the record: an overdue 1:1, a commitment of yours that slipped, a blocker raised three times, a career conversation that is due, a stay interview six months after the review, a workload check-in.

**During the 1:1**

- A live view built around the 30-minute runbook: connection, their agenda, your context, commitment lock.
- Shared notes next to a private scratchpad that collapses for screen sharing.
- A voluntary 1 to 5 pulse for energy and workload.
- An off-the-record switch either of you can ask for.

**After the 1:1**

- A commitment recap with owners and dates. Anything left open carries forward until it is done or dropped.
- Optional transcript analysis, with consent from both people: paste a transcript and Vantage measures how the conversation was shared, then proposes commitments, blockers, recognition and career signals as drafts. Nothing enters the record until you accept it.
- A shared summary that reads the same for both of you, ready to copy.
- A private coaching card: share of the conversation, longest turn, open questions and one or two things to try next time.

**Across the team and over time**

- A profile per person with ten views, including a timeline and an "as of" date that shows the record as it stood on any past day.
- Commitments with follow-through for both sides. Yours is tracked as closely as theirs.
- Goals with a readiness level, so direction and support match the task.
- A feedback ledger in situation, behavior, impact and intent form.
- Review drafts built from dated evidence, with a check for vague wording. No ratings.
- Team insights: cadence health, follow-through, recurring friction, workload trends.
- Ask Vantage: questions across the whole team, answered from the record.
- A question bank for weekly 1:1s, onboarding, career, stay interviews, workload and performance conversations.
- A playbook with the cadence guide, ground rules, runbook and the frameworks behind them.

## What it will not do

- It does not record audio or join calls.
- It does not read tone, stress, mood or sentiment. Workload awareness comes only from pulses a person chooses to give and pressure they state in words.
- It does not rate, rank or score people.
- It does not offer transcript capture for performance, compensation, legal or similar conversations.
- It does not keep transcripts. Text you paste is deleted after a period you set (14 days by default) unless you place a hold.
- It does not send anything anywhere. Sharing means copying text or opening your own e-mail client.

## Getting started

Requires Node 20 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. A new workspace starts with a sample team of seven so every screen has something to show. To begin with your own team, choose "Start with my own team" on the Today page, or "Clear the workspace" in Settings, then add your first person.

## Your data

The workspace is one JSON document in the browser's local storage. That has consequences worth knowing:

- It is private to this browser profile on this device.
- Clearing site data deletes it. Export a backup from Settings from time to time.
- To move to another browser or machine, export there and import here.

## Hosting your own copy

Vantage builds to plain files, so any static host works. `pnpm build` writes the site to `out/`.

**GitHub Pages**

1. Fork or copy the repository.
2. In the repository settings, under Pages, set the source to "GitHub Actions".
3. Push to `main`. The Pages workflow builds the site with the repository name as the base path and publishes it.

The site appears at `https://<you>.github.io/<repository>/`.

To publish from your own machine instead, run `pnpm pages`. It pushes the build to a `gh-pages` branch; set the Pages source to "Deploy from a branch" and select it.

**Anywhere else**

Upload `out/`. If the site sits under a sub-path, set `NEXT_PUBLIC_BASE_PATH` (for example `/vantage`) before building.

Each visitor gets a separate workspace in their own browser. Nothing is shared between visitors and nothing reaches the host.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Static build into `out/` |
| `pnpm pages` | Build and publish to GitHub Pages by hand |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit and component tests |
| `pnpm format` | Prettier |

## How it is built

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, TanStack Table, Recharts, Vitest.

```
app/(app)/<route>/     thin pages: metadata, header, one client view
features/<area>/       one folder per area of the app
features/shared/       person chip, dialogs used by several areas
components/            design system: ui, shared, charts, data-table, layout
lib/types.ts           the domain model
lib/constants.ts       thresholds, labels, playbook content
lib/vantage/           store, selectors and the engines
config/                site name and navigation
docs/development/      contributor conventions
```

The engines in `lib/vantage/` are plain functions over the workspace and are covered by tests:

| Module | Purpose |
| --- | --- |
| `store.ts` | The workspace store and every action that changes it |
| `cadence.ts` | Recommended cadence, next occurrence, cadence health |
| `nudges.ts` | What needs attention, with the questions that fit |
| `brief.ts` | The morning brief and the shared summary |
| `transcript.ts` | Transcript parsing, conversation shape, draft extraction, coaching |
| `review.ts` | Review evidence, draft and wording check |
| `ask.ts` | The cross-team query engine |
| `selectors.ts` | Read helpers, the timeline and point-in-time snapshots |

Transcript analysis and Ask Vantage are rule-based and run on the device. They count words, turns and questions and match phrases; they are not language models. Read [the conventions](docs/development/conventions.md) before contributing.

## License

MIT

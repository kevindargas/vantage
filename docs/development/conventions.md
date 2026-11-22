# Contributor conventions

Read this before your first change. Run `pnpm typecheck && pnpm lint && pnpm test` before you hand anything off.

## What the product is

Vantage is a manager's workspace for 1:1s. One manager, one browser: the whole workspace is a single JSON document in `localStorage`. There is no server, no account and no network call. A manager adds direct reports, runs 1:1s with them and keeps a running record per person under seven pillars: commitments, goals, blockers, feedback, career, workload and retention.

Three ideas shape every screen:

- **The record is bi-temporal.** A change closes the old fact (`validTo`) and adds a new one. Nothing is overwritten, so "what was true in June" stays answerable. Status changes append to `history`.
- **A human confirms every record.** Anything pulled from a transcript is a draft until the manager accepts it. Vantage never produces a rating, a ranking or a score for a person.
- **No emotion inference.** Workload awareness comes only from voluntary 1 to 5 pulses and pressure a person states in words. Nothing reads tone, stress or sentiment, and no copy may suggest that it does.

## Layout of the code

| Path | What lives there |
| --- | --- |
| `lib/types.ts` | The domain model. Start here. |
| `lib/constants.ts` | Thresholds, labels for every enum, cadence profiles, runbook phases, ground rules, frameworks, trust guarantees. |
| `lib/time.ts` | The only place the clock is read: `now()`, `today()`, `addDays`, `daysBetween`, `daysSince`, `daysUntil`, `atTime`, `timeOf`, `dayOf`, `quarterOf`, `quarterRange`, `inRange`. |
| `lib/format.ts` | The only formatters: `formatDay`, `formatDayLong`, `formatRelativeDay`, `formatTime`, `formatDateTime`, `formatWhen`, `dayDistance`, `timeAgo`, `formatMinutes`, `formatSeconds`, `formatTenure`, `formatPercent`, `formatDelta`, `initials`, `firstName`, `plural`. |
| `lib/vantage/store.ts` | `workspace` (read) and `actions` (write). The only way data changes. |
| `lib/vantage/selectors.ts` | Read helpers: people, meetings, commitments, follow-through, pulses, `snapshotAsOf`, `timelineFor`. |
| `lib/vantage/cadence.ts` | `recommendCadence`, `nextOccurrenceAt`, `cadenceHealth`, `cadenceStateLabels`. |
| `lib/vantage/nudges.ts` | `buildNudges(ws)`: what needs the manager's attention, with questions and a link. |
| `lib/vantage/brief.ts` | `briefDay`, `buildBrief`, `suggestQuestions`, `prepRequestText`, `sharedSummaryText`. |
| `lib/vantage/transcript.ts` | `parseTranscript`, `talkStats`, `extractDrafts`, `buildSummary`, `coachingFor`, `isSensitive`, `sampleTranscript`. |
| `lib/vantage/review.ts` | `buildReviewEvidence`, `reviewMarkdown`, `flagWording`. |
| `lib/vantage/ask.ts` | `ask(ws, query)`, `askExamples`. A rule-based query engine, not a language model. |
| `lib/vantage/question-bank.ts` | Built-in questions, `questionsFor`, `getQuestion`, `scenariosForMeetingType`. |
| `lib/vantage/sample.ts` | The sample team a new workspace starts with. |
| `features/shared/` | `PersonChip`, `PersonSelect`, `PulseScale`, `CommitmentDialog`, `GoalDialog`, `ScheduleMeetingDialog`, `FeedbackComposer`. |
| `features/<area>/` | One folder per nav area. Client components. |
| `app/(app)/<route>/` | Thin server pages: metadata, `PageHeader`, one client view. |
| `components/` | The design system: `ui/` (shadcn on Base UI), `shared/`, `charts/`, `data-table/`, `record/`, `layout/`. |

## Reading and writing data

```tsx
"use client"
import { actions, workspace } from "@/lib/vantage/store"
import { openCommitments } from "@/lib/vantage/selectors"

export function Example({ personId }: { personId: string }) {
  const ws = workspace.use()                    // re-renders on every change
  const open = openCommitments(ws, personId)    // selectors take the workspace
  return <button onClick={() => actions.setCommitmentStatus(open[0].id, "done")} />
}
```

- Components read with `workspace.use()` and pass the result to selectors. Never cache a slice in `useState`.
- Components write only through `actions`. Use the dedicated action when one exists (`setGoalStatus`, `logBlockerOccurrence`, `setAspiration`, `completeMeeting` and so on) because it maintains history, validity ranges and side effects. `actions.update(key, id, patch)` and `actions.remove(key, id)` are for plain field edits and deletes.
- Stat cards, tables, tab counts and sheets on a page all read the same `workspace.use()`, so one action moves every number.
- The app frame holds a skeleton until the workspace has been read from storage, so pages never see the empty server snapshot. You do not need hydration guards in pages. Do not read `localStorage` yourself.
- Derived values are computed during render (wrap in `React.useMemo` when the work is heavy). Never mirror workspace state into component state.

## Time

- Day fields (`startDate`, `dueDate`, `validFrom`, `date`) are local `YYYY-MM-DD` strings. Instant fields (`scheduledAt`, `createdAt`, `recordedAt`) are ISO strings. The field name tells you which.
- Read the clock only through `lib/time.ts`. Never call `new Date()` or `Date.now()` in a component or a data module. Tests pin the clock with `freezeClock`.
- Format only through `lib/format.ts`. Do not add per-feature formatters.

## Page anatomy

Every page follows the same skeleton so the eye lands in the same place on every route.

- **Route file**: a server component that exports `metadata = { title }` matching the nav title, renders `<PageHeader nav="/route" description=... />` and one client view. Pages with `useSearchParams` or `useQueryParam` in the view wrap it in `<Suspense>`.
- **Header**: `PageHeader nav=` resolves eyebrow, icon and title from `config/nav.ts`. Header actions that need client state live in the client view, which may render its own `PageHeader`; in that case the route file renders only the view.
- **KPI row**: `<StatGrid columns={N}>` with `StatCard` children and no icons. Every number is computed from the workspace. Never type a literal figure or a fake delta.
- **Inline metrics**: `MetricTile` inside cards, sheets and sidebars.
- **Labels and counts**: `Eyebrow` for small uppercase labels, `CountPill` for counts. Do not hand-roll them.
- **Sections**: `Section` from `components/shared/page-header.tsx`, or `Card` with `CardHeader`, `CardTitle`, `CardContent`.
- **Sheets**: `SheetContent className={cn(sheetWidths.detail | sheetWidths.editor, "flex flex-col gap-0 p-0")}`, then `SheetHeader className="border-b px-6 py-5"`, `SheetBody`, `SheetFooterActions`. All from `components/shared/sheet-frame.tsx`.
- **Dialogs**: short forms use `Dialog`; longer forms use a `Sheet`.
- **Empty states**: `EmptyState` with a title, one sentence and an action. Every list and chart has one, because a workspace can be empty.
- **Record pages** (`/people/[id]`, `/meetings/[id]`): the route awaits `params` and passes the id to a client view. The view looks the record up in the workspace and renders `RecordNotFound` when it is missing. There is no `generateStaticParams`, because ids are created in the browser.
- **Tables**: `DataTable` from `components/data-table` with `createColumnHelper<DataTableFeatures, T>()`, `sortFn` (not `sortingFn`), `facets`, `getSearchText` and `rowHref`. For short lists a plain list of rows inside a `Card` reads better than a table.

## Routing and deep links

- `params` and `searchParams` are Promises. `await` them in server components.
- UI state in the URL goes through `useQueryParam` / `setQueryParam` in `hooks/use-query-param.ts` (it writes with `history.replaceState`, so there is no server round trip). The caller sits inside `<Suspense>`.
- **Every link must target a param that is read.** The contract:

| Param | Read by | Meaning |
| --- | --- | --- |
| `?new=1` | People, 1:1s, Commitments, Feedback, Goals | Open the create form |
| `?person=` | 1:1s, Commitments, Feedback, Goals, Reviews, Coaching | Scope to one person, or preselect them in a create form |
| `?type=` | 1:1s (with `?new=1`) | Preselect the conversation type |
| `?owner=` | Commitments | `manager` or `report` |
| `?entry=` | Feedback | Open one feedback entry |
| `?tab=` | Person profile, 1:1 record, Trust, Question Bank | Active tab |
| `?asof=` | Person profile | Show the record as of a day |
| `?q=` | Ask Vantage | Run a question |
| `?scenario=` | Question Bank | Filter to one scenario |
| `?view=` | 1:1s | `upcoming`, `past` or `week` |

Person profile tabs are `overview`, `meetings`, `commitments`, `goals`, `blockers`, `feedback`, `career`, `wellbeing`, `retention`, `timeline`. Links from nudges and from Ask Vantage use those names.

## Stack rules

- Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui on **Base UI**, not Radix. Compose with the `render` prop; there is no `asChild`.
- `cn` comes from the `cn` package.
- Icons are Lucide. Charts are Recharts 3 through the wrappers in `components/charts/`. Toasts are Sonner.
- **Select**: `SelectValue` renders the raw value unless the `Select` root gets `items` (`{ value, label }[]`). Always pass `items` when values differ from labels.
- **Checkbox**: use the `indeterminate` boolean prop.
- **Menu labels**: `DropdownMenuLabel` and `SelectLabel` must sit inside a `*Group`.
- **ToggleGroup**: `value` is an array and `onValueChange` receives an array.
- `react-hooks/set-state-in-effect` is on. Derive state during render or update it in event handlers.
- Server components must not import functions from a `"use client"` module. Keep constants a page and a view both need in a plain module.
- The full `jsx-a11y` recommended set is on. Label every control.

## Tokens and colour

- Status strings map to tones through `stateTone` in `components/shared/status-badge.tsx`. Render states with `<StateBadge state="At risk" />` and add new strings to that map rather than colouring in pages. Unknown states fall back to neutral.
- Use `toneClasses`, `StateBadge`, `StatusDot` and semantic tokens. **Never hard-code palette classes** such as `text-red-500` or `bg-green-100`.
- As text colour use `text-danger-text`, `text-warning-text`, `text-success-text`, `text-info-text`. On solid fills use the matching `*-foreground` token, never `text-white`.
- Charts use `var(--chart-1)` to `var(--chart-8)`. No dual axes. A legend whenever there are two or more series. Heights from `CHART_HEIGHT`.
- `text-2xs` and `text-3xs` replace arbitrary small sizes.

## Truthful UI

- A toast describes something that happened in the workspace. Nothing may claim an e-mail, a calendar invite, a recording or a sync, because none of those exist. Sharing is done by copying text to the clipboard or opening a `mailto:` link, and the copy says so.
- Destructive actions get an `AlertDialog` that spells out the consequence: remove a person, delete a record, clear the workspace, load sample data over real data, purge transcripts.
- If a button shows a keyboard hint, the handler exists. Page-level key handlers call `event.preventDefault()` on the keys they consume; the global ones (`C`, `D`, `G` chords) are in `components/layout/command-menu.tsx`.

## Privacy rules in the UI

- **Private and shared are visibly different.** Shared notes, the agenda, the summary and commitments are what both people see. Private notes, rapport notes and coaching cards are the manager's alone: mark them with a `Private` badge and never include them in `sharedSummaryText`, a copied summary or a review draft.
- **Capture needs consent from both people.** `actions.attachTranscript` refuses otherwise. The consent gate records an entry in the consent log either way.
- **Sensitive conversations stay manual.** `isSensitive(type, text, keywords)` decides; when it is true the transcript panel is replaced by guidance to take notes by hand.
- **Transcripts are short lived.** They carry an `expiresOn` day and are purged on load unless legal hold is on. Show the countdown wherever a transcript is shown.
- **Works council mode** (`settings.worksCouncilMode`) hides per-person comparisons in Insights and Coaching and shows team aggregates only.

## Copy

- No em or en dashes anywhere: copy, comments or docs. Use a colon, a comma or a full stop. No emoji.
- Plain words. Avoid "comprehensive", "robust", "seamless", "leverage", "delve", "empower", "unlock", "elevate".
- Never mention how code or docs were produced.
- Address the manager as "you". Refer to the direct report by first name or as "they".
- Copy that quotes a threshold interpolates the constant from `lib/constants.ts`.
- The sample manager is Kevin Dargas. Sample e-mail addresses use `example.com`.

## Formatting

Prettier at the repo's 80-column configuration with the Tailwind plugin is the source of truth. Run `pnpm format` on files you touch. Double quotes, no semicolons, trailing commas where ES5 allows.

## Tests

Vitest and Testing Library in jsdom. `next/navigation` is mocked in `test/setup.ts`. Put tests next to the code as `*.test.ts(x)`. Engine behaviour is covered in `lib/vantage/engine.test.ts`: pin the clock with `freezeClock` and reset the store with `workspace.__reset()`.

## Before you finish

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Then load the routes you touched against `pnpm dev` and check the dev log for lines starting with the cross mark. Static checks do not cover the server and client component boundary.

"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  CheckIcon,
  GraduationCapIcon,
  RepeatIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { cn } from "cn"

import { ChartCard } from "@/components/charts/chart-card"
import { ChartEmpty } from "@/components/charts/chart-primitives"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PersonChip, PersonSelect } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import {
  MONOLOGUE_LIMIT_SEC,
  OPEN_QUESTION_TARGET,
  TALK_SHARE_MAX,
  TALK_SHARE_MIN,
} from "@/lib/constants"
import {
  firstName,
  formatDay,
  formatPercent,
  formatSeconds,
  plural,
} from "@/lib/format"
import type { CoachingCard } from "@/lib/types"
import { getPerson } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"

import {
  buildCoaching,
  HABIT_WINDOW,
  shareBand,
  type Habit,
  type PersonHabits,
  type ShareBand,
} from "./coaching-data"
import { TalkShareChart, type TalkSharePoint } from "./talk-share-chart"

const CARDS_SHOWN = 6

const bandBadge: Record<
  ShareBand,
  { label: string; tone: "success" | "warning" | "info" }
> = {
  below: { label: "Below range", tone: "warning" },
  inside: { label: "In range", tone: "success" },
  above: { label: "Above range", tone: "info" },
}

export function CoachingView() {
  const ws = workspace.use()
  const [personParam, setPersonParam] = useQueryParam("person")
  const [showAll, setShowAll] = React.useState(false)
  const data = React.useMemo(() => buildCoaching(ws), [ws])
  const aggregateOnly = ws.settings.worksCouncilMode
  const personId =
    !aggregateOnly && personParam && getPerson(ws, personParam)
      ? personParam
      : null

  const header = (
    <PageHeader
      nav="/coaching"
      meta={<StateBadge state="Private" />}
      description="Only you see this page. Nothing here is shared with your reports or anyone else."
    />
  )

  if (data.analyzed.length === 0 && data.cards.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<GraduationCapIcon />}
          title="No coaching yet"
          description="Coaching appears after a conversation is analyzed from a transcript, with consent from both of you."
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/trust" />}
            >
              <ShieldCheckIcon data-icon="inline-start" />
              How consent and transcripts work
            </Button>
          }
        />
      </div>
    )
  }

  const { averages } = data
  const points: TalkSharePoint[] = [...data.analyzed]
    .reverse()
    .filter((m) => !personId || m.personId === personId)
    .map((m) => ({
      id: m.id,
      dateLabel: formatDay(m.scheduledAt),
      personName: getPerson(ws, m.personId)?.name ?? "Removed person",
      share: m.stats.reportShare,
    }))
  const filteredName = personId
    ? firstName(getPerson(ws, personId)?.name ?? "")
    : null
  const cards = showAll ? data.cards : data.cards.slice(0, CARDS_SHOWN)

  return (
    <div className="flex flex-col gap-8">
      {header}

      {aggregateOnly && (
        <div
          role="note"
          data-testid="works-council-note"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3"
        >
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Works council mode is on.
            </span>{" "}
            The comparison by person and the person filter are hidden. Your
            habits are shown across all conversations together.
          </p>
        </div>
      )}

      <StatGrid columns={5}>
        <StatCard
          label="Their share of the talking"
          value={averages ? formatPercent(averages.share) : "n/a"}
          hint={`Target ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%`}
        />
        <StatCard
          label="Conversations in range"
          value={averages ? formatPercent(averages.insideBandShare) : "n/a"}
          hint={
            averages
              ? `${averages.insideBand} of ${data.analyzed.length}`
              : "No conversations analyzed"
          }
        />
        <StatCard
          label="Your longest turn, average"
          value={averages ? formatSeconds(averages.longestTurnSec) : "n/a"}
          hint={`Target under ${MONOLOGUE_LIMIT_SEC}s`}
        />
        <StatCard
          label="Open questions, average"
          value={averages ? averages.openQuestions.toFixed(1) : "n/a"}
          hint={`Target ${OPEN_QUESTION_TARGET} or more`}
        />
        <StatCard
          label="Conversations analyzed"
          value={data.analyzed.length}
          hint={`${plural(data.cards.length, "coaching card")} saved`}
        />
      </StatGrid>

      <ChartCard
        title={
          filteredName
            ? `${filteredName}'s share of each conversation`
            : "Your reports' share of each conversation"
        }
        description={`Oldest to newest. The shaded range is the ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}% target.`}
        action={
          aggregateOnly ? undefined : (
            <PersonSelect
              value={personId ?? "all"}
              onChange={(next) => setPersonParam(next === "all" ? null : next)}
              allLabel="Everyone"
              className="min-w-40"
            />
          )
        }
      >
        {points.length === 0 ? (
          <ChartEmpty
            title="No analyzed conversations"
            description={
              filteredName
                ? `None of your 1:1s with ${filteredName} has been analyzed from a transcript.`
                : "Talk share appears after a conversation is analyzed from a transcript."
            }
          />
        ) : (
          <div data-testid="talk-share-chart">
            <TalkShareChart points={points} />
          </div>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {!aggregateOnly && (
          <ChartCard
            title="Who gets the floor"
            description="Average per person, least floor first. The marker shows their share against the target range."
          >
            {data.byPerson.length === 0 ? (
              <ChartEmpty title="No analyzed conversations" />
            ) : (
              <ul className="flex flex-col divide-y" data-testid="by-person">
                {data.byPerson.map((row) => (
                  <PersonRow key={row.person.id} row={row} />
                ))}
              </ul>
            )}
          </ChartCard>
        )}
        <ChartCard
          title="Habit scorecard"
          description={`Share of your last ${HABIT_WINDOW} analyzed conversations where each habit held.`}
          className={aggregateOnly ? "xl:col-span-2" : undefined}
        >
          <ul className="flex flex-col gap-4" data-testid="habits">
            {data.habits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
          </ul>
        </ChartCard>
      </div>

      <Section
        id="cards"
        title="Recent coaching cards"
        description="One card per analyzed conversation, newest first."
        count={data.cards.length || undefined}
      >
        {data.theme && (
          <Card size="sm" className="bg-muted/30" data-testid="theme">
            <CardContent className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border/70">
                <RepeatIcon className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <Eyebrow>Your recurring theme</Eyebrow>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {data.theme.title}
                  <Badge variant="outline">{data.theme.framework}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Came up in {data.theme.count} of your last{" "}
                  {plural(data.theme.outOf, "card")}.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {data.cards.length === 0 ? (
          <EmptyState
            size="sm"
            title="No cards saved"
            description="A card is saved when you wrap up a conversation that was analyzed from a transcript."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {cards.map((card) => (
                <CoachingCardView key={card.id} card={card} />
              ))}
            </div>
            {data.cards.length > CARDS_SHOWN && (
              <Button
                variant="outline"
                size="sm"
                className="self-center"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show fewer" : `Show all ${data.cards.length} cards`}
              </Button>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

/* ----------------------------------------------------------------- by person */

function BandMeter({ share, label }: { share: number; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative h-2 w-full rounded-full bg-muted"
    >
      <span
        className="absolute inset-y-0 rounded-full bg-foreground/15"
        style={{
          left: `${TALK_SHARE_MIN}%`,
          width: `${TALK_SHARE_MAX - TALK_SHARE_MIN}%`,
        }}
      />
      <span
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
        style={{ left: `${Math.min(100, Math.max(0, share))}%` }}
      />
    </div>
  )
}

function PersonRow({ row }: { row: PersonHabits }) {
  const band = bandBadge[shareBand(row.share)]
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PersonChip personId={row.person.id} size="sm" />
        <div className="flex items-center gap-2">
          <StateBadge state={band.label} tone={band.tone} size="sm" />
          <span className="text-sm font-semibold tabular-nums">
            {formatPercent(row.share)}
          </span>
        </div>
      </div>
      <BandMeter
        share={row.share}
        label={`${row.person.name} spoke ${row.share}% on average. Target ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%.`}
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        Your longest turn {formatSeconds(row.longestTurnSec)},{" "}
        {row.openQuestions.toFixed(1)} open questions, across{" "}
        {plural(row.conversations, "conversation")}
      </p>
    </li>
  )
}

/* ------------------------------------------------------------------- habits */

function HabitRow({ habit }: { habit: Habit }) {
  const pct = habit.total ? Math.round((habit.held / habit.total) * 100) : null
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {habit.label}
          <Badge variant="outline">{habit.framework}</Badge>
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {pct === null ? "n/a" : formatPercent(pct)}
        </span>
      </div>
      <div
        role="img"
        aria-label={
          pct === null
            ? `${habit.label}: no conversations yet`
            : `${habit.label}: held in ${habit.held} of ${habit.total} conversations`
        }
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-chart-1"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {habit.detail}{" "}
        {habit.total > 0 &&
          `Held in ${habit.held} of ${plural(habit.total, "conversation")}.`}
      </p>
    </li>
  )
}

/* -------------------------------------------------------------------- cards */

function CoachingCardView({ card }: { card: CoachingCard }) {
  return (
    <Card size="sm" data-testid="coaching-card">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <PersonChip personId={card.personId} size="sm" />
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {formatDay(card.createdAt)}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={`/meetings/${card.meetingId}`} />}
          >
            Open 1:1
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          They spoke {formatPercent(card.stats.reportShare)}, your longest turn{" "}
          {formatSeconds(card.stats.longestManagerMonologueSec)},{" "}
          {plural(card.stats.openQuestions, "open question")}
        </p>
        {card.nudges.length > 0 && (
          <div className="flex flex-col gap-2">
            <Eyebrow as="h3">To try next time</Eyebrow>
            <ul className="flex flex-col gap-2.5">
              {card.nudges.map((nudge) => (
                <li key={nudge.title} className="border-l-2 border-border pl-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {nudge.title}
                    <Badge variant="outline">{nudge.framework}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {nudge.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.strengths.length > 0 && (
          <div className="flex flex-col gap-2">
            <Eyebrow as="h3">What went well</Eyebrow>
            <ul className="flex flex-col gap-1">
              {card.strengths.map((strength) => (
                <li key={strength} className="flex items-start gap-2 text-sm">
                  <CheckIcon
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-success-text"
                  />
                  <span className="leading-snug">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.reflection?.trim() && (
          <div className={cn("rounded-lg border bg-muted/30 px-3 py-2")}>
            <Eyebrow as="h3">Your reflection</Eyebrow>
            <p className="mt-1 text-sm leading-relaxed">{card.reflection}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

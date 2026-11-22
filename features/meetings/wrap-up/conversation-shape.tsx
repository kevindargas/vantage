import { MetricTile } from "@/components/shared/metric-tile"
import { MONOLOGUE_LIMIT_SEC, OPEN_QUESTION_TARGET } from "@/lib/constants"
import { formatMinutes, formatNumber, formatSeconds } from "@/lib/format"
import type { TalkStats } from "@/lib/types"
import { monologueOver, openQuestionsShort, totalQuestions } from "./analysis"
import { TalkShareMeter } from "./talk-share-meter"

/** The longest-turn and open-question tiles, each with its target. */
export function ShapeTargetTiles({ stats }: { stats: TalkStats }) {
  return (
    <>
      <MetricTile
        label="Your longest turn"
        value={formatSeconds(stats.longestManagerMonologueSec)}
        tone={monologueOver(stats) ? "warning" : undefined}
        hint={`${monologueOver(stats) ? "Over" : "Within"} the ${formatSeconds(MONOLOGUE_LIMIT_SEC)} limit`}
      />
      <MetricTile
        label="Open questions"
        value={stats.openQuestions}
        unit={`of ${totalQuestions(stats)}`}
        tone={openQuestionsShort(stats) ? "warning" : undefined}
        hint={`Aim for ${OPEN_QUESTION_TARGET} or more`}
      />
    </>
  )
}

/**
 * Who spoke how much, how long and what kind of questions. Reads only the
 * counts kept on the meeting, which outlive the transcript text.
 */
export function ConversationShape({
  stats,
  name,
}: {
  stats: TalkStats
  name: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <TalkShareMeter share={stats.reportShare} name={name} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ShapeTargetTiles stats={stats} />
        <MetricTile
          label="Words"
          value={formatNumber(stats.managerWords + stats.reportWords)}
          hint={`You ${formatNumber(stats.managerWords)}, ${name} ${formatNumber(stats.reportWords)}`}
        />
        <MetricTile
          label="Length"
          value={formatMinutes(stats.estimatedMinutes)}
          hint={`Estimated, ${stats.turns} turns`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        These are counts of words, turns and questions. Nothing here describes
        how either of you felt.
      </p>
    </div>
  )
}

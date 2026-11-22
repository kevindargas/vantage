import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { addDays, atTime, dayOf, freezeClock, today } from "@/lib/time"
import type { Workspace } from "@/lib/types"
import { ask, parseRange } from "./ask"
import { briefDay, buildBrief, sharedSummaryText } from "./brief"
import { cadenceHealth, nextOccurrence, recommendCadence } from "./cadence"
import { buildNudges } from "./nudges"
import { buildReviewEvidence, flagWording, reviewMarkdown } from "./review"
import { buildSampleWorkspace } from "./sample"
import {
  carryCount,
  currentAspiration,
  followThrough,
  snapshotAsOf,
  timelineFor,
} from "./selectors"
import {
  actions,
  emptyWorkspace,
  normalizeWorkspace,
  purgeExpired,
  workspace,
} from "./store"
import {
  coachingFor,
  extractDrafts,
  isSensitive,
  parseDueDate,
  parseTranscript,
  sampleTranscript,
  talkStats,
} from "./transcript"

// A Wednesday, so "today" has working days on both sides.
beforeAll(() => freezeClock("2026-11-18T12:00:00"))
afterAll(() => freezeClock(null))

describe("sample workspace", () => {
  let ws: Workspace
  beforeEach(() => {
    ws = buildSampleWorkspace()
  })

  it("is deterministic for a given day", () => {
    expect(JSON.stringify(buildSampleWorkspace())).toBe(JSON.stringify(ws))
  })

  it("has unique ids and no orphaned records", () => {
    const people = new Set(ws.people.map((p) => p.id))
    const meetings = new Set(ws.meetings.map((m) => m.id))
    const lists = [
      ws.meetings,
      ws.commitments,
      ws.goals,
      ws.blockers,
      ws.feedback,
      ws.aspirations,
      ws.milestones,
      ws.pulses,
      ws.workloadMarkers,
      ws.stayDrivers,
      ws.coachingCards,
      ws.consentLog,
    ]
    const ids = lists.flat().map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const row of lists.flat()) expect(people.has(row.personId)).toBe(true)
    for (const c of ws.commitments)
      if (c.sourceMeetingId) expect(meetings.has(c.sourceMeetingId)).toBe(true)
    for (const c of ws.coachingCards)
      expect(meetings.has(c.meetingId)).toBe(true)
  })

  it("never stores talk statistics or consent for performance conversations", () => {
    for (const m of ws.meetings.filter((m) => m.type === "performance")) {
      expect(m.stats).toBeUndefined()
      expect(m.transcript).toBeUndefined()
    }
  })

  it("only holds statistics where both people consented", () => {
    for (const m of ws.meetings.filter((m) => m.stats))
      expect(m.consent?.manager && m.consent.report).toBe(true)
  })

  it("puts 1:1s on the brief day", () => {
    const brief = briefDay(ws)
    expect(brief.isToday).toBe(true)
    expect(brief.meetings.length).toBeGreaterThanOrEqual(3)
    const maya = brief.meetings.find((m) => m.personId === "p-maya")!
    const detail = buildBrief(ws, maya)!
    expect(detail.carried.length).toBeGreaterThan(0)
    expect(detail.questions.length).toBeGreaterThan(0)
    expect(detail.hasReportAgenda).toBe(true)
  })

  it("raises the nudges the stories call for", () => {
    const nudges = buildNudges(ws)
    const has = (kind: string, personId: string) =>
      nudges.some((n) => n.kind === kind && n.personId === personId)
    expect(has("overdue-1on1", "p-kenji")).toBe(true)
    expect(has("recurring-blocker", "p-maya")).toBe(true)
    expect(has("workload", "p-priya")).toBe(true)
    expect(has("stay-interview", "p-amara")).toBe(true)
    expect(has("career-gap", "p-kenji")).toBe(true)
    expect(has("manager-commitment", "p-maya")).toBe(true)
    expect(has("feedback-window", "p-sofia")).toBe(true)
    // Performance support suppresses career and stay prompts.
    expect(has("career-gap", "p-tom")).toBe(false)
    expect(has("stay-interview", "p-tom")).toBe(false)
  })

  it("drops a dismissed nudge and keeps the rest", () => {
    const all = buildNudges(ws)
    const next = {
      ...ws,
      settings: { ...ws.settings, dismissedNudges: [all[0].id] },
    }
    expect(buildNudges(next)).toHaveLength(all.length - 1)
  })

  it("keeps the earlier aspiration when the direction changed", () => {
    const now = currentAspiration(ws, "p-maya")!
    expect(now.track).toBe("ic")
    const before = snapshotAsOf(ws, "p-maya", addDays(today(), -200))
    expect(before.aspiration?.track).toBe("management")
  })

  it("answers point-in-time questions about blockers", () => {
    const then = snapshotAsOf(ws, "p-maya", addDays(today(), -60))
    expect(then.blockers.map((b) => b.title)).toContain(
      "Flaky integration tests in CI"
    )
    const now = snapshotAsOf(ws, "p-maya", today())
    expect(now.blockers.map((b) => b.title)).not.toContain(
      "Flaky integration tests in CI"
    )
    expect(
      now.blockers.find((b) => b.category === "cross-team")?.countThen
    ).toBe(3)
  })

  it("builds a timeline newest first", () => {
    const events = timelineFor(ws, "p-maya")
    expect(events.length).toBeGreaterThan(20)
    const dates = events.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it("counts carries and follow-through", () => {
    const stuck = ws.commitments.find((c) => c.text.startsWith("Get an owner"))!
    expect(carryCount(ws, stuck)).toBe(1)
    const mine = followThrough(ws.commitments, "manager")
    expect(mine.missed).toBeGreaterThan(0)
    expect(mine.rate).toBeGreaterThan(0)
    expect(mine.rate).toBeLessThan(100)
  })

  it("reports cadence state per person", () => {
    const byId = (id: string) =>
      cadenceHealth(
        ws.people.find((p) => p.id === id)!,
        ws.meetings
      )
    expect(byId("p-kenji").state).toBe("overdue")
    expect(byId("p-maya").state).toBe("healthy")
    expect(byId("p-kenji").recentCancellations).toBe(2)
  })

  it("answers team questions from the record", () => {
    const deps = ask(
      ws,
      "List every cross-team dependency raised by my reports this month"
    )
    expect(deps.topic).toBe("Cross-team dependencies")
    expect(deps.rows.some((r) => r.personId === "p-maya")).toBe(true)
    const owe = ask(ws, "What do I owe people that is overdue?")
    expect(owe.rows.length).toBeGreaterThan(0)
    expect(owe.rows.every((r) => r.tone === "danger")).toBe(true)
    const load = ask(ws, "Who is carrying the heaviest workload?")
    expect(load.rows[0].personId).toBe("p-priya")
    const maya = ask(ws, "What blocked Maya this quarter?")
    expect(maya.interpretation).toContain("Person: Maya Chen")
    expect(maya.rows.every((r) => r.personId === "p-maya")).toBe(true)
    expect(ask(ws, "zzzz qqqq").rows).toHaveLength(0)
  })

  it("drafts review evidence with dates and no rating", () => {
    const evidence = buildReviewEvidence(
      ws,
      "p-maya",
      addDays(today(), -90),
      today()
    )!
    expect(evidence.recognition.length).toBeGreaterThan(0)
    const text = reviewMarkdown(evidence)
    expect(text).toContain("## Strengths, with evidence")
    expect(text).toMatch(/observed/)
    expect(flagWording(text).filter((f) => /rating/i.test(f.why))).toHaveLength(
      0
    )
  })

  it("leaves private notes out of the shared summary", () => {
    const meeting = {
      ...ws.meetings.find((m) => m.status === "completed")!,
      privateNotes: "SECRET-PRIVATE",
    }
    expect(sharedSummaryText(ws, meeting)).not.toContain("SECRET-PRIVATE")
  })
})

describe("cadence", () => {
  it("moves remote senior contributors to weekly", () => {
    expect(recommendCadence("senior-ic", "remote").frequency).toBe("weekly")
    expect(recommendCadence("senior-ic", "onsite").frequency).toBe("biweekly")
    expect(recommendCadence("new-hire", "hybrid").durationMin).toBe(45)
  })

  it("finds the next slot on the configured weekday", () => {
    const cadence = {
      frequency: "weekly" as const,
      durationMin: 30,
      weekday: 2,
      time: "10:00",
    }
    // 2026-11-18 is a Wednesday; the next Tuesday is the 24th.
    expect(nextOccurrence(cadence)).toBe("2026-11-24")
    expect(nextOccurrence({ ...cadence, weekday: 3 })).toBe("2026-11-18")
    expect(
      nextOccurrence({ ...cadence, frequency: "biweekly" }, "2026-11-17")
    ).toBe("2026-12-01")
  })
})

describe("transcript analysis", () => {
  const text = sampleTranscript("Kevin Dargas", "Maya Chen")
  const { turns } = parseTranscript(text, "Kevin Dargas", "Maya Chen")

  it("attributes turns to the two speakers", () => {
    expect(turns.length).toBe(18)
    expect(turns[0].speaker).toBe("manager")
    expect(turns[1].speaker).toBe("report")
  })

  it("measures talk share and open questions", () => {
    const stats = talkStats(turns)
    expect(stats.reportShare).toBeGreaterThan(40)
    expect(stats.reportShare).toBeLessThan(70)
    expect(stats.openQuestions).toBeGreaterThanOrEqual(3)
    expect(stats.managerWords + stats.reportWords).toBeGreaterThan(200)
  })

  it("drops everything said off the record", () => {
    const paused = parseTranscript(
      "Kevin: How are you?\n[paused]\nMaya: Something personal I'll share privately.\n[resumed]\nMaya: Back to the migration.",
      "Kevin Dargas",
      "Maya Chen"
    )
    expect(paused.droppedLines).toBe(1)
    expect(paused.turns.map((t) => t.text).join(" ")).not.toContain("personal")
  })

  it("drafts commitments, blockers, recognition, career and workload", () => {
    const drafts = extractDrafts(
      turns,
      [{ id: "b-1", title: "Platform team approval for pipeline changes" }],
      "2026-11-18"
    )
    const kinds = new Set(drafts.map((d) => d.kind))
    for (const kind of [
      "commitment",
      "blocker",
      "recognition",
      "career",
      "workload",
      "upward",
    ])
      expect(kinds.has(kind as never)).toBe(true)
    const blocker = drafts.find((d) => d.kind === "blocker")
    expect(blocker?.kind === "blocker" && blocker.matchesBlockerId).toBe("b-1")
    const mine = drafts.filter(
      (d) => d.kind === "commitment" && d.owner === "manager"
    )
    expect(mine.length).toBeGreaterThanOrEqual(2)
    const thursday = mine.find(
      (d) => d.kind === "commitment" && d.quote.includes("Thursday")
    )
    expect(thursday?.kind === "commitment" && thursday.dueDate).toBe(
      "2026-11-19"
    )
  })

  it("parses due dates", () => {
    expect(parseDueDate("I'll send it tomorrow", "2026-11-18")).toBe(
      "2026-11-19"
    )
    expect(parseDueDate("done by Friday", "2026-11-18")).toBe("2026-11-20")
    expect(parseDueDate("by end of week", "2026-11-18")).toBe("2026-11-20")
    expect(parseDueDate("by December 3", "2026-11-18")).toBe("2026-12-03")
    expect(parseDueDate("no date here", "2026-11-18")).toBeUndefined()
  })

  it("coaches toward listening when the manager dominates", () => {
    const lopsided = parseTranscript(
      `Kevin: ${"I think we should do this and then that. ".repeat(60)}\nMaya: Okay.`,
      "Kevin Dargas",
      "Maya Chen"
    )
    const stats = talkStats(lopsided.turns)
    const { nudges } = coachingFor(stats, [])
    expect(stats.reportShare).toBeLessThan(10)
    expect(nudges[0].title).toBe("Give them more of the floor")
    expect(nudges.length).toBeLessThanOrEqual(3)
  })

  it("blocks capture for sensitive conversations", () => {
    expect(isSensitive("performance", "", []).sensitive).toBe(true)
    expect(
      isSensitive("weekly", "Compensation review", ["Compensation"]).sensitive
    ).toBe(true)
    expect(isSensitive("weekly", "Shipping plan", ["PIP"]).sensitive).toBe(
      false
    )
  })
})

describe("workspace store", () => {
  beforeEach(() => workspace.__reset(emptyWorkspace({ name: "Kevin Dargas" })))

  function addPerson() {
    return actions.addPerson({
      name: "Lena Fischer",
      role: "Designer",
      startDate: addDays(today(), -400),
      workMode: "remote",
      profile: "established-ic",
      cadence: recommendCadence("established-ic", "remote"),
      recognitionPref: "private",
      aspiration: { statement: "Lead design for a product line", track: "ic" },
      energizers: ["Research with customers", " "],
      goals: [{ title: "Ship the new onboarding flow", readiness: "D3" }],
    })
  }

  it("sets a person up from the setup answers", () => {
    const id = addPerson()
    const ws = workspace.get()
    expect(ws.people).toHaveLength(1)
    expect(ws.aspirations[0].personId).toBe(id)
    expect(ws.stayDrivers).toHaveLength(1)
    expect(ws.goals[0].history).toHaveLength(1)
    expect(ws.meetings).toHaveLength(1)
    expect(ws.meetings[0].status).toBe("scheduled")
    expect(dayOf(ws.meetings[0].scheduledAt) >= today()).toBe(true)
  })

  it("schedules the next 1:1 when one is completed", () => {
    const id = addPerson()
    const first = workspace.get().meetings[0]
    const next = actions.completeMeeting(first.id)
    const ws = workspace.get()
    expect(next).toBeDefined()
    expect(ws.meetings).toHaveLength(2)
    expect(ws.meetings.find((m) => m.id === next)!.personId).toBe(id)
    expect(ws.meetings.find((m) => m.id === first.id)!.status).toBe("completed")
  })

  it("closes the old aspiration instead of overwriting it", () => {
    const id = addPerson()
    actions.setAspiration({
      personId: id,
      statement: "Move into management",
      track: "management",
    })
    const mine = workspace.get().aspirations
    expect(mine).toHaveLength(2)
    expect(mine.filter((a) => !a.validTo)).toHaveLength(1)
    expect(currentAspiration(workspace.get(), id)?.track).toBe("management")
  })

  it("tracks blocker recurrence and resolution", () => {
    const id = addPerson()
    const blocker = actions.addBlocker({
      personId: id,
      title: "Waiting on legal",
      category: "cross-team",
    })
    actions.logBlockerOccurrence(blocker)
    actions.logBlockerOccurrence(blocker)
    expect(workspace.get().blockers[0].occurrences).toHaveLength(3)
    expect(
      buildNudges(workspace.get()).some((n) => n.kind === "recurring-blocker")
    ).toBe(true)
    actions.setBlockerStatus(blocker, "resolved")
    expect(workspace.get().blockers[0].validTo).toBe(today())
    expect(
      buildNudges(workspace.get()).some((n) => n.kind === "recurring-blocker")
    ).toBe(false)
  })

  it("refuses a transcript without consent from both people", () => {
    const id = addPerson()
    const meeting = workspace.get().meetings[0]
    const text = sampleTranscript("Kevin Dargas", "Lena Fischer")
    expect(actions.attachTranscript(meeting.id, text)).toBe(false)
    actions.recordConsent(meeting.id, true, false)
    expect(actions.attachTranscript(meeting.id, text)).toBe(false)
    actions.recordConsent(meeting.id, true, true)
    expect(actions.attachTranscript(meeting.id, text)).toBe(true)
    const ws = workspace.get()
    expect(ws.consentLog.map((c) => c.outcome)).toEqual(["declined", "granted"])
    expect(ws.meetings[0].stats?.turns).toBe(18)
    expect(ws.meetings[0].transcript?.expiresOn).toBe(addDays(today(), 14))
    expect(id).toBeTruthy()
  })

  it("deletes transcripts on schedule unless a hold is on", () => {
    addPerson()
    const meeting = workspace.get().meetings[0]
    actions.recordConsent(meeting.id, true, true)
    actions.attachTranscript(
      meeting.id,
      "Kevin: Hello there, how are you?\nLena: Fine thanks."
    )
    const ws = workspace.get()
    const later = addDays(today(), 15)
    expect(purgeExpired(ws, later).meetings[0].transcript).toBeUndefined()
    expect(purgeExpired(ws, later).meetings[0].stats).toBeDefined()
    const held = { ...ws, settings: { ...ws.settings, legalHold: true } }
    expect(purgeExpired(held, later).meetings[0].transcript).toBeDefined()
  })

  it("replaces a same-day pulse and clamps the scale", () => {
    const id = addPerson()
    actions.logPulse({ personId: id, energy: 9, workload: 0 })
    actions.logPulse({ personId: id, energy: 2, workload: 4 })
    const pulses = workspace.get().pulses
    expect(pulses).toHaveLength(1)
    expect(pulses[0]).toMatchObject({ energy: 2, workload: 4 })
  })

  it("removes a person with everything attached", () => {
    const id = addPerson()
    actions.addCommitment({
      personId: id,
      owner: "manager",
      text: "Send the brief",
    })
    actions.removePerson(id)
    const ws = workspace.get()
    expect(ws.people).toHaveLength(0)
    expect(ws.meetings).toHaveLength(0)
    expect(ws.commitments).toHaveLength(0)
    expect(ws.goals).toHaveLength(0)
  })

  it("round-trips through export and import", () => {
    addPerson()
    const json = actions.exportWorkspace()
    workspace.__reset(emptyWorkspace())
    actions.importWorkspace(json)
    expect(workspace.get().people[0].name).toBe("Lena Fischer")
    expect(() => actions.importWorkspace('{"nope":true}')).toThrow()
    expect(normalizeWorkspace({ people: [] }).settings.transcriptTtlDays).toBe(
      14
    )
  })

  it("reschedules instead of cancelling and keeps the original time", () => {
    addPerson()
    const meeting = workspace.get().meetings[0]
    actions.cancelMeeting(meeting.id, "manager", "Clash")
    expect(workspace.get().meetings[0].status).toBe("cancelled")
    const moved = atTime(addDays(today(), 2), "09:00")
    actions.rescheduleMeeting(meeting.id, moved)
    const after = workspace.get().meetings[0]
    expect(after.status).toBe("scheduled")
    expect(after.rescheduledFrom).toBe(meeting.scheduledAt)
    expect(after.cancelReason).toBeUndefined()
  })
})

describe("ask", () => {
  it("reads time ranges", () => {
    expect(parseRange("this month")?.from).toBe("2026-11-01")
    expect(parseRange("in the last 14 days")?.from).toBe("2026-11-04")
    expect(parseRange("during Q2")?.to).toBe("2026-06-30")
    expect(parseRange("anything")).toBeUndefined()
  })
})

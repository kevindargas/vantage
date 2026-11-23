import type { Goal, Objective, Person, Workspace } from "@/lib/types"
import { activePeople } from "./selectors"

/**
 * How the team's goals line up behind the manager's goals, and the manager's
 * goals behind the business. Alignment is a link the manager sets by hand: a
 * goal either names the objective it supports or it does not. Nothing here
 * guesses a link from wording.
 */

function isOpen(item: { status: string }) {
  return item.status !== "done" && item.status !== "dropped"
}

export interface ObjectiveSupport {
  objective: Objective
  /** The business goal this objective supports, when it is still open. */
  parent?: Objective
  /** Active team goals that name this objective. */
  goals: Goal[]
  /** The people behind those goals, by name. */
  people: Person[]
  /** Average progress of the supporting goals. Null when there are none. */
  progress: number | null
  /** Supporting goals that are at risk or off track. */
  atRisk: number
}

export interface BusinessBranch {
  /** Undefined for the group of manager goals with no business goal. */
  business?: Objective
  objectives: ObjectiveSupport[]
}

export interface PersonAlignment {
  person: Person
  /** Active goals that support one of the manager's objectives. */
  aligned: Goal[]
  /** Active goals that support none. */
  unaligned: Goal[]
  /** The manager objectives this person contributes to. */
  objectives: Objective[]
}

export interface Alignment {
  business: Objective[]
  mine: Objective[]
  /** Business goals, each with the manager goals under it. The last branch,
   * when present, holds manager goals tied to no business goal. */
  branches: BusinessBranch[]
  people: PersonAlignment[]
  /** Active goals of active people. */
  teamGoals: Goal[]
  alignedGoals: Goal[]
  unalignedGoals: Goal[]
  /** Share of active team goals that support a manager goal, 0 to 100. */
  coverage: number | null
  /** Manager goals no team goal supports. */
  unsupported: Objective[]
  /** Business goals none of the manager's goals support. */
  uncovered: Objective[]
  /** Active people with goals, none of which support a manager goal. */
  peopleWithoutLink: Person[]
}

export function openObjectives(
  ws: Workspace,
  level?: Objective["level"]
): Objective[] {
  return ws.objectives
    .filter((o) => isOpen(o) && (!level || o.level === level))
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom))
}

export function getObjective(
  ws: Workspace,
  id: string | undefined
): Objective | undefined {
  return id ? ws.objectives.find((o) => o.id === id) : undefined
}

/** The open manager objective a goal supports, if any. */
export function objectiveFor(ws: Workspace, goal: Goal): Objective | undefined {
  const objective = getObjective(ws, goal.objectiveId)
  return objective && objective.level === "manager" && isOpen(objective)
    ? objective
    : undefined
}

export function buildAlignment(ws: Workspace): Alignment {
  const people = activePeople(ws)
  const business = openObjectives(ws, "business")
  const mine = openObjectives(ws, "manager")
  const teamGoals = ws.goals.filter(
    (g) => isOpen(g) && people.some((p) => p.id === g.personId)
  )
  const linked = (g: Goal) => mine.some((o) => o.id === g.objectiveId)
  const alignedGoals = teamGoals.filter(linked)
  const unalignedGoals = teamGoals.filter((g) => !linked(g))

  const support = (objective: Objective): ObjectiveSupport => {
    const goals = teamGoals.filter((g) => g.objectiveId === objective.id)
    return {
      objective,
      parent: business.find((b) => b.id === objective.parentId),
      goals,
      people: people.filter((p) => goals.some((g) => g.personId === p.id)),
      progress: goals.length
        ? Math.round(
            goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
          )
        : null,
      atRisk: goals.filter(
        (g) => g.status === "at-risk" || g.status === "off-track"
      ).length,
    }
  }
  const supports = mine.map(support)

  const branches: BusinessBranch[] = business.map((b) => ({
    business: b,
    objectives: supports.filter((s) => s.parent?.id === b.id),
  }))
  const loose = supports.filter((s) => !s.parent)
  if (loose.length) branches.push({ objectives: loose })

  const byPerson: PersonAlignment[] = people.map((person) => {
    const goals = teamGoals.filter((g) => g.personId === person.id)
    const aligned = goals.filter(linked)
    return {
      person,
      aligned,
      unaligned: goals.filter((g) => !linked(g)),
      objectives: mine.filter((o) =>
        aligned.some((g) => g.objectiveId === o.id)
      ),
    }
  })

  return {
    business,
    mine,
    branches,
    people: byPerson,
    teamGoals,
    alignedGoals,
    unalignedGoals,
    coverage: teamGoals.length
      ? Math.round((alignedGoals.length / teamGoals.length) * 100)
      : null,
    unsupported: supports
      .filter((s) => !s.goals.length)
      .map((s) => s.objective),
    uncovered: business.filter((b) => !mine.some((o) => o.parentId === b.id)),
    peopleWithoutLink: byPerson
      .filter((p) => p.aligned.length === 0 && p.unaligned.length > 0)
      .map((p) => p.person),
  }
}

"use client"

import * as React from "react"

import {
  useQueryParam,
  type QueryParamMode,
  type QueryParamValue,
} from "@/hooks/use-query-param"

/**
 * One query param as component state. The value updates at once when set and
 * is written to the URL in the same step; when the URL changes on its own
 * (a link, the back button) the URL wins. The caller sits inside `<Suspense>`.
 */
export function useUrlState(key: string, mode: QueryParamMode = "replace") {
  const [param, setParam] = useQueryParam(key, { mode })
  const [seen, setSeen] = React.useState(param)
  const [value, setValue] = React.useState(param)
  if (param !== seen) {
    setSeen(param)
    setValue(param)
  }
  const set = React.useCallback(
    (next: QueryParamValue) => {
      setValue(next || null)
      setParam(next)
    },
    [setParam]
  )
  return [value, set] as const
}

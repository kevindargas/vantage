"use client"

import * as React from "react"
import Link from "next/link"
import { DownloadIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { MetricTile } from "@/components/shared/metric-tile"
import { StateBadge } from "@/components/shared/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { flatNavigation } from "@/config/nav"
import { siteConfig } from "@/config/site"
import { plural } from "@/lib/format"
import { today } from "@/lib/time"
import type { ManagerProfile, Workspace } from "@/lib/types"
import { actions, normalizeWorkspace, workspace } from "@/lib/vantage/store"
import { downloadText } from "./files"

type Confirm =
  | { kind: "import"; name: string; text: string; incoming: Workspace }
  | { kind: "sample" }
  | { kind: "clear" }

function contents(ws: Workspace) {
  return `${plural(ws.people.length, "person", "people")}, ${plural(ws.meetings.length, "1:1")}, ${plural(ws.commitments.length, "commitment")} and ${plural(ws.feedback.length, "feedback entry", "feedback entries")}`
}

const globalShortcuts: { keys: readonly string[]; label: string }[] = [
  { keys: siteConfig.shortcuts.commandMenu, label: "Open the command menu" },
  { keys: siteConfig.shortcuts.quickCreate, label: "Create something new" },
  { keys: siteConfig.shortcuts.sidebar, label: "Show or hide the sidebar" },
  { keys: siteConfig.shortcuts.darkMode, label: "Switch light and dark" },
  { keys: siteConfig.shortcuts.settings, label: "Open Settings" },
]

export function SettingsView() {
  const ws = workspace.use()
  const { manager, settings } = ws
  const [confirm, setConfirm] = React.useState<Confirm | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const held = ws.meetings.filter((m) => m.transcript).length
  const chords = flatNavigation.filter((item) => item.shortcut)

  function exportFile() {
    const filename = `vantage-workspace-${today()}.json`
    downloadText(filename, actions.exportWorkspace(), "application/json")
    toast.success(`Downloaded ${filename}`, {
      description: `${contents(ws)}. Private notes are included, so store the file with care.`,
    })
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset, so choosing the same file again fires a change.
    event.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const incoming = normalizeWorkspace(JSON.parse(text))
      setConfirm({ kind: "import", name: file.name, text, incoming })
    } catch {
      toast.error("That file is not a Vantage workspace", {
        description: `Nothing was changed. Choose a file you exported from ${siteConfig.name}.`,
      })
    }
  }

  function run() {
    if (!confirm) return
    if (confirm.kind === "import") {
      try {
        actions.importWorkspace(confirm.text)
        toast.success("Workspace imported", {
          description: `${confirm.name}: ${contents(confirm.incoming)}.`,
        })
      } catch {
        toast.error("That file is not a Vantage workspace", {
          description: "Nothing was changed.",
        })
      }
    } else if (confirm.kind === "sample") {
      actions.loadSample()
      toast.success("Sample team loaded", {
        description: "The workspace now holds the sample team.",
      })
    } else {
      actions.clearAll()
      toast.success("Workspace cleared", {
        description: "Your profile and settings were kept.",
      })
    }
    setConfirm(null)
  }

  const dialog =
    confirm?.kind === "import"
      ? {
          title: "Replace the workspace with this file?",
          body: `${confirm.name} holds ${contents(confirm.incoming)}. Importing it replaces everything in this browser: ${contents(ws)}, plus your profile and settings. Export first if you want to keep what is here.`,
          action: "Replace workspace",
        }
      : confirm?.kind === "sample"
        ? {
            title: "Load the sample team?",
            body: `This replaces everything in the workspace, including your profile and settings, with a fresh copy of the sample team. What is here now (${contents(ws)}) is removed. Export first if you want to keep it.`,
            action: "Load the sample team",
          }
        : {
            title: "Clear the workspace?",
            body: `This removes every person and every record: ${contents(ws)}, with all goals, blockers, pulses, review drafts and the consent log. Your profile and settings are kept. This cannot be undone.`,
            action: "Clear the workspace",
          }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <ProfileCard
        key={[manager.name, manager.title, manager.email, manager.team].join(
          "|"
        )}
        manager={manager}
      />

      <Card>
        <CardHeader>
          <CardTitle>Morning brief</CardTitle>
          <CardDescription>
            The time you plan to read the brief each morning.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid w-40 gap-1.5">
            <Label htmlFor="brief-time">Brief time</Label>
            <Input
              id="brief-time"
              type="time"
              value={settings.briefTime}
              onChange={(e) =>
                e.target.value &&
                actions.updateSettings({ briefTime: e.target.value })
              }
            />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Vantage has no notifications and sends nothing, so this time is a
            note to yourself. The brief is the{" "}
            <Link
              href="/today"
              className="text-foreground underline underline-offset-4"
            >
              Today page
            </Link>
            , ready whenever you open it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything is stored in this browser. An export is the only backup,
            and the way to move to another browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricTile label="People" value={ws.people.length} />
            <MetricTile label="1:1s" value={ws.meetings.length} />
            <MetricTile label="Commitments" value={ws.commitments.length} />
            <MetricTile label="Feedback" value={ws.feedback.length} />
            <MetricTile
              label="Transcripts"
              value={held}
              hint={<Link href="/trust?tab=retention">Retention</Link>}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportFile}>
              <DownloadIcon data-icon="inline-start" />
              Export workspace
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
            >
              <UploadIcon data-icon="inline-start" />
              Import workspace
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              aria-label="Workspace file to import"
              className="sr-only"
              tabIndex={-1}
              onChange={chooseFile}
            />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The export is one JSON file saved to your downloads. An import
            replaces the whole workspace, and asks before it does.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Start over
            {settings.sampleData && (
              <StateBadge state="Sample team" tone="info" size="sm" />
            )}
          </CardTitle>
          <CardDescription>
            {settings.sampleData
              ? "The workspace currently holds the sample team. Clear it when you are ready to add your own people."
              : "The workspace holds your own records. Both actions below remove them."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="grid min-w-0 flex-1 basis-64 gap-0.5">
              <p className="text-sm font-medium">Load the sample team</p>
              <p className="text-sm text-muted-foreground">
                Replaces everything with a fresh copy of the sample people and
                their records.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setConfirm({ kind: "sample" })}
            >
              Load the sample team
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="grid min-w-0 flex-1 basis-64 gap-0.5">
              <p className="text-sm font-medium">Clear the workspace</p>
              <p className="text-sm text-muted-foreground">
                Removes every person and record. Keeps your profile and
                settings.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setConfirm({ kind: "clear" })}
            >
              Clear the workspace
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Theme, colors and density are set with the customizer button in the
            header, at the top right of every page. Press{" "}
            <Kbd>{siteConfig.shortcuts.darkMode[0]}</Kbd> to switch between
            light and dark.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard</CardTitle>
          <CardDescription>
            Shortcuts work anywhere outside a text field.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <ShortcutList
            title="Everywhere"
            rows={globalShortcuts.map((s) => ({
              label: s.label,
              keys: [...s.keys],
            }))}
          />
          <ShortcutList
            title={`Go to a page: ${siteConfig.shortcuts.goTo}, then a letter`}
            rows={chords.map((item) => ({
              label: item.title,
              keys: (item.shortcut ?? "").split(" "),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-medium">{siteConfig.name}</span>{" "}
            <span className="text-muted-foreground tabular-nums">
              version {siteConfig.version}
            </span>
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {siteConfig.tagline}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/playbook" />}
            >
              Read the Playbook
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/trust" />}>
              Trust and privacy
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={run}>
              {dialog.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ProfileCard({ manager }: { manager: ManagerProfile }) {
  const [form, setForm] = React.useState(manager)
  const changed = (Object.keys(form) as (keyof ManagerProfile)[]).some(
    (key) => form[key].trim() !== manager[key]
  )
  const fields: {
    key: keyof ManagerProfile
    label: string
    type?: string
    autoComplete: string
  }[] = [
    { key: "name", label: "Name", autoComplete: "name" },
    { key: "title", label: "Title", autoComplete: "organization-title" },
    { key: "email", label: "E-mail", type: "email", autoComplete: "email" },
    { key: "team", label: "Team", autoComplete: "off" },
  ]

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    actions.updateManager({
      name: form.name.trim(),
      title: form.title.trim(),
      email: form.email.trim(),
      team: form.team.trim(),
    })
    toast.success("Profile saved")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>
          Shown in the sidebar and used to tell your words from theirs in a
          transcript.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={`profile-${field.key}`}>{field.label}</Label>
                <Input
                  id={`profile-${field.key}`}
                  type={field.type ?? "text"}
                  autoComplete={field.autoComplete}
                  required={field.key === "name"}
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <Button
            type="submit"
            className="self-start"
            disabled={!changed || !form.name.trim()}
          >
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ShortcutList({
  title,
  rows,
}: {
  title: string
  rows: { label: string; keys: string[] }[]
}) {
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="flex flex-col divide-y">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <KbdGroup>
              {row.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </li>
        ))}
      </ul>
    </div>
  )
}

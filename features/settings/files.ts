/** Save text as a file through a Blob download. Runs in the browser only. */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/plain"
) {
  const url = URL.createObjectURL(
    new Blob([text], { type: `${mime};charset=utf-8` })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Copy text to the clipboard. Resolves to false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

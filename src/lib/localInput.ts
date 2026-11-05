/** ISO timestamp ⇄ value for <input type="datetime-local"> / "date" (local time). */
export const localInput = {
  fromIso(iso: string, dateOnly = false): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return dateOnly ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  },
  toIso(value: string): string {
    return new Date(value.length === 10 ? `${value}T00:00` : value).toISOString()
  },
}

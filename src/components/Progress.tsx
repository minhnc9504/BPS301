export function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  return <progress className="progress" value={value} max={total || 1} aria-label={label} />
}

export default function StatusBadge({ status }) {
  const label = status?.replace(/_/g, ' ') || status
  return <span className={`badge badge-${status}`}>{label}</span>
}

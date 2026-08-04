export default function LoadingSpinner({ size = 'md' }) {
  return <div className={`spinner spinner-${size}`} role="status" aria-label="Loading" />
}

import { useEffect, useRef, useState } from 'react'
import { apiCreateLog, apiUpdateLog } from '../services/api'

/**
 * useAutosave — debounced auto-save for logbook draft entries.
 *
 * @param {object}   form          - The current form state
 * @param {string|null} logId      - Existing log ID, or null for a new entry
 * @param {function} setLogId      - Setter to persist the newly created log ID
 * @param {boolean}  isSubmitting  - True while the form is being submitted; suppresses autosave
 * @returns {{ saveStatus: string, savedAt: Date|null }}
 */
export default function useAutosave(form, logId, setLogId, isSubmitting) {
  const timerRef = useRef(null)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    // Always clear any pending timer first
    clearTimeout(timerRef.current)

    // Don't autosave while a manual submit is in progress
    if (isSubmitting) return

    // Require at minimum one of the two primary fields to have content
    if (!form.activities_performed?.trim() || !form.solutions_offered?.trim()) {
      setSaveStatus('idle')
      return
    }

    // Schedule autosave after debounce delay
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        if (logId === null) {
          const { data } = await apiCreateLog({ ...form, status: 'draft' })
          setLogId(data.id)
        } else {
          await apiUpdateLog(logId, { ...form, status: 'draft' })
        }
        setSaveStatus('saved')
        setSavedAt(new Date())
      } catch {
        setSaveStatus('error')
      }
    }, 2000)

    // Cleanup on re-render or unmount
    return () => clearTimeout(timerRef.current)
  }, [form, logId, setLogId, isSubmitting])

  return { saveStatus, savedAt }
}

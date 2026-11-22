import axios from 'axios'

export const getApiErrorMessage = (err) => {
  const detail = err?.response?.data?.detail
  if (!detail) {
    return err?.response?.data?.message || err?.message || 'An unexpected error occurred.'
  }
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => typeof item === 'string' ? item : item?.msg || JSON.stringify(item))
      .join(' ')
  }
  if (typeof detail === 'object') {
    return detail.msg || Object.values(detail)
      .map((item) => typeof item === 'string' ? item : JSON.stringify(item))
      .join(' ')
  }
  return String(detail)
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://intelog-backend.onrender.com'
const api = axios.create({ baseURL: BASE_URL + '/api', withCredentials: true })

let _token = sessionStorage.getItem('access_token') || null
let _onLogout = null

export const setToken = (t) => { _token = t; if (t) sessionStorage.setItem('access_token', t); else sessionStorage.removeItem('access_token') }
export const setLogoutHandler = (fn) => { _onLogout = fn }

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

let refreshing = false
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config
    if (err.response?.status === 401 && !orig._retry && !refreshing) {
      orig._retry = true
      refreshing = true
      try {
        const { data } = await axios.post(BASE_URL + '/api/auth/refresh', {}, { withCredentials: true })
        setToken(data.access_token)
        orig.headers.Authorization = `Bearer ${data.access_token}`
        refreshing = false
        return api(orig)
      } catch {
        refreshing = false
        setToken(null)
        if (_onLogout) _onLogout()
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)

//  Auth 
export const apiSignupIntern = (d) => api.post('/auth/signup/intern', d)
export const apiSignupSupervisor = (d) => api.post('/auth/signup/supervisor', d)
export const apiSignupLecturer = (d) => api.post('/auth/signup/lecturer', d)
export const apiLogin = (d) => api.post('/auth/login', d)
export const apiGoogleAuth = (code) => api.post('/auth/google', { code })
export const apiLogout = () => api.post('/auth/logout')
export const apiGetMe = () => api.get('/auth/me')
export const apiForgotPassword = (email) => api.post('/auth/forgot-password', { email })
export const apiResetPassword = (token, new_password) => api.post('/auth/reset-password', { token, new_password })
export const apiUpdateProfile = (d) => api.put('/auth/profile', d)
export const apiUploadAvatar = (file) => { const fd = new FormData(); fd.append('file', file); return api.post('/auth/profile/avatar', fd) }
export const apiChangePassword = (d) => api.post('/auth/profile/change-password', d)

//  Notifications 
export const apiGetNotifications = (params = {}) => api.get('/notifications', { params })
export const apiGetUnreadCount = () => api.get('/notifications/count')
export const apiMarkRead = (id) => api.post(`/notifications/${id}/read`)
export const apiMarkAllRead = () => api.post('/notifications/read-all')
export const apiGetNotificationHistory = (p = 1) => api.get(`/notifications/history?page=${p}`)

//  Geofence (supervisor-only pin/re-pin) 
export const apiGetMyGeofence = () => api.get('/geofence/my')
export const apiPinGeofence = (d) => api.post('/geofence/pin', d)
export const apiCheckGeofence = (lat, lon, accuracyM = null) => {
  const params = new URLSearchParams({ latitude: lat, longitude: lon })
  if (accuracyM != null && accuracyM > 0) params.append('accuracy_m', accuracyM.toFixed(1))
  return api.get(`/geofence/check?${params.toString()}`)
}

//  Admin " users & logs 
export const apiGetPendingRequests = (p = 1) => api.get(`/admin/pending-requests?page=${p}`)
export const apiRepairLink = (d) => api.post('/admin/repair-link', d)
export const apiGetUsers = (params = {}) => api.get('/admin/users', { params })
export const apiCreateUser = (d) => api.post('/admin/users', d)
export const apiUpdateUser = (id, d) => api.put(`/admin/users/${id}`, d)
export const apiApproveUser = (id) => api.post('/admin/users/' + id + '/approve')
export const apiDeleteUser = (id) => api.delete(`/admin/users/${id}`)
export const apiGetFlaggedLogs = (p = 1) => api.get(`/admin/flagged-logs?page=${p}`)
export const apiGetAllLogs = (params = {}) => api.get('/admin/logs', { params })
export const apiGetAdminLog = (id) => api.get(`/admin/logs/${id}`)
export const apiGetSites = () => api.get('/admin/sites')
export const apiCreateSite = (d) => api.post('/admin/sites', d)
export const apiUpdateSite = (id, d) => api.put(`/admin/sites/${id}`, d)
export const apiDeleteSite = (id) => api.delete(`/admin/sites/${id}`)

export const apiAssignIntern = (d) => api.post('/admin/assign-intern', d)
export const apiBulkAssignInterns = (d) => api.post('/admin/assign-interns/bulk', d)
export const apiUnassignIntern = (internId) => api.delete(`/admin/assign-intern/${internId}`)

//  Lecturer 
export const apiGetLecturerInterns = () => api.get('/lecturer/my-interns')
export const apiGetPendingLinks = (p = 1) => api.get(`/lecturer/pending-links?page=${p}`)
export const apiApproveLecturerLink = (d) => api.post('/lecturer/approve-link', d)
export const apiGetCohortLogs = (params = {}) => api.get('/lecturer/logs', { params })
export const apiGetCohortLog = (id) => api.get(`/lecturer/logs/${id}`)
export const apiGetFlaggedCohortLogs = (p = 1) => api.get(`/lecturer/flagged-logs?page=${p}`)

//  Supervisor 
export const apiGetPendingLogs = (p = 1) => api.get(`/supervisor/pending-logs?page=${p}`)
export const apiApproveLog = (id) => api.post(`/supervisor/approve-log/${id}`)
export const apiRejectLog = (id, d) => api.post(`/supervisor/reject-log/${id}`, d)
export const apiGetSupervisorInterns = () => api.get('/supervisor/interns')
export const apiUpdateIntern = (id, d) => api.put(`/supervisor/interns/${id}`, d)
export const apiSuspendIntern = (id) => api.delete(`/supervisor/interns/${id}`)

//  Intern 
export const apiGetLogs = (params = {}) => api.get('/intern/logs', { params })
export const apiCreateLog = (d) => api.post('/intern/logs', d)
export const apiUpdateLog = (id, d) => api.put(`/intern/logs/${id}`, d)
export const apiDeleteLog = (id) => api.delete(`/intern/logs/${id}`)
export const apiGetLog = (id) => api.get(`/intern/logs/${id}`)
export const apiUploadImage = (logId, file) => {
  const fd = new FormData(); fd.append('file', file)
  return api.post(`/intern/logs/${logId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const apiDeleteImage = (logId, imgId) => api.delete(`/intern/logs/${logId}/images/${imgId}`)

//  Geo (legacy) 
export const apiAssessLogbook = (d) => api.post('/assess/logbook', d)

export default api

//  Attendance & Attachment 
export const apiGetPeriodStatus       = ()  => api.get('/attendance/period-status')
export const apiGetAttachmentDates    = ()  => api.get('/attendance/dates')
export const apiSetAttachmentDates    = (d) => api.put('/attendance/dates', d)
export const apiSupervisorSetDates    = (internId, d) => api.put(`/attendance/dates/supervisor/${internId}`, d)
export const apiGetAttendanceStats    = (params = {}) => api.get('/attendance/stats', { params })
export const apiSubmitAbsence         = (d) => api.post('/attendance/absence', d)
export const apiGetMyAbsences         = ()  => api.get('/attendance/absence')
export const apiGetInternAbsences     = (internId) => api.get(`/attendance/absence/intern/${internId}`)
export const apiAcknowledgeAbsence    = (id) => api.post(`/attendance/absence/${id}/acknowledge`)

//  Holidays 
export const apiGetHolidays           = (year) => api.get('/holidays', { params: year ? { year } : {} })
export const apiAddHoliday            = (d) => api.post('/holidays', d)
export const apiAddHolidayRange       = (d) => api.post('/holidays/range', d)
export const apiDeleteHoliday         = (id) => api.delete(`/holidays/${id}`)

//  Pre-registration (admin bulk import) 
export const apiDownloadTemplate    = () => api.get('/admin/preregister/template', { responseType: 'blob' })
export const apiPreRegisterUpload   = (formData) => api.post('/admin/preregister/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})

// Clock In / Out
export const apiClockIn  = (coords) => api.post('/attendance/clock-in',  coords)
export const apiClockOut = (coords) => api.post('/attendance/clock-out', coords)
export const apiGetTodayAttendance = () => api.get('/attendance/today')

// Weekly Summary (Intern)
export const apiCreateWeeklySummary  = (data)     => api.post('/weekly-summary', data)
export const apiListWeeklySummaries  = (params)   => api.get('/weekly-summary', { params })
export const apiGetWeeklySummary     = (id)       => api.get('/weekly-summary/' + id)
export const apiUpdateWeeklySummary  = (id, data) => api.put('/weekly-summary/' + id, data)
export const apiSubmitWeeklySummary  = (id)       => api.post('/weekly-summary/' + id + '/submit')

// Weekly Summary (Supervisor)
export const apiSupervisorListSummaries  = (params)   => api.get('/supervisor/weekly-summaries', { params })
export const apiSupervisorReviewSummary  = (id, data) => api.post('/supervisor/weekly-summaries/' + id + '/review', data)

// Weekly Summary (Lecturer)
export const apiLecturerListSummaries = (params) => api.get('/lecturer/weekly-summaries', { params })

// Weekly Summary (Admin)
export const apiAdminListSummaries = (params) => api.get('/admin/weekly-summaries', { params })

// Coordinator
export const apiPromoteCoordinator  = (id) => api.post(`/admin/users/${id}/promote-coordinator`)
export const apiDemoteCoordinator   = (id) => api.post(`/admin/users/${id}/demote-coordinator`)
export const apiCoordinatorStats    = () => api.get('/coordinator/stats')
export const apiCoordinatorUsers    = (params) => api.get('/coordinator/users', { params })
export const apiCoordinatorPending  = (params) => api.get('/coordinator/pending', { params })
export const apiCoordinatorApprove  = (id) => api.post(`/coordinator/approve/${id}`)
export const apiCoordinatorAssign   = (d) => api.post('/coordinator/assign-intern', d)
export const apiCoordinatorLogs     = (params) => api.get('/coordinator/logs', { params })
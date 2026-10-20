/**
 * Dynamic API Client for SSC CGL Mock Platform
 * Seamlessly targets http://${window.location.hostname}:8000/api
 * ensuring LAN requests from tablets reach the host machine.
 */

const getApiBaseUrl = (): string => {
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
  return `http://${host}:8000/api`
}

export const API_BASE_URL = getApiBaseUrl()

// Types matching backend models
export interface ExamListItem {
  id: number
  title: string
  duration_minutes: number
  positive_marks: number
  negative_marks: number
  created_at: string
  question_count: number
  sections: string[]
  attempt_count: number
  completed_attempt_count: number
  highest_score: number | null
  active_attempt_id: number | null
}

export interface QuestionItem {
  id: number
  exam_id: number
  q_no: number
  section: string
  topic: string
  sub_topic: string | null
  question_text: string
  image_path: string | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string | null
  explanation: string | null
  is_bookmarked: boolean
}

export interface ExamDetailResponse {
  id: number
  title: string
  duration_minutes: number
  positive_marks: number
  negative_marks: number
  created_at: string
  questions: QuestionItem[]
}

export interface ExamValidationSummary {
  title: string
  duration_minutes: number
  positive_marks: number
  negative_marks: number
  total_questions: number
  sections: Record<string, number>
  topics: Record<string, number>
}

export interface ExamValidateResponse {
  valid: boolean
  errors: string[]
  summary?: ExamValidationSummary | null
}

export interface ExamUploadResponse {
  status: string
  exam_id: number
  title: string
  question_count: number
}

export interface ExamAttemptHistoryItem {
  id: number
  status: string
  started_at: string
  submitted_at: string | null
  total_score: number
  max_score: number
  correct_count: number
  incorrect_count: number
  unattempted_count: number
  accuracy_pct: number
  total_time_spent_sec: number
}

export interface BookmarkedQuestionItem {
  id: number
  exam_id: number
  exam_title: string
  q_no: number
  section: string
  topic: string
  sub_topic: string | null
  question_text: string
  image_path: string | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string
  is_bookmarked: boolean
}

export interface CheckpointResponse {
  status: string
  db_size_bytes: number
  timestamp: string
  wal_checkpoint_result: number[]
}

export type PaletteStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked_for_review' | 'answered_and_marked'

export interface AttemptQuestionItem {
  id: number
  question_id: number
  exam_id: number
  q_no: number
  section: string
  topic: string
  sub_topic: string | null
  question_text: string
  image_path: string | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  is_bookmarked: boolean
  correct_option: string | null
  explanation: string | null
  response_id: number
  selected_option: string | null
  palette_status: PaletteStatus
  time_spent_sec: number
  is_correct: boolean | null
}

export interface AttemptExamMetadata {
  id: number
  title: string
  duration_minutes: number
  positive_marks: number
  negative_marks: number
  question_count: number
  sections: string[]
}

export interface AttemptResponseRead {
  id: number
  attempt_id: number
  question_id: number
  q_no: number
  selected_option: string | null
  palette_status: PaletteStatus
  time_spent_sec: number
  is_correct: boolean | null
}

export interface AttemptStateResponse {
  id: number
  attempt_id: number
  exam_id: number
  status: 'in_progress' | 'completed'
  resumed: boolean
  started_at: string
  submitted_at: string | null
  remaining_seconds: number
  total_time_spent_sec: number
  total_score: number
  correct_count: number
  incorrect_count: number
  unattempted_count: number
  exam: AttemptExamMetadata
  questions: AttemptQuestionItem[]
  responses: AttemptResponseRead[]
}

export interface AttemptResponsePatchPayload {
  question_id: number
  selected_option: string | null
  palette_status: PaletteStatus
  delta_time_spent_sec?: number
  remaining_seconds?: number
}

export interface AttemptResponsePatchResult {
  attempt_id: number
  question_id: number
  q_no: number
  response_id: number
  selected_option: string | null
  palette_status: PaletteStatus
  time_spent_sec: number
  remaining_seconds: number
  total_time_spent_sec: number
}

export interface AttemptSubmitResponse {
  id: number
  attempt_id: number
  exam_id: number
  exam_title: string
  status: string
  started_at: string
  submitted_at: string
  remaining_seconds: number
  total_time_spent_sec: number
  question_count: number
  attempted_count: number
  correct_count: number
  incorrect_count: number
  unattempted_count: number
  raw_positive_score: number
  negative_penalty: number
  total_score: number
  max_score: number
  accuracy_pct: number
}

// Deep Analytics & Action Matrix Types
export interface BentoSummaryMetrics {
  attempt_id: number
  exam_id: number
  exam_title: string
  status: string
  started_at: string
  submitted_at: string | null
  duration_minutes: number
  positive_marks: number
  negative_marks: number
  total_questions: number
  attempted_count: number
  correct_count: number
  incorrect_count: number
  unattempted_count: number
  raw_positive_score: number
  negative_penalty: number
  total_score: number
  max_score: number
  score_pct: number
  accuracy_pct: number
  attempt_rate_pct: number
  total_time_spent_sec: number
  remaining_seconds: number
  avg_time_per_question_sec: number
  avg_time_per_attempted_sec: number
  slow_threshold_sec: number
}

export interface SectionalBreakdownItem {
  section: string
  total_questions: number
  attempted: intOrNum
  correct: number
  incorrect: number
  unattempted: number
  positive_score: number
  negative_penalty: number
  score: number
  max_score: number
  accuracy_pct: number
  time_spent_sec: number
  avg_time_sec: number
}

type intOrNum = number

export type ActionBucketType = 'concept_gap' | 'silly_mistakes' | 'needs_speed' | 'strong_zone'

export interface TopicMatrixItem {
  topic: string
  section: string
  sub_topics: string[]
  total_questions: number
  attempted: number
  correct: number
  incorrect: number
  unattempted: number
  score: number
  max_score: number
  accuracy_pct: number
  total_time_sec: number
  avg_time_sec: number
  bucket: ActionBucketType
  bucket_label: string
  recommendation: string
}

export interface TopicActionMatrixBuckets {
  concept_gap: TopicMatrixItem[]
  silly_mistakes: TopicMatrixItem[]
  needs_speed: TopicMatrixItem[]
  strong_zone: TopicMatrixItem[]
}

export interface TopicActionMatrix {
  buckets: TopicActionMatrixBuckets
  topics: TopicMatrixItem[]
}

export interface QuestionReviewItem {
  id: number
  question_id: number
  response_id: number | null
  q_no: number
  section: string
  topic: string
  sub_topic: string | null
  question_text: string
  image_path: string | null
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  selected_option: string | null
  correct_option: string
  explanation: string
  palette_status: PaletteStatus
  is_evaluated: boolean
  is_correct: boolean | null
  result_status: 'correct' | 'incorrect' | 'unattempted'
  marks_awarded: number
  time_spent_sec: number
  avg_question_time_sec: number
  is_slow: boolean
  is_over_90s: boolean
  is_bookmarked: boolean
}

export interface AttemptAnalysisResponse {
  summary: BentoSummaryMetrics
  sectional_breakdown: SectionalBreakdownItem[]
  action_matrix: TopicActionMatrix
  questions: QuestionReviewItem[]
}

export interface GlobalOverviewSummary {
  total_completed_attempts: number
  total_exams_attempted: number
  total_questions_seen: number
  total_attempted: number
  total_correct: number
  total_incorrect: number
  total_unattempted: number
  overall_accuracy_pct: number
  average_score: number
  highest_score: number | null
  total_time_spent_sec: number
  avg_time_per_question_sec: number
}

export interface ScoreTrendPoint {
  attempt_id: number
  attempt_number: number
  exam_id: number
  exam_title: string
  started_at: string
  submitted_at: string | null
  date_label: string
  total_score: number
  max_score: number
  score_pct: number
  accuracy_pct: number
  correct_count: number
  incorrect_count: number
  unattempted_count: number
  total_time_spent_sec: number
}

export interface GlobalAnalyticsOverviewResponse {
  overall_summary: GlobalOverviewSummary
  score_trend: ScoreTrendPoint[]
  sectional_breakdown: SectionalBreakdownItem[]
  action_matrix: TopicActionMatrix
  top_weak_topics: TopicMatrixItem[]
  top_slow_topics: TopicMatrixItem[]
}

// Helper API Fetcher
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = response.statusText
    try {
      const errJson = await response.json()
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail)
      } else if (errJson.errors) {
        errorDetail = Array.isArray(errJson.errors) ? errJson.errors.join('; ') : JSON.stringify(errJson.errors)
      }
    } catch {
      // fallback to statusText
    }
    throw new Error(errorDetail || `Request failed with status ${response.status}`)
  }

  return response.json()
}

// API Methods
export const api = {
  // Exams
  getExams: () => request<ExamListItem[]>('/exams'),
  getExam: (examId: number) => request<ExamDetailResponse>(`/exams/${examId}`),
  deleteExam: (examId: number) => request<{ status: string; exam_id: number; title: string }>(`/exams/${examId}`, {
    method: 'DELETE',
  }),

  // Validate & Upload
  validateExamJson: (payload: any) => request<ExamValidateResponse>('/exams/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  uploadExamJson: (payload: any) => request<ExamUploadResponse>('/exams/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  validateExamFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<ExamValidateResponse>('/exams/validate', {
      method: 'POST',
      body: formData,
    })
  },
  uploadExamFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<ExamUploadResponse>('/exams/upload', {
      method: 'POST',
      body: formData,
    })
  },

  // Attempts
  getExamAttempts: (examId: number) => request<ExamAttemptHistoryItem[]>(`/exams/${examId}/attempts`),
  startExamAttempt: (examId: number, forceNew: boolean = false) =>
    request<AttemptStateResponse>(`/exams/${examId}/start${forceNew ? '?force_new=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify({ force_new: forceNew }),
    }),
  getAttempt: (attemptId: number) => request<AttemptStateResponse>(`/attempts/${attemptId}`),
  patchAttemptResponse: (attemptId: number, payload: AttemptResponsePatchPayload) =>
    request<AttemptResponsePatchResult>(`/attempts/${attemptId}/response`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  submitAttempt: (attemptId: number, remainingSeconds?: number) =>
    request<AttemptSubmitResponse>(`/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: remainingSeconds !== undefined ? JSON.stringify({ remaining_seconds: remainingSeconds }) : undefined,
    }),
  getAttemptAnalysis: (attemptId: number) => request<AttemptAnalysisResponse>(`/attempts/${attemptId}/analysis`),
  getAnalyticsOverview: () => request<GlobalAnalyticsOverviewResponse>('/analytics/overview'),

  // Bookmarks
  getBookmarkedQuestions: (filters?: { section?: string; topic?: string; exam_id?: number }) => {
    const params = new URLSearchParams()
    if (filters?.section) params.append('section', filters.section)
    if (filters?.topic) params.append('topic', filters.topic)
    if (filters?.exam_id) params.append('exam_id', filters.exam_id.toString())
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<BookmarkedQuestionItem[]>(`/questions/bookmarked${query}`)
  },
  toggleBookmark: (questionId: number) =>
    request<{ id: number; question_id: number; is_bookmarked: boolean }>(`/questions/${questionId}/bookmark`, {
      method: 'PATCH',
    }),

  // Admin Checkpoint
  flushAndLockCheckpoint: () => request<CheckpointResponse>('/admin/checkpoint', {
    method: 'POST',
  }),
}

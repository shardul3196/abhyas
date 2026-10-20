import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Clock,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  RotateCcw,
  Check,
  Loader2,
  Cloud,
  PanelRightClose,
  PanelRightOpen,
  ZoomIn,
  X,
  Sun,
  Moon,
  BookOpen,
  Send,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react'
import { api, API_BASE_URL } from '../lib/api'
import type {
  AttemptStateResponse,
  AttemptQuestionItem,
  PaletteStatus,
} from '../lib/api'
import { useTheme } from '../context/ThemeContext'
import type { ThemeMode } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { MarkdownMathRenderer } from '../components/MarkdownMathRenderer'

export const ExamRunner: React.FC = () => {
  const { attemptId: paramAttemptId } = useParams<{ attemptId: string }>()
  const attemptId = Number(paramAttemptId)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  // Main State
  const [attempt, setAttempt] = useState<AttemptStateResponse | null>(null)
  const [questions, setQuestions] = useState<AttemptQuestionItem[]>([])
  const [currentIdx, setCurrentIdx] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Timers & Auto-Save
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const [perQuestionSec, setPerQuestionSec] = useState<number>(0)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null)

  // Layout & UI
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // References for intervals and synchronization without stale closures
  const remainingSecondsRef = useRef<number>(0)
  remainingSecondsRef.current = remainingSeconds

  const unsavedDeltaRef = useRef<number>(0)
  const currentIdxRef = useRef<number>(0)
  currentIdxRef.current = currentIdx

  const questionsRef = useRef<AttemptQuestionItem[]>([])
  questionsRef.current = questions

  const isSubmittingRef = useRef<boolean>(false)
  isSubmittingRef.current = isSubmitting

  // Current Active Question
  const currentQ = questions[currentIdx] || null

  // Format Helper: Seconds to MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Helper to resolve full image URLs
  const getFullImageUrl = (path: string | null): string => {
    if (!path) return ''
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
    return `http://${host}:8000${cleanPath}`
  }

  // -------------------------------------------------------------
  // Synchronization Engine: Flushes delta time to backend
  // -------------------------------------------------------------
  const syncQuestionResponse = useCallback(
    async (
      targetQ: AttemptQuestionItem,
      overrideOption?: string | null,
      overrideStatus?: PaletteStatus
    ) => {
      if (!attempt || isSubmittingRef.current) return

      const delta = unsavedDeltaRef.current
      unsavedDeltaRef.current = 0 // reset immediately to prevent double counting

      const effectiveOption = overrideOption !== undefined ? overrideOption : targetQ.selected_option
      const effectiveStatus = overrideStatus !== undefined ? overrideStatus : targetQ.palette_status

      setIsSaving(true)
      try {
        const patchResult = await api.patchAttemptResponse(attempt.id, {
          question_id: targetQ.id,
          selected_option: effectiveOption,
          palette_status: effectiveStatus,
          delta_time_spent_sec: delta,
          remaining_seconds: remainingSecondsRef.current,
        })

        // Update local question's time_spent_sec
        setQuestions(prev =>
          prev.map(q => {
            if (q.id === targetQ.id) {
              return {
                ...q,
                selected_option: patchResult.selected_option,
                palette_status: patchResult.palette_status,
                time_spent_sec: patchResult.time_spent_sec,
              }
            }
            return q
          })
        )
        setLastSavedTime(new Date())
      } catch (err: any) {
        console.error('Auto-save error:', err)
        // restore delta so it can be retried in the next sync
        unsavedDeltaRef.current += delta
      } finally {
        setIsSaving(false)
      }
    },
    [attempt]
  )

  // -------------------------------------------------------------
  // Final Submission Handler
  // -------------------------------------------------------------
  const handleFinalSubmit = useCallback(async () => {
    if (!attempt || isSubmitting) return

    setIsSubmitting(true)
    try {
      // 1. Flush any pending time delta for the current question
      if (currentQ && unsavedDeltaRef.current > 0) {
        const delta = unsavedDeltaRef.current
        unsavedDeltaRef.current = 0
        try {
          await api.patchAttemptResponse(attempt.id, {
            question_id: currentQ.id,
            selected_option: currentQ.selected_option,
            palette_status: currentQ.palette_status,
            delta_time_spent_sec: delta,
            remaining_seconds: remainingSecondsRef.current,
          })
        } catch (e) {
          console.warn('Final delta flush failed, proceeding to submit:', e)
        }
      }

      // 2. Submit the attempt
      const result = await api.submitAttempt(attempt.id, remainingSecondsRef.current)
      toast({
        title: 'Exam Submitted Successfully!',
        description: `Score: ${result.total_score} / ${result.max_score} (${result.accuracy_pct.toFixed(1)}% Accuracy)`,
        type: 'success',
      })

      // Clean up localStorage
      localStorage.removeItem(`ssc_exam_${attempt.id}_last_q`)

      // 3. Navigate to Post-Exam Analysis
      navigate(`/attempts/${attempt.id}/analysis`)
    } catch (err: any) {
      toast({
        title: 'Submission Error',
        description: err.message || 'Could not submit exam. Please try again.',
        type: 'error',
      })
      setIsSubmitting(false)
    }
  }, [attempt, currentQ, isSubmitting, navigate, toast])

  // -------------------------------------------------------------
  // Initial Attempt Loader & Crash/Refresh Recovery
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const loadAttempt = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const data = await api.getAttempt(attemptId)
        if (!isMounted) return

        if (data.status === 'completed') {
          navigate(`/attempts/${attemptId}/analysis`, { replace: true })
          return
        }

        setAttempt(data)
        const loadedQuestions = [...data.questions].sort((a, b) => a.q_no - b.q_no)
        setQuestions(loadedQuestions)
        setRemainingSeconds(data.remaining_seconds)
        remainingSecondsRef.current = data.remaining_seconds

        // Recover saved index from localStorage or default to 0
        const savedIdxStr = localStorage.getItem(`ssc_exam_${data.id}_last_q`)
        let initialIdx = 0
        if (savedIdxStr !== null) {
          const parsed = parseInt(savedIdxStr, 10)
          if (!isNaN(parsed) && parsed >= 0 && parsed < loadedQuestions.length) {
            initialIdx = parsed
          }
        }
        setCurrentIdx(initialIdx)

        // If the initial question is 'not_visited', mark it 'not_answered'
        const initialQ = loadedQuestions[initialIdx]
        if (initialQ && initialQ.palette_status === 'not_visited') {
          initialQ.palette_status = 'not_answered'
          api.patchAttemptResponse(data.id, {
            question_id: initialQ.id,
            selected_option: initialQ.selected_option,
            palette_status: 'not_answered',
            delta_time_spent_sec: 0,
            remaining_seconds: data.remaining_seconds,
          }).catch(console.error)
        }

        setPerQuestionSec(initialQ ? initialQ.time_spent_sec : 0)
      } catch (err: any) {
        if (!isMounted) return
        setLoadError(err.message || 'Failed to load exam attempt')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    if (attemptId) {
      loadAttempt()
    }

    return () => {
      isMounted = false
    }
  }, [attemptId, navigate])

  // -------------------------------------------------------------
  // Live Countdown & Per-Question Stopwatch
  // -------------------------------------------------------------
  useEffect(() => {
    if (isLoading || !attempt || isSubmitting) return

    const timer = setInterval(() => {
      // 1. Exam remaining countdown
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleFinalSubmit()
          return 0
        }
        return prev - 1
      })

      // 2. Increment question time and unsaved delta
      setPerQuestionSec(prev => prev + 1)
      unsavedDeltaRef.current += 1
    }, 1000)

    return () => clearInterval(timer)
  }, [isLoading, attempt, isSubmitting, handleFinalSubmit])

  // -------------------------------------------------------------
  // Periodic Heartbeat Auto-Save (Every 12s)
  // -------------------------------------------------------------
  useEffect(() => {
    if (isLoading || !attempt || isSubmitting) return

    const heartbeat = setInterval(() => {
      const q = questionsRef.current[currentIdxRef.current]
      if (q && unsavedDeltaRef.current > 0) {
        syncQuestionResponse(q)
      }
    }, 12000)

    return () => clearInterval(heartbeat)
  }, [isLoading, attempt, isSubmitting, syncQuestionResponse])

  // -------------------------------------------------------------
  // Handle Page Refresh / BeforeUnload Beacon
  // -------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = () => {
      const q = questionsRef.current[currentIdxRef.current]
      if (attempt && q && unsavedDeltaRef.current > 0) {
        const delta = unsavedDeltaRef.current
        const payload = JSON.stringify({
          question_id: q.id,
          selected_option: q.selected_option,
          palette_status: q.palette_status,
          delta_time_spent_sec: delta,
          remaining_seconds: remainingSecondsRef.current,
        })
        const url = `${API_BASE_URL}/attempts/${attempt.id}/response`
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [attempt])

  // -------------------------------------------------------------
  // Fullscreen Management
  // -------------------------------------------------------------
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // -------------------------------------------------------------
  // Question Navigation & SSC CGL Palette State Transitions
  // -------------------------------------------------------------
  const navigateToQuestion = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === currentIdx) return

      const activeQ = questions[currentIdx]
      if (activeQ) {
        // Flush active question delta
        syncQuestionResponse(activeQ)
      }

      const targetQ = questions[targetIdx]

      // Visiting an unvisited question transitions it to not_answered
      if (targetQ.palette_status === 'not_visited') {
        setQuestions(prev =>
          prev.map((q, idx) => (idx === targetIdx ? { ...q, palette_status: 'not_answered' } : q))
        )
        if (attempt) {
          api.patchAttemptResponse(attempt.id, {
            question_id: targetQ.id,
            selected_option: targetQ.selected_option,
            palette_status: 'not_answered',
            delta_time_spent_sec: 0,
            remaining_seconds: remainingSecondsRef.current,
          }).catch(console.error)
        }
      }

      setCurrentIdx(targetIdx)
      setPerQuestionSec(targetQ.time_spent_sec)
      unsavedDeltaRef.current = 0

      if (attempt) {
        localStorage.setItem(`ssc_exam_${attempt.id}_last_q`, targetIdx.toString())
      }
    },
    [questions, currentIdx, attempt, syncQuestionResponse]
  )

  // -------------------------------------------------------------
  // Option Card Selection
  // -------------------------------------------------------------
  const handleSelectOption = (option: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQ) return

    const newOption = currentQ.selected_option === option ? null : option
    let newStatus = currentQ.palette_status

    if (newOption !== null) {
      if (currentQ.palette_status === 'marked_for_review') {
        newStatus = 'answered_and_marked'
      }
    } else {
      if (currentQ.palette_status === 'answered_and_marked') {
        newStatus = 'marked_for_review'
      } else if (currentQ.palette_status === 'answered') {
        newStatus = 'not_answered'
      }
    }

    setQuestions(prev =>
      prev.map((q, idx) =>
        idx === currentIdx ? { ...q, selected_option: newOption, palette_status: newStatus } : q
      )
    )
  }

  // -------------------------------------------------------------
  // Action Bar Buttons
  // -------------------------------------------------------------
  // 1. "Save & Next"
  const handleSaveAndNext = () => {
    if (!currentQ) return

    const nextStatus: PaletteStatus = currentQ.selected_option ? 'answered' : 'not_answered'
    setQuestions(prev =>
      prev.map((q, idx) =>
        idx === currentIdx ? { ...q, palette_status: nextStatus } : q
      )
    )

    syncQuestionResponse(currentQ, currentQ.selected_option, nextStatus)

    if (currentIdx < questions.length - 1) {
      navigateToQuestion(currentIdx + 1)
    } else {
      // Last question: open submission modal
      setIsSubmitModalOpen(true)
    }
  }

  // 2. "Mark for Review & Next"
  const handleMarkForReviewAndNext = () => {
    if (!currentQ) return

    const nextStatus: PaletteStatus = currentQ.selected_option
      ? 'answered_and_marked'
      : 'marked_for_review'

    setQuestions(prev =>
      prev.map((q, idx) =>
        idx === currentIdx ? { ...q, palette_status: nextStatus } : q
      )
    )

    syncQuestionResponse(currentQ, currentQ.selected_option, nextStatus)

    if (currentIdx < questions.length - 1) {
      navigateToQuestion(currentIdx + 1)
    }
  }

  // 3. "Clear Response"
  const handleClearResponse = () => {
    if (!currentQ) return

    setQuestions(prev =>
      prev.map((q, idx) =>
        idx === currentIdx
          ? {
              ...q,
              selected_option: null,
              palette_status:
                q.palette_status === 'answered_and_marked'
                  ? 'marked_for_review'
                  : 'not_answered',
            }
          : q
      )
    )

    const finalStatus: PaletteStatus =
      currentQ.palette_status === 'answered_and_marked' ? 'marked_for_review' : 'not_answered'

    syncQuestionResponse(currentQ, null, finalStatus)
  }

  // 4. "Previous"
  const handlePrevious = () => {
    if (currentIdx > 0) {
      navigateToQuestion(currentIdx - 1)
    }
  }

  // 5. Bookmark Toggle
  const handleToggleBookmark = async () => {
    if (!currentQ) return

    const nextBookmark = !currentQ.is_bookmarked
    // Optimistic UI update
    setQuestions(prev =>
      prev.map((q, idx) => (idx === currentIdx ? { ...q, is_bookmarked: nextBookmark } : q))
    )

    try {
      await api.toggleBookmark(currentQ.id)
      toast({
        title: nextBookmark ? 'Question Bookmarked' : 'Bookmark Removed',
        description: nextBookmark
          ? 'Saved to your Bookmarked Questions Hub for later revision.'
          : 'Removed from Bookmarks.',
        type: 'info',
      })
    } catch {
      // Revert on error
      setQuestions(prev =>
        prev.map((q, idx) => (idx === currentIdx ? { ...q, is_bookmarked: !nextBookmark } : q))
      )
      toast({
        title: 'Bookmark Failed',
        description: 'Could not update bookmark state',
        type: 'error',
      })
    }
  }

  // -------------------------------------------------------------
  // Section Navigation & Stats Calculation
  // -------------------------------------------------------------
  const sections = useMemo(() => {
    if (!attempt?.exam?.sections) return []
    return attempt.exam.sections
  }, [attempt])

  const currentSection = currentQ ? currentQ.section : (sections[0] || '')

  // Section stats: answered vs total
  const sectionStats = useMemo(() => {
    const stats: Record<string, { total: number; answered: number }> = {}
    sections.forEach(s => {
      stats[s] = { total: 0, answered: 0 }
    })

    questions.forEach(q => {
      if (!stats[q.section]) {
        stats[q.section] = { total: 0, answered: 0 }
      }
      stats[q.section].total += 1
      if (q.palette_status === 'answered' || q.palette_status === 'answered_and_marked') {
        stats[q.section].answered += 1
      }
    })

    return stats
  }, [sections, questions])

  const handleSwitchSection = (sectionName: string) => {
    const firstIdxInSection = questions.findIndex(q => q.section === sectionName)
    if (firstIdxInSection !== -1) {
      navigateToQuestion(firstIdxInSection)
    }
  }

  // Summary counts for Confirmation Modal
  const paletteCounts = useMemo(() => {
    let answered = 0
    let notAnswered = 0
    let markedForReview = 0
    let answeredAndMarked = 0
    let notVisited = 0

    questions.forEach(q => {
      switch (q.palette_status) {
        case 'answered':
          answered++
          break
        case 'not_answered':
          notAnswered++
          break
        case 'marked_for_review':
          markedForReview++
          break
        case 'answered_and_marked':
          answeredAndMarked++
          break
        case 'not_visited':
        default:
          notVisited++
          break
      }
    })

    return {
      answered,
      notAnswered,
      markedForReview,
      answeredAndMarked,
      notVisited,
      total: questions.length,
    }
  }, [questions])

  // Sectional counts for Confirmation Modal table
  const sectionalDetailedCounts = useMemo(() => {
    const map: Record<
      string,
      {
        total: number
        answered: number
        notAnswered: number
        marked: number
        answeredMarked: number
        notVisited: number
      }
    > = {}

    sections.forEach(s => {
      map[s] = {
        total: 0,
        answered: 0,
        notAnswered: 0,
        marked: 0,
        answeredMarked: 0,
        notVisited: 0,
      }
    })

    questions.forEach(q => {
      if (!map[q.section]) {
        map[q.section] = {
          total: 0,
          answered: 0,
          notAnswered: 0,
          marked: 0,
          answeredMarked: 0,
          notVisited: 0,
        }
      }
      map[q.section].total++
      if (q.palette_status === 'answered') map[q.section].answered++
      else if (q.palette_status === 'not_answered') map[q.section].notAnswered++
      else if (q.palette_status === 'marked_for_review') map[q.section].marked++
      else if (q.palette_status === 'answered_and_marked') map[q.section].answeredMarked++
      else map[q.section].notVisited++
    })

    return map
  }, [sections, questions])

  // Theme switch options
  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { mode: 'warm', label: 'Warm', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ]

  // Render Loading / Error States
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 warm:text-warm-700 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 warm:text-warm-900">
          Loading Exam Environment...
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 warm:text-warm-700 mt-1">
          Syncing questions, remaining time, and response states from local server.
        </p>
      </div>
    )
  }

  if (loadError || !attempt) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto min-h-[60vh]">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 warm:text-warm-900">
          Failed to Load Exam
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700 mt-2">
          {loadError || 'The requested attempt could not be found or loaded.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  const isTimeCritical = remainingSeconds > 0 && remainingSeconds <= 300 // under 5 minutes

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f19] warm:bg-[#f6f1e7] select-none text-slate-900 dark:text-slate-100 warm:text-[#2d241e]">
      {/* ============================================================== */}
      {/* 1. DISTRACTION-FREE TOP HEADER                                 */}
      {/* ============================================================== */}
      <header className="h-14 sm:h-16 px-3 sm:px-5 shrink-0 border-b backdrop-blur-md flex items-center justify-between border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 warm:border-warm-300 warm:bg-warm-100/95 z-30">
        {/* Left: Exam Title & Section Segmented Pill Bar */}
        <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto py-1 scrollbar-none">
          <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800 warm:border-warm-300">
            <span className="font-bold text-sm tracking-tight truncate max-w-[200px]" title={attempt.exam.title}>
              {attempt.exam.title}
            </span>
          </div>

          {/* Section Segmented Pill Bar */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 warm:bg-warm-200/80 border border-slate-200/60 dark:border-slate-700/60 warm:border-warm-300">
            {sections.map(sec => {
              const isActive = sec === currentSection
              const stats = sectionStats[sec] || { total: 0, answered: 0 }
              return (
                <button
                  key={sec}
                  onClick={() => handleSwitchSection(sec)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-400 warm:bg-warm-50 warm:text-warm-950 font-bold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 warm:text-warm-700 hover:bg-white/40'
                  }`}
                >
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">{sec}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 warm:bg-warm-200 warm:text-warm-900'
                        : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300 warm:bg-warm-300 warm:text-warm-800'
                    }`}
                  >
                    {stats.answered}/{stats.total}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Controls: Sync indicator, Countdown timer, Fullscreen, Theme, Submit Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
          {/* Subtle Auto-save indicator */}
          <div className="hidden xl:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 warm:text-warm-600 font-medium mr-1">
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                <span title={lastSavedTime ? `Last saved at ${lastSavedTime.toLocaleTimeString()}` : 'Connected'}>
                  Saved
                </span>
              </>
            )}
          </div>

          {/* Countdown Timer Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold transition-all shadow-sm ${
              isTimeCritical
                ? 'animate-pulse bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400 warm:text-amber-800'
                : 'bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 warm:bg-warm-200 warm:border-warm-300 warm:text-warm-900'
            }`}
            title="Time Remaining"
          >
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
            <span>{formatTime(remainingSeconds)}</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-800 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 text-slate-600 dark:text-slate-400 warm:text-warm-700 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Distraction-Free Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Theme Selector Segmented Pill */}
          <div className="hidden sm:flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-slate-100 dark:bg-slate-800 warm:bg-warm-200/60">
            {themeOptions.map(opt => (
              <button
                key={opt.mode}
                onClick={() => setTheme(opt.mode)}
                className={`p-1.5 rounded-md transition-all ${
                  theme === opt.mode
                    ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white warm:bg-warm-50 warm:text-warm-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 warm:text-warm-600'
                }`}
                title={`${opt.label} mode`}
              >
                {opt.icon}
              </button>
            ))}
          </div>

          {/* Submit Exam Button */}
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150
              bg-emerald-600 hover:bg-emerald-700 text-white
              dark:bg-emerald-600 dark:hover:bg-emerald-500
              warm:bg-emerald-700 warm:hover:bg-emerald-800"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Submit Exam</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN SPLIT VIEW (75% Workspace / 25% Palette Sidebar)       */}
      {/* ============================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT QUESTION WORKSPACE */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0e1422] warm:bg-[#fbf7f0] transition-colors">
          {/* Question Metadata Header Bar */}
          {currentQ && (
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200/80 dark:border-slate-800 warm:border-warm-300 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/30 warm:bg-warm-100/50">
              {/* Question badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white dark:bg-indigo-500 warm:bg-warm-800">
                  Question {currentQ.q_no} of {questions.length}
                </span>

                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/70 text-slate-800 dark:bg-slate-800 dark:text-slate-300 warm:bg-warm-200 warm:text-warm-800">
                  {currentQ.section}
                </span>

                <span className="hidden sm:inline-flex px-2 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700">
                  {currentQ.topic} {currentQ.sub_topic ? `• ${currentQ.sub_topic}` : ''}
                </span>

                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 warm:bg-warm-200 warm:text-warm-900">
                  +{attempt.exam.positive_marks} / -{attempt.exam.negative_marks} Marks
                </span>
              </div>

              {/* Right: Live per-question stopwatch, Bookmark toggle & Mobile Palette Toggle */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Per-Question Live Stopwatch */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 warm:bg-warm-200 border border-slate-200 dark:border-slate-700 warm:border-warm-300 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 warm:text-warm-800"
                  title="Time spent on this question"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{formatTime(perQuestionSec)}</span>
                </div>

                {/* Bookmark Toggle */}
                <button
                  onClick={handleToggleBookmark}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    currentQ.is_bookmarked
                      ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 warm:bg-warm-300 warm:border-warm-500 warm:text-warm-900'
                      : 'border-slate-200 dark:border-slate-800 warm:border-warm-300 text-slate-600 dark:text-slate-400 warm:text-warm-700 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200'
                  }`}
                  title="Bookmark for review after exam"
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      currentQ.is_bookmarked ? 'fill-amber-500 text-amber-500' : ''
                    }`}
                  />
                  <span className="hidden sm:inline">Bookmark</span>
                </button>

                {/* Toggle Palette Sidebar button */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 text-slate-600 dark:text-slate-400 warm:text-warm-700 lg:hidden"
                  title={isSidebarOpen ? 'Close Question Palette' : 'Open Question Palette'}
                >
                  {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Question Body & 4 Touch Option Cards (Scrollable Area) */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 space-y-6">
            {currentQ && (
              <>
                {/* Rich-Text Question Body */}
                <div className="text-base sm:text-lg text-slate-900 dark:text-slate-50 warm:text-[#2d241e] font-medium leading-relaxed">
                  <MarkdownMathRenderer content={currentQ.question_text} />
                </div>

                {/* Optional Zoomable Question Image Lightbox */}
                {currentQ.image_path && (
                  <div className="my-4">
                    <div className="relative inline-block border rounded-xl overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 warm:border-warm-300 group max-w-full">
                      <img
                        src={getFullImageUrl(currentQ.image_path)}
                        alt={`Question ${currentQ.q_no} illustration`}
                        className="max-h-72 object-contain bg-white dark:bg-slate-900 cursor-zoom-in"
                        onClick={() => setLightboxImage(getFullImageUrl(currentQ.image_path))}
                      />
                      <button
                        onClick={() => setLightboxImage(getFullImageUrl(currentQ.image_path))}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1 backdrop-blur-sm transition-opacity opacity-80 group-hover:opacity-100"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Enlarge Image</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4 Large Tablet-Optimized Touch Option Cards */}
                <div className="space-y-3 pt-2">
                  {(['A', 'B', 'C', 'D'] as const).map(optKey => {
                    const isSelected = currentQ.selected_option === optKey
                    const optionContent =
                      optKey === 'A'
                        ? currentQ.option_a
                        : optKey === 'B'
                        ? currentQ.option_b
                        : optKey === 'C'
                        ? currentQ.option_c
                        : currentQ.option_d

                    return (
                      <div
                        key={optKey}
                        onClick={() => handleSelectOption(optKey)}
                        className={`group relative flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 min-h-[58px] ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/90 dark:border-indigo-500 dark:bg-indigo-950/40 warm:border-warm-700 warm:bg-warm-200/80 shadow-sm ring-1 ring-indigo-500/30'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/60 warm:border-warm-300 warm:bg-warm-100 warm:hover:bg-warm-200/60'
                        }`}
                      >
                        {/* Option Letter Indicator */}
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-colors ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500 warm:border-warm-800 warm:bg-warm-800'
                              : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 warm:border-warm-400 warm:text-warm-800 group-hover:border-slate-400'
                          }`}
                        >
                          {isSelected ? <Check className="w-4 h-4 text-white stroke-[3]" /> : optKey}
                        </div>

                        {/* Option Text with KaTeX Math support */}
                        <div className="flex-1 text-sm sm:text-base font-normal text-slate-800 dark:text-slate-100 warm:text-[#2d241e] pt-0.5 leading-snug">
                          <MarkdownMathRenderer content={optionContent} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* ============================================================== */}
          {/* BOTTOM ACTION BAR                                              */}
          {/* ============================================================== */}
          <footer className="px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-slate-800 warm:border-warm-300 bg-slate-50 dark:bg-slate-900/80 warm:bg-warm-100/90 flex items-center justify-between gap-2 shrink-0">
            {/* Left Actions: Mark for Review & Clear Response */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkForReviewAndNext}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-150
                  bg-violet-50 border-violet-300 text-violet-800 hover:bg-violet-100
                  dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/60
                  warm:bg-warm-200 warm:border-violet-400 warm:text-violet-900 warm:hover:bg-warm-300"
                title="Mark for Review and advance to next question"
              >
                <Bookmark className="w-4 h-4 fill-violet-600 text-violet-600 dark:fill-violet-400 dark:text-violet-400" />
                <span className="hidden sm:inline">Mark for Review & Next</span>
                <span className="sm:hidden">Mark & Next</span>
              </button>

              <button
                onClick={handleClearResponse}
                disabled={!currentQ?.selected_option}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 warm:border-warm-400 warm:text-warm-800 warm:hover:bg-warm-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear current question response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Response</span>
                <span className="sm:hidden">Clear</span>
              </button>
            </div>

            {/* Right Actions: Previous & Save & Next */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentIdx === 0}
                className="flex items-center gap-1 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 warm:border-warm-400 text-slate-700 dark:text-slate-300 warm:text-warm-800 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Go to previous question"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleSaveAndNext}
                className="flex items-center gap-1.5 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all duration-150
                  bg-indigo-600 hover:bg-indigo-700 text-white
                  dark:bg-indigo-500 dark:hover:bg-indigo-600
                  warm:bg-warm-800 warm:hover:bg-warm-900"
                title="Save response and advance to next question"
              >
                <span>{currentIdx === questions.length - 1 ? 'Save & Review' : 'Save & Next'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </main>

        {/* ============================================================== */}
        {/* RIGHT QUESTION PALETTE SIDEBAR (Collapsible)                    */}
        {/* ============================================================== */}
        <aside
          className={`shrink-0 border-l border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-slate-50/90 dark:bg-slate-900/90 warm:bg-warm-100/90 transition-all duration-200 flex flex-col z-20 ${
            isSidebarOpen
              ? 'w-72 sm:w-80 absolute lg:relative right-0 inset-y-0 shadow-xl lg:shadow-none'
              : 'w-0 hidden'
          }`}
        >
          {/* Palette Sidebar Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 warm:border-warm-300 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 warm:text-warm-950">
                Question Palette
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 warm:text-warm-700">
                {currentSection} ({sectionStats[currentSection]?.answered || 0}/{sectionStats[currentSection]?.total || 0} Answered)
              </p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 warm:hover:bg-warm-200 text-slate-500"
              title="Collapse palette"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          {/* SSC CGL 5-State Legend */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 warm:border-warm-300 grid grid-cols-2 gap-2 text-[11px] font-medium shrink-0 bg-white/50 dark:bg-slate-950/20 warm:bg-warm-200/40">
            {/* 1. Answered */}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {paletteCounts.answered}
              </span>
              <span className="text-slate-700 dark:text-slate-300 warm:text-warm-800 truncate">Answered</span>
            </div>

            {/* 2. Not Answered */}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {paletteCounts.notAnswered}
              </span>
              <span className="text-slate-700 dark:text-slate-300 warm:text-warm-800 truncate">Not Answered</span>
            </div>

            {/* 3. Marked for Review */}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-violet-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {paletteCounts.markedForReview}
              </span>
              <span className="text-slate-700 dark:text-slate-300 warm:text-warm-800 truncate">Review</span>
            </div>

            {/* 4. Answered & Marked */}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-violet-500 text-white relative flex items-center justify-center font-bold text-[10px] shrink-0">
                {paletteCounts.answeredAndMarked}
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-slate-900" />
              </span>
              <span className="text-slate-700 dark:text-slate-300 warm:text-warm-800 truncate">Ans & Marked</span>
            </div>

            {/* 5. Not Visited */}
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                {paletteCounts.notVisited}
              </span>
              <span className="text-slate-700 dark:text-slate-300 warm:text-warm-800">Not Visited</span>
            </div>
          </div>

          {/* Numbered Buttons Grid for Questions */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {sections.map(secName => {
                const sectionQuestions = questions.filter(q => q.section === secName)
                if (sectionQuestions.length === 0) return null

                return (
                  <div key={secName} className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 warm:text-warm-700 flex items-center justify-between">
                      <span>{secName}</span>
                      <span className="text-[10px] lowercase font-normal">
                        {sectionQuestions.length} Qs
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {sectionQuestions.map(q => {
                        const qIndex = questions.findIndex(item => item.id === q.id)
                        const isCurrent = qIndex === currentIdx

                        // Determine button styling based on 5 SSC CGL states
                        let btnStyle = ''
                        let hasEmeraldDot = false

                        switch (q.palette_status) {
                          case 'answered':
                            btnStyle = 'bg-emerald-500 hover:bg-emerald-600 text-white font-bold'
                            break
                          case 'not_answered':
                            btnStyle = 'bg-rose-500 hover:bg-rose-600 text-white font-bold'
                            break
                          case 'marked_for_review':
                            btnStyle = 'bg-violet-500 hover:bg-violet-600 text-white font-bold'
                            break
                          case 'answered_and_marked':
                            btnStyle = 'bg-violet-500 hover:bg-violet-600 text-white font-bold'
                            hasEmeraldDot = true
                            break
                          case 'not_visited':
                          default:
                            btnStyle =
                              'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 warm:bg-warm-200 warm:text-warm-800 border border-slate-300 dark:border-slate-700 font-medium'
                            break
                        }

                        return (
                          <button
                            key={q.id}
                            onClick={() => navigateToQuestion(qIndex)}
                            className={`h-10 rounded-lg text-sm flex items-center justify-center relative transition-all duration-150 ${btnStyle} ${
                              isCurrent
                                ? 'ring-2 ring-offset-2 ring-indigo-600 dark:ring-indigo-400 warm:ring-warm-800 shadow-md scale-105 z-10'
                                : ''
                            }`}
                            title={`Q.${q.q_no}: ${q.palette_status.replace(/_/g, ' ')}`}
                          >
                            <span>{q.q_no}</span>
                            {hasEmeraldDot && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ============================================================== */}
      {/* 3. CONFIRMATION SUMMARY MODAL ("Submit Exam")                   */}
      {/* ============================================================== */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 warm:bg-warm-50 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 warm:border-warm-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 warm:text-warm-800" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 warm:text-warm-950">
                  Confirm Exam Submission
                </h3>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Time Remaining Callout */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 warm:bg-warm-200 warm:border-warm-400 warm:text-warm-950">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Time Remaining:</span>
                </div>
                <span className="font-mono font-bold text-base">{formatTime(remainingSeconds)}</span>
              </div>

              {/* 5-State Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800">
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {paletteCounts.answered}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Answered
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800">
                  <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                    {paletteCounts.notAnswered}
                  </div>
                  <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 mt-0.5">
                    Not Answered
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 dark:bg-violet-950/30 dark:border-violet-800">
                  <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400">
                    {paletteCounts.markedForReview}
                  </div>
                  <div className="text-[11px] font-semibold text-violet-800 dark:text-violet-300 mt-0.5">
                    Review
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 dark:bg-violet-950/30 dark:border-violet-800">
                  <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400">
                    {paletteCounts.answeredAndMarked}
                  </div>
                  <div className="text-[11px] font-semibold text-violet-800 dark:text-violet-300 mt-0.5">
                    Ans & Marked
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 col-span-2 sm:col-span-1">
                  <div className="text-xl font-extrabold text-slate-700 dark:text-slate-300">
                    {paletteCounts.notVisited}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Not Visited
                  </div>
                </div>
              </div>

              {/* Sectional Breakdown Table */}
              <div className="border rounded-xl border-slate-200 dark:border-slate-800 warm:border-warm-300 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 warm:bg-warm-200 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 warm:border-warm-300">
                    <tr>
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2 text-center">Total</th>
                      <th className="px-3 py-2 text-center text-emerald-600 dark:text-emerald-400">Ans</th>
                      <th className="px-3 py-2 text-center text-rose-600 dark:text-rose-400">Not Ans</th>
                      <th className="px-3 py-2 text-center text-violet-600 dark:text-violet-400">Review</th>
                      <th className="px-3 py-2 text-center">Unvisited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 warm:divide-warm-200 font-medium text-slate-700 dark:text-slate-300">
                    {sections.map(sec => {
                      const counts = sectionalDetailedCounts[sec] || {
                        total: 0,
                        answered: 0,
                        notAnswered: 0,
                        marked: 0,
                        answeredMarked: 0,
                        notVisited: 0,
                      }
                      return (
                        <tr key={sec} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">{sec}</td>
                          <td className="px-3 py-2 text-center">{counts.total}</td>
                          <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {counts.answered + counts.answeredMarked}
                          </td>
                          <td className="px-3 py-2 text-center text-rose-600 dark:text-rose-400">{counts.notAnswered}</td>
                          <td className="px-3 py-2 text-center text-violet-600 dark:text-violet-400">{counts.marked}</td>
                          <td className="px-3 py-2 text-center">{counts.notVisited}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* SSC CGL Marking Rule Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 warm:bg-warm-100 text-xs text-slate-600 dark:text-slate-400 warm:text-warm-800 leading-relaxed border border-slate-200/60 dark:border-slate-700/60 warm:border-warm-300">
                <span className="font-bold text-slate-800 dark:text-slate-200">SSC CGL Scoring Protocol:</span> Only questions marked <strong className="text-emerald-600 dark:text-emerald-400">Answered</strong> and <strong className="text-violet-600 dark:text-violet-400">Answered & Marked for Review</strong> with a chosen option will be scored (+{attempt.exam.positive_marks} / -{attempt.exam.negative_marks} marks). Unattempted and unselected questions will receive 0 marks.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-slate-50/80 dark:bg-slate-900 warm:bg-warm-100 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Return to Test
              </button>

              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all duration-150
                  bg-emerald-600 hover:bg-emerald-700 text-white
                  dark:bg-emerald-600 dark:hover:bg-emerald-500
                  disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Evaluating Answers...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Submit Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. ZOOMABLE IMAGE LIGHTBOX MODAL                               */}
      {/* ============================================================== */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Question Diagram (Enlarged View)
              </span>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[80vh] flex items-center justify-center bg-slate-100 dark:bg-slate-950">
              <img src={lightboxImage} alt="Enlarged diagram" className="max-w-full h-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

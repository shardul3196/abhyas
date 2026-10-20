import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Play, 
  RotateCcw, 
  History, 
  Clock, 
  Award, 
  BookOpen, 
  PlusCircle, 
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { api } from '../lib/api'
import type { ExamListItem } from '../lib/api'
import { PastAttemptsModal } from '../components/PastAttemptsModal'
import { useToast } from '../context/ToastContext'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [exams, setExams] = useState<ExamListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedExamForHistory, setSelectedExamForHistory] = useState<ExamListItem | null>(null)
  const [startingExamId, setStartingExamId] = useState<number | null>(null)

  const fetchExams = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getExams()
      setExams(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch exams from server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExams()
  }, [])

  const handleStartAttempt = async (exam: ExamListItem, forceNew = false) => {
    try {
      setStartingExamId(exam.id)
      const res = await api.startExamAttempt(exam.id, forceNew)
      navigate(`/attempts/${res.attempt_id}`)
    } catch (err: any) {
      toast({
        title: 'Error starting attempt',
        description: err.message || 'Could not initiate test session',
        type: 'error',
      })
    } finally {
      setStartingExamId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white warm:text-warm-950">
            Mock Test Library
          </h1>
          <p className="text-sm mt-1 text-slate-600 dark:text-slate-400 warm:text-warm-700">
            Local-first SSC CGL Tier-1 test series with real-time auto-save and deep action analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchExams}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 transition-colors"
            title="Refresh exam list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 warm:bg-warm-800 warm:hover:bg-warm-900 text-white shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Upload New Mock</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/50 warm:bg-warm-200/50 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 max-w-xl mx-auto text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-base">Backend Connection Notice</h3>
          <p className="text-xs">{error}</p>
          <button
            onClick={fetchExams}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 warm:border-warm-300 bg-white/50 dark:bg-slate-900/50 warm:bg-warm-50/50 max-w-xl mx-auto space-y-4">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950">No Exams Available</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700 mt-1">
              Upload your first SSC CGL mock test JSON using the Admin & Upload Hub.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Go to Admin & Upload Hub</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map(exam => {
            const hasActiveAttempt = exam.active_attempt_id !== null
            const maxScore = exam.question_count * exam.positive_marks

            return (
              <div
                key={exam.id}
                className="group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 hover:shadow-lg
                  bg-white border-slate-200/90 hover:border-slate-300
                  dark:bg-slate-900/90 dark:border-slate-800 dark:hover:border-slate-700
                  warm:bg-warm-50 warm:border-warm-300 warm:hover:border-warm-400"
              >
                {/* Active in-progress banner */}
                {hasActiveAttempt && (
                  <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-500 text-white shadow-sm flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    Attempt In Progress
                  </div>
                )}

                <div className="p-6">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 warm:bg-warm-200 warm:text-warm-900">
                      <Clock className="w-3.5 h-3.5" />
                      {exam.duration_minutes} Mins
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 warm:bg-warm-200 warm:text-warm-800">
                      +{exam.positive_marks} / -{exam.negative_marks}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950 line-clamp-2 min-h-[3.5rem]">
                    {exam.title}
                  </h3>

                  {/* Sections list */}
                  <div className="mt-3 flex flex-wrap gap-1.5 min-h-[2rem]">
                    {exam.sections.map(sec => (
                      <span
                        key={sec}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 warm:bg-warm-200/70 warm:text-warm-800 truncate max-w-[150px]"
                      >
                        {sec}
                      </span>
                    ))}
                  </div>

                  {/* Stats Row */}
                  <div className="mt-5 grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 warm:border-warm-200 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 warm:text-warm-600 block text-[11px]">Questions</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white warm:text-warm-950">
                        {exam.question_count} <span className="text-[11px] font-normal text-slate-400">({maxScore} pts)</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 warm:text-warm-600 block text-[11px]">Highest Score</span>
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        {exam.highest_score !== null ? `${exam.highest_score} / ${maxScore}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 bg-slate-50/70 dark:bg-slate-950/40 warm:bg-warm-100/60 rounded-b-2xl border-t border-slate-100 dark:border-slate-800/80 warm:border-warm-200/80 flex flex-col gap-2">
                  {hasActiveAttempt ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/attempts/${exam.active_attempt_id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Resume Attempt</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('An attempt is already in progress. Starting a new attempt will retain your previous attempt in history. Continue?')) {
                            handleStartAttempt(exam, true)
                          }
                        }}
                        disabled={startingExamId === exam.id}
                        className="py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 text-slate-700 dark:text-slate-200 warm:text-warm-900 transition-colors"
                        title="Start a fresh attempt"
                      >
                        <span>Start Fresh</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartAttempt(exam, false)}
                      disabled={startingExamId === exam.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white
                        bg-indigo-600 hover:bg-indigo-700
                        dark:bg-indigo-500 dark:hover:bg-indigo-600
                        warm:bg-warm-800 warm:hover:bg-warm-900
                        transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{startingExamId === exam.id ? 'Starting Session...' : 'Start New Attempt'}</span>
                    </button>
                  )}

                  {/* Past Reports Button */}
                  <button
                    onClick={() => setSelectedExamForHistory(exam)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700 hover:text-slate-900 dark:hover:text-white warm:hover:text-warm-950 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Past Reports ({exam.attempt_count})</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Past Attempts Modal */}
      {selectedExamForHistory && (
        <PastAttemptsModal
          exam={selectedExamForHistory}
          onClose={() => setSelectedExamForHistory(null)}
        />
      )}
    </div>
  )
}

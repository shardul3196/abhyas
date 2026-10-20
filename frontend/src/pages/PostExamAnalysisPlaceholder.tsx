import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Award, ArrowLeft, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatTime } from '../lib/utils'

export const PostExamAnalysisPlaceholder: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [analysis, setAnalysis] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attemptId) return
    const fetchAnalysis = async () => {
      try {
        setLoading(true)
        const data = await api.getAttemptAnalysis(parseInt(attemptId, 10))
        setAnalysis(data)
      } catch (err) {
        // quiet fallback
      } finally {
        setLoading(false)
      }
    }
    fetchAnalysis()
  }, [attemptId])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/80 warm:bg-warm-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-sm">
        <Award className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 warm:bg-warm-200 warm:text-warm-800">
          Screen 3A • Post-Exam Review
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
          Attempt #{attemptId} Score & Analysis
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700 max-w-lg mx-auto">
          The full interactive Bento summary, 4-Quadrant Topic Action Matrix, and solution walkthrough with KaTeX explanations will be built in <strong>Phase 5</strong>.
        </p>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : analysis?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Total Score</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white warm:text-warm-950">
              {analysis.summary.total_score} <span className="text-xs text-slate-400 font-normal">/ {analysis.summary.max_score}</span>
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Accuracy</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {analysis.summary.accuracy_pct}%
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">C / W / U</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 warm:text-warm-900 block mt-1">
              {analysis.summary.correct_count} / {analysis.summary.incorrect_count} / {analysis.summary.unattempted_count}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Time Spent</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 warm:text-warm-900 block mt-1">
              {formatTime(analysis.summary.total_time_spent_sec)}
            </span>
          </div>
        </div>
      )}

      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  )
}

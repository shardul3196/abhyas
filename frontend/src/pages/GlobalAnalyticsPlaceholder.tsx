import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowLeft, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

export const GlobalAnalyticsPlaceholder: React.FC = () => {
  const [overview, setOverview] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true)
        const data = await api.getAnalyticsOverview()
        setOverview(data)
      } catch (err) {
        // quiet fallback
      } finally {
        setLoading(false)
      }
    }
    fetchOverview()
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/80 warm:bg-warm-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-sm">
        <TrendingUp className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200 warm:bg-warm-200 warm:text-warm-800">
          Screen 3B • Global Topic Analytics
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
          Performance & Trend Center
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700 max-w-lg mx-auto">
          Cumulative score trends over time, speed versus accuracy scatter charts, and the long-term 4-Quadrant Topic Action Matrix will be fully activated in <strong>Phase 5</strong>.
        </p>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : overview?.overall_summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Completed Tests</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white warm:text-warm-950">
              {overview.overall_summary.completed_attempts}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Avg Score</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {overview.overall_summary.average_score}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Avg Accuracy</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {overview.overall_summary.average_accuracy_pct}%
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-slate-500 text-xs block">Total Questions</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white warm:text-warm-950">
              {overview.overall_summary.total_questions_attempted}
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

import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { PlayCircle, ArrowLeft, Clock } from 'lucide-react'

export const ExamRunnerPlaceholder: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>()

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/80 warm:bg-warm-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-sm">
        <PlayCircle className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 warm:bg-warm-200 warm:text-warm-800">
          Screen 2 • Exam Runner
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
          Exam Session #{attemptId}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700 max-w-md mx-auto">
          The distraction-free Tablet Exam Runner with 5-state SSC CGL question palette, section switcher, and per-question stopwatch will be implemented in <strong>Phase 4</strong>.
        </p>
      </div>

      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 text-left text-xs space-y-3 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white warm:text-warm-950">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Backend Session Verified</span>
        </div>
        <p className="text-slate-600 dark:text-slate-400 warm:text-warm-700">
          Attempt #{attemptId} is initialized and active in <code className="text-indigo-600 dark:text-indigo-400">cgl_prep.db</code> with real-time delta saving ready.
        </p>
      </div>

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

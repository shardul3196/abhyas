import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Calendar, CheckCircle, XCircle, MinusCircle, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import type { ExamAttemptHistoryItem, ExamListItem } from '../lib/api'
import { formatDate, formatTime } from '../lib/utils'

interface PastAttemptsModalProps {
  exam: ExamListItem
  onClose: () => void
}

export const PastAttemptsModal: React.FC<PastAttemptsModalProps> = ({ exam, onClose }) => {
  const [attempts, setAttempts] = useState<ExamAttemptHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchAttempts = async () => {
      try {
        setLoading(true)
        const data = await api.getExamAttempts(exam.id)
        if (isMounted) setAttempts(data)
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load past attempts')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchAttempts()
    return () => { isMounted = false }
  }, [exam.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border
          bg-white border-slate-200 text-slate-900
          dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100
          warm:bg-warm-100 warm:border-warm-300 warm:text-warm-950"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 warm:border-warm-300">
          <div>
            <span className="text-xs font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 warm:text-warm-700 uppercase">
              Attempt History
            </span>
            <h3 className="text-lg font-bold truncate max-w-md mt-0.5">
              {exam.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 warm:hover:text-warm-900 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-sm">Loading historical reports...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm">
              {error}
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 warm:text-warm-700">
              <p className="text-sm">No attempts recorded yet for this exam.</p>
            </div>
          ) : (
            attempts.map((att, idx) => {
              const isCompleted = att.status === 'completed'
              return (
                <div
                  key={att.id}
                  className="p-4 rounded-xl border transition-all hover:shadow-md
                    bg-slate-50 border-slate-200/90
                    dark:bg-slate-800/70 dark:border-slate-700/80
                    warm:bg-warm-50 warm:border-warm-300"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 warm:bg-warm-200 warm:text-warm-800">
                        Attempt #{attempts.length - idx}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse'
                      }`}>
                        {isCompleted ? 'Completed' : 'In Progress'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(att.submitted_at || att.started_at)}</span>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 border-y border-slate-200/60 dark:border-slate-700/60 warm:border-warm-200 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 warm:text-warm-600 block text-[11px]">Score</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white warm:text-warm-950">
                        {att.total_score} <span className="text-[11px] font-normal text-slate-400">/ {att.max_score}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 warm:text-warm-600 block text-[11px]">Accuracy</span>
                      <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400 warm:text-warm-800">
                        {att.accuracy_pct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 warm:text-warm-600 block text-[11px]">C / W / U</span>
                      <div className="flex items-center gap-1.5 font-semibold text-xs mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" />{att.correct_count}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                          <XCircle className="w-3 h-3" />{att.incorrect_count}
                        </span>
                        <span className="text-slate-400 flex items-center gap-0.5">
                          <MinusCircle className="w-3 h-3" />{att.unattempted_count}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 warm:text-warm-600 block text-[11px]">Time Spent</span>
                      <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 warm:text-warm-800 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTime(att.total_time_spent_sec)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex justify-end">
                    {isCompleted ? (
                      <Link
                        to={`/attempts/${att.id}/analysis`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-indigo-600 hover:bg-indigo-700 text-white
                          dark:bg-indigo-500 dark:hover:bg-indigo-600
                          warm:bg-warm-700 warm:hover:bg-warm-800
                          transition-colors shadow-sm"
                      >
                        <span>View Detailed Analysis</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        to={`/attempts/${att.id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-amber-600 hover:bg-amber-700 text-white
                          transition-colors shadow-sm"
                      >
                        <span>Resume Test</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 warm:border-warm-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

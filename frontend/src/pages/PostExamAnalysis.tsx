import React, { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Award,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Brain,
  Target,
  BarChart3,
  Sparkles,
  Search,
  Maximize2,
  X,
  TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import { api } from '../lib/api'
import type {
  AttemptAnalysisResponse,
  QuestionReviewItem,
  ActionBucketType,
} from '../lib/api'
import { formatTime, formatDate } from '../lib/utils'
import { MarkdownMathRenderer } from '../components/MarkdownMathRenderer'
import { useToast } from '../context/ToastContext'

type FilterStatus = 'all' | 'correct' | 'incorrect' | 'unattempted' | 'slow' | 'bookmarked'

export const PostExamAnalysis: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [data, setData] = useState<AttemptAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Question Walkthrough Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [collapsedExplanations, setCollapsedExplanations] = useState<Record<number, boolean>>({})

  // Image Lightbox Modal
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null)

  // Active matrix quadrant filter (optional drilldown)
  const [selectedMatrixBucket, setSelectedMatrixBucket] = useState<ActionBucketType | 'all'>('all')

  useEffect(() => {
    if (!attemptId) return
    const id = parseInt(attemptId, 10)
    if (isNaN(id)) {
      setError('Invalid attempt ID')
      setLoading(false)
      return
    }

    const fetchAnalysis = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await api.getAttemptAnalysis(id)
        setData(res)
      } catch (err: any) {
        setError(err.message || 'Failed to load attempt analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [attemptId])

  // Bookmark toggle
  const handleToggleBookmark = async (question: QuestionReviewItem) => {
    const prevStatus = question.is_bookmarked
    const newStatus = !prevStatus

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        questions: prev.questions.map((q) =>
          q.question_id === question.question_id ? { ...q, is_bookmarked: newStatus } : q
        ),
      }
    })

    try {
      await api.toggleBookmark(question.question_id)
      toast({
        title: newStatus ? 'Question Bookmarked' : 'Bookmark Removed',
        description: newStatus ? 'Added to your bookmarked revision set.' : 'Removed from your bookmarked questions.',
        type: 'info',
      })
    } catch {
      // Revert optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.question_id === question.question_id ? { ...q, is_bookmarked: prevStatus } : q
          ),
        }
      })
      toast({
        title: 'Action Failed',
        description: 'Failed to update bookmark status on server.',
        type: 'error',
      })
    }
  }

  const toggleExplanation = (questionId: number) => {
    setCollapsedExplanations((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }))
  }

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    if (!data) return []

    return data.questions.filter((q) => {
      // Status filter
      if (statusFilter === 'correct' && q.result_status !== 'correct') return false
      if (statusFilter === 'incorrect' && q.result_status !== 'incorrect') return false
      if (statusFilter === 'unattempted' && q.result_status !== 'unattempted') return false
      if (statusFilter === 'slow' && !q.is_slow && !q.is_over_90s) return false
      if (statusFilter === 'bookmarked' && !q.is_bookmarked) return false

      // Section filter
      if (sectionFilter !== 'all' && q.section !== sectionFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const qText = q.question_text.toLowerCase()
        const topic = q.topic.toLowerCase()
        const query = searchQuery.toLowerCase()
        if (!qText.includes(query) && !topic.includes(query) && !q.q_no.toString().includes(query)) {
          return false
        }
      }

      return true
    })
  }, [data, statusFilter, sectionFilter, searchQuery])

  // Count summaries for filter pills
  const counts = useMemo(() => {
    if (!data) return { all: 0, correct: 0, incorrect: 0, unattempted: 0, slow: 0, bookmarked: 0 }
    return {
      all: data.questions.length,
      correct: data.questions.filter((q) => q.result_status === 'correct').length,
      incorrect: data.questions.filter((q) => q.result_status === 'incorrect').length,
      unattempted: data.questions.filter((q) => q.result_status === 'unattempted').length,
      slow: data.questions.filter((q) => q.is_slow || q.is_over_90s).length,
      bookmarked: data.questions.filter((q) => q.is_bookmarked).length,
    }
  }, [data])

  // Section list
  const sections = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.questions.map((q) => q.section)))
  }, [data])

  // Chart data for sectional comparison
  const sectionalChartData = useMemo(() => {
    if (!data) return []
    return data.sectional_breakdown.map((s) => ({
      name: s.section.length > 18 ? s.section.substring(0, 16) + '...' : s.section,
      fullName: s.section,
      score: s.score,
      maxScore: s.max_score,
      accuracy: s.accuracy_pct,
      timeMin: Math.round(s.time_spent_sec / 60),
    }))
  }, [data])

  // Scatter chart data for Topic Action Matrix
  const scatterData = useMemo(() => {
    if (!data) return []
    return data.action_matrix.topics.map((t) => ({
      name: t.topic,
      section: t.section,
      time: Math.round(t.avg_time_sec),
      accuracy: Math.round(t.accuracy_pct),
      total: t.total_questions,
      bucket: t.bucket,
    }))
  }, [data])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700">
          Computing deep analytics & topic matrix...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 warm:bg-rose-100 flex items-center justify-center text-rose-600 mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white warm:text-warm-950">
          Analytics Not Available
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700">
          {error || 'Unable to load report for this attempt.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    )
  }

  const { summary, sectional_breakdown, action_matrix } = data

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 warm:border-warm-300">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Link to="/" className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span>/</span>
            <span>Attempt #{summary.attempt_id} Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
            {summary.exam_title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 warm:text-warm-700">
            Completed on {formatDate(summary.submitted_at || summary.started_at)} • Duration: {summary.duration_minutes} min • Marking Scheme: +{summary.positive_marks} / -{summary.negative_marks}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 text-xs font-semibold text-slate-700 dark:text-slate-200 warm:text-warm-900 shadow-sm hover:border-indigo-400 transition-colors"
          >
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span>Global Analytics</span>
          </Link>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            <span>Finish Review</span>
          </button>
        </div>
      </div>

      {/* 1. Bento-Grid Summary Header */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-500" />
          <span>Performance Overview</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Score */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Score
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
                  {summary.total_score}
                </span>
                <span className="text-sm text-slate-400 font-medium">
                  / {summary.max_score} ({summary.score_pct}%)
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 warm:border-warm-200 flex items-center justify-between text-xs">
              <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                +{summary.raw_positive_score} Raw
              </span>
              <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                -{summary.negative_penalty} Penalty
              </span>
            </div>
          </div>

          {/* Card 2: Accuracy & Counts */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Accuracy & Attempt Rate
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {summary.accuracy_pct}%
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  ({summary.attempt_rate_pct}% attempted)
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 warm:border-warm-200 flex items-center gap-1.5 text-xs font-medium">
              <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {summary.correct_count}
              </span>
              <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                <XCircle className="w-3 h-3 text-rose-600" /> {summary.incorrect_count}
              </span>
              <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-500" /> {summary.unattempted_count}
              </span>
            </div>
          </div>

          {/* Card 3: Time Efficiency */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Time Taken
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
                  {formatTime(summary.total_time_spent_sec)}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  / {summary.duration_minutes}m
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 warm:border-warm-200 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 warm:text-warm-700">
              <span>Avg/Q: <strong>{summary.avg_time_per_question_sec.toFixed(1)}s</strong></span>
              <span>Avg/Att: <strong>{summary.avg_time_per_attempted_sec.toFixed(1)}s</strong></span>
            </div>
          </div>

          {/* Card 4: High-Yield Summary */}
          <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 warm:border-warm-300 bg-gradient-to-br from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20 warm:bg-warm-100 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Quick Insight
              </span>
              <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300 warm:text-warm-900 leading-relaxed">
                {summary.accuracy_pct >= 80
                  ? 'Outstanding accuracy! Focus now on shaving seconds off high-calculation Quant questions.'
                  : summary.accuracy_pct >= 60
                  ? 'Solid foundation. Work on eliminating negative marks from rushed guesses in General Awareness and Reasoning.'
                  : 'Target concept clarity first. Review the Concept Gap topics below and avoid guessing under pressure.'}
              </p>
            </div>

            <div className="mt-4 pt-2 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <span>Pacing Threshold: {summary.slow_threshold_sec}s</span>
              <span>{summary.total_questions} Questions Total</span>
            </div>
          </div>
        </div>

        {/* Sectional Performance Breakdown: Chart + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Table */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span>Sectional Performance Comparison</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 warm:border-warm-200 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-2.5">Section</th>
                    <th className="pb-2.5 text-center">Att / Tot</th>
                    <th className="pb-2.5 text-center">Accuracy</th>
                    <th className="pb-2.5 text-center">Score</th>
                    <th className="pb-2.5 text-right">Time Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 warm:divide-warm-200">
                  {sectional_breakdown.map((sec) => (
                    <tr key={sec.section} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 warm:hover:bg-warm-100/50 transition-colors">
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200 warm:text-warm-900">
                        {sec.section}
                      </td>
                      <td className="py-3 text-center text-slate-600 dark:text-slate-400 warm:text-warm-700">
                        <span className="font-semibold text-slate-900 dark:text-white warm:text-warm-950">{sec.attempted}</span> / {sec.total_questions}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                            sec.accuracy_pct >= 75
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : sec.accuracy_pct >= 60
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {sec.accuracy_pct}%
                        </span>
                      </td>
                      <td className="py-3 text-center font-bold text-slate-900 dark:text-white warm:text-warm-950">
                        {sec.score} <span className="text-slate-400 font-normal">/ {sec.max_score}</span>
                      </td>
                      <td className="py-3 text-right font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700">
                        {formatTime(sec.time_spent_sec)} <span className="text-slate-400 text-[10px]">({sec.avg_time_sec.toFixed(0)}s/Q)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white warm:text-warm-950 mb-3 flex items-center justify-between">
              <span>Score vs Max by Section</span>
              <span className="text-xs font-normal text-slate-400">Recharts Visual</span>
            </h3>

            <div className="h-48 sm:h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [val, name === 'score' ? 'Your Score' : 'Max Score']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="score" name="Your Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maxScore" name="Max Score" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The 4-Quadrant "Topic Action Matrix" */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              <span>4-Quadrant Topic Action Matrix</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
              Categorizes topic performance across Accuracy and Speed to formulate targeted preparation strategies.
            </p>
          </div>

          {/* Bucket Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setSelectedMatrixBucket('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                selectedMatrixBucket === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 warm:bg-warm-200 hover:bg-slate-200'
              }`}
            >
              All Topics ({action_matrix.topics.length})
            </button>
            <button
              onClick={() => setSelectedMatrixBucket('concept_gap')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedMatrixBucket === 'concept_gap'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              Concept Gap ({action_matrix.buckets.concept_gap.length})
            </button>
            <button
              onClick={() => setSelectedMatrixBucket('silly_mistakes')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedMatrixBucket === 'silly_mistakes'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              Silly Mistakes ({action_matrix.buckets.silly_mistakes.length})
            </button>
            <button
              onClick={() => setSelectedMatrixBucket('needs_speed')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedMatrixBucket === 'needs_speed'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
              }`}
            >
              Needs Speed ({action_matrix.buckets.needs_speed.length})
            </button>
            <button
              onClick={() => setSelectedMatrixBucket('strong_zone')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedMatrixBucket === 'strong_zone'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              Strong Zone ({action_matrix.buckets.strong_zone.length})
            </button>
          </div>
        </div>

        {/* 4 Quadrants Visual Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quadrant 1: Concept Gap */}
          {(selectedMatrixBucket === 'all' || selectedMatrixBucket === 'concept_gap') && (
            <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 warm:border-rose-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center font-bold text-xs">
                    Q1
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                      Concept Gap
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Low Accuracy (&lt; 60%) + High Time — Needs fundamental study
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {action_matrix.buckets.concept_gap.length} Topics
                </span>
              </div>

              {action_matrix.buckets.concept_gap.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No topics in this quadrant. Great job!</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {action_matrix.buckets.concept_gap.map((item) => (
                    <div
                      key={item.topic}
                      className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 warm:bg-rose-50 border border-rose-100 dark:border-rose-900/40 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-200 warm:text-warm-900">
                          {item.topic} <span className="text-[10px] text-slate-400">({item.section})</span>
                        </span>
                        <span className="text-rose-600 font-bold">{item.accuracy_pct}% Acc</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{item.correct}/{item.total_questions} correct • Avg {item.avg_time_sec.toFixed(0)}s</span>
                        <span className="italic text-rose-700 dark:text-rose-400 font-medium">{item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quadrant 2: Silly Mistakes / Guessing */}
          {(selectedMatrixBucket === 'all' || selectedMatrixBucket === 'silly_mistakes') && (
            <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/60 warm:border-amber-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                    Q2
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      Silly Mistakes / Rushed
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Low Accuracy (&lt; 60%) + Low Time — Slow down & avoid guessing
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {action_matrix.buckets.silly_mistakes.length} Topics
                </span>
              </div>

              {action_matrix.buckets.silly_mistakes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No topics in this quadrant.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {action_matrix.buckets.silly_mistakes.map((item) => (
                    <div
                      key={item.topic}
                      className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 warm:bg-amber-50 border border-amber-100 dark:border-amber-900/40 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-200 warm:text-warm-900">
                          {item.topic} <span className="text-[10px] text-slate-400">({item.section})</span>
                        </span>
                        <span className="text-amber-600 font-bold">{item.accuracy_pct}% Acc</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{item.correct}/{item.total_questions} correct • Avg {item.avg_time_sec.toFixed(0)}s</span>
                        <span className="italic text-amber-700 dark:text-amber-400 font-medium">{item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quadrant 3: Needs Speed / Shortcuts */}
          {(selectedMatrixBucket === 'all' || selectedMatrixBucket === 'needs_speed') && (
            <div className="rounded-2xl border-2 border-sky-200 dark:border-sky-900/60 warm:border-sky-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
                    Q3
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-sky-700 dark:text-sky-300">
                      Needs Speed
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      High Accuracy (&ge; 75%) + High Time (&gt; 90s) — Learn shortcuts
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  {action_matrix.buckets.needs_speed.length} Topics
                </span>
              </div>

              {action_matrix.buckets.needs_speed.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No topics in this quadrant.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {action_matrix.buckets.needs_speed.map((item) => (
                    <div
                      key={item.topic}
                      className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 warm:bg-sky-50 border border-sky-100 dark:border-sky-900/40 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-200 warm:text-warm-900">
                          {item.topic} <span className="text-[10px] text-slate-400">({item.section})</span>
                        </span>
                        <span className="text-sky-600 font-bold">{item.accuracy_pct}% Acc</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{item.correct}/{item.total_questions} correct • Avg {item.avg_time_sec.toFixed(0)}s</span>
                        <span className="italic text-sky-700 dark:text-sky-400 font-medium">{item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quadrant 4: Strong Zone */}
          {(selectedMatrixBucket === 'all' || selectedMatrixBucket === 'strong_zone') && (
            <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 warm:border-emerald-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                    Q4
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      Strong Zone
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      High Accuracy (&ge; 75%) + Optimal Time — Maintain mastery
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {action_matrix.buckets.strong_zone.length} Topics
                </span>
              </div>

              {action_matrix.buckets.strong_zone.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No topics in this quadrant.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {action_matrix.buckets.strong_zone.map((item) => (
                    <div
                      key={item.topic}
                      className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 warm:bg-emerald-50 border border-emerald-100 dark:border-emerald-900/40 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-200 warm:text-warm-900">
                          {item.topic} <span className="text-[10px] text-slate-400">({item.section})</span>
                        </span>
                        <span className="text-emerald-600 font-bold">{item.accuracy_pct}% Acc</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{item.correct}/{item.total_questions} correct • Avg {item.avg_time_sec.toFixed(0)}s</span>
                        <span className="italic text-emerald-700 dark:text-emerald-400 font-medium">{item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visual Scatter Chart */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white warm:text-warm-950">
              Accuracy vs Time Scatter Distribution
            </h3>
            <span className="text-xs text-slate-400">X: Time (s) | Y: Accuracy (%)</span>
          </div>

          <div className="h-60 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" dataKey="time" name="Avg Time (s)" unit="s" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="accuracy" name="Accuracy (%)" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <ZAxis type="number" dataKey="total" range={[80, 240]} name="Questions" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const pt = payload[0].payload
                      return (
                        <div className="p-2.5 bg-slate-900 text-white rounded-xl text-xs space-y-1 shadow-lg">
                          <p className="font-bold">{pt.name}</p>
                          <p className="text-slate-300">{pt.section}</p>
                          <p className="text-indigo-300">Accuracy: {pt.accuracy}%</p>
                          <p className="text-slate-300">Avg Time: {pt.time}s</p>
                          <p className="text-slate-400 capitalize">Quadrant: {pt.bucket.replace('_', ' ')}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <ReferenceLine y={60} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '60% Target', fill: '#f43f5e', fontSize: 10 }} />
                <ReferenceLine x={90} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: '90s Threshold', fill: '#38bdf8', fontSize: 10 }} />
                <Scatter name="Topics" data={scatterData} fill="#6366f1" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3. Interactive Solution Walkthrough */}
      <section className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800 warm:border-warm-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-500" />
              <span>Interactive Solution Walkthrough</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
              Review full step-by-step solutions with KaTeX formulas, user choice comparison, and bookmark tricky questions.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search topic or question..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Filters Bar: Status Pills & Section Dropdown/Pills */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 warm:bg-warm-200 hover:bg-slate-200'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('incorrect')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'incorrect'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Incorrect ({counts.incorrect})</span>
            </button>
            <button
              onClick={() => setStatusFilter('unattempted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'unattempted'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unattempted ({counts.unattempted})</span>
            </button>
            <button
              onClick={() => setStatusFilter('slow')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'slow'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Slow &gt; 90s ({counts.slow})</span>
            </button>
            <button
              onClick={() => setStatusFilter('bookmarked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === 'bookmarked'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Bookmarked ({counts.bookmarked})</span>
            </button>
          </div>

          {/* Section Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Section:</span>
            <button
              onClick={() => setSectionFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                sectionFilter === 'all'
                  ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All
            </button>
            {sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSectionFilter(sec)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  sectionFilter === sec
                    ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Questions List */}
        {filteredQuestions.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 warm:border-warm-300">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No questions match the current filter selection.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredQuestions.map((q) => {
              const isCollapsed = !!collapsedExplanations[q.question_id]

              return (
                <div
                  key={q.question_id}
                  id={`q-${q.q_no}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm overflow-hidden transition-all"
                >
                  {/* Question Header Card */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 warm:border-warm-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white flex items-center justify-center font-bold text-xs">
                        #{q.q_no}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 warm:bg-warm-200 warm:text-warm-800">
                        {q.section}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                        {q.topic}
                      </span>

                      {/* Result Status Badge */}
                      {q.result_status === 'correct' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Correct (+{q.marks_awarded})
                        </span>
                      )}
                      {q.result_status === 'incorrect' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Incorrect ({q.marks_awarded})
                        </span>
                      )}
                      {q.result_status === 'unattempted' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> Unattempted (0.0)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Time Spent Pill */}
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatTime(q.time_spent_sec)}</span>
                        {(q.is_slow || q.is_over_90s) && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Slow
                          </span>
                        )}
                      </div>

                      {/* Bookmark Toggle */}
                      <button
                        onClick={() => handleToggleBookmark(q)}
                        className={`p-1.5 rounded-xl transition-colors ${
                          q.is_bookmarked
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={q.is_bookmarked ? 'Bookmarked' : 'Add bookmark'}
                      >
                        <Bookmark className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>

                  {/* Question Body */}
                  <div className="p-5 sm:p-6 space-y-6">
                    <div className="text-sm sm:text-base leading-relaxed text-slate-900 dark:text-slate-100 warm:text-warm-950">
                      <MarkdownMathRenderer content={q.question_text} />
                    </div>

                    {/* Question Image (if any) */}
                    {q.image_path && (
                      <div className="relative inline-block border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-w-md">
                        <img
                          src={q.image_path}
                          alt={`Question ${q.q_no} illustration`}
                          className="max-h-64 object-contain cursor-zoom-in"
                          onClick={() => setActiveLightboxImg(q.image_path)}
                        />
                        <button
                          onClick={() => setActiveLightboxImg(q.image_path)}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* 4 Option Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                        const optText =
                          optKey === 'A'
                            ? q.option_a
                            : optKey === 'B'
                            ? q.option_b
                            : optKey === 'C'
                            ? q.option_c
                            : q.option_d

                        const isCorrectOption = q.correct_option === optKey
                        const isUserChoice = q.selected_option === optKey

                        let cardClass =
                          'border-slate-200 dark:border-slate-800 warm:border-warm-200 bg-slate-50/50 dark:bg-slate-900/40 warm:bg-warm-100/40 text-slate-800 dark:text-slate-200'

                        if (isCorrectOption && isUserChoice) {
                          // User selected correctly
                          cardClass =
                            'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 warm:bg-emerald-50/80 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                        } else if (isCorrectOption) {
                          // Correct option (not chosen by user)
                          cardClass =
                            'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 warm:bg-emerald-50/50 text-emerald-900 dark:text-emerald-200'
                        } else if (isUserChoice) {
                          // Incorrect choice by user
                          cardClass =
                            'border-rose-400 bg-rose-50/60 dark:bg-rose-950/30 warm:bg-rose-50/60 text-rose-950 dark:text-rose-100 ring-1 ring-rose-400'
                        }

                        return (
                          <div
                            key={optKey}
                            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition-colors ${cardClass}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                                isCorrectOption
                                  ? 'bg-emerald-600 text-white'
                                  : isUserChoice
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {optKey}
                            </span>

                            <div className="flex-1 leading-normal">
                              <MarkdownMathRenderer content={optText} />
                            </div>

                            {/* Indicator pills */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {isCorrectOption && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" /> Correct
                                </span>
                              )}
                              {isUserChoice && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                    isCorrectOption
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isCorrectOption ? 'Your Choice' : 'Your Answer'}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Detailed Explanation Box */}
                    <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 warm:border-warm-300 bg-indigo-50/30 dark:bg-indigo-950/20 warm:bg-warm-100 overflow-hidden">
                      <button
                        onClick={() => toggleExplanation(q.question_id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-300 warm:text-warm-900 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <span>Detailed Solution & Explanation</span>
                        </span>
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <ChevronUp className="w-4 h-4 text-indigo-500" />
                        )}
                      </button>

                      {!isCollapsed && (
                        <div className="p-4 pt-1 border-t border-indigo-100 dark:border-indigo-900/40 warm:border-warm-200 text-xs sm:text-sm text-slate-800 dark:text-slate-200 warm:text-warm-900 leading-relaxed">
                          <MarkdownMathRenderer content={q.explanation} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Image Lightbox Modal */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
            <button
              onClick={() => setActiveLightboxImg(null)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={activeLightboxImg}
              alt="Zoomed question illustration"
              className="max-h-[85vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
export default PostExamAnalysis

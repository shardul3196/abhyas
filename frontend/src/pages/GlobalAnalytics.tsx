import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Award,
  Clock,
  Target,
  BarChart3,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { api } from '../lib/api'
import type {
  GlobalAnalyticsOverviewResponse,
  ActionBucketType,
} from '../lib/api'
import { formatTime } from '../lib/utils'

export const GlobalAnalytics: React.FC = () => {
  const [data, setData] = useState<GlobalAnalyticsOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<ActionBucketType | 'all'>('all')

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await api.getAnalyticsOverview()
        setData(res)
      } catch (err: any) {
        setError(err.message || 'Failed to load global analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchOverview()
  }, [])

  // Section chart data
  const sectionalChartData = useMemo(() => {
    if (!data) return []
    return data.sectional_breakdown.map((s) => ({
      name: s.section.length > 18 ? s.section.substring(0, 16) + '...' : s.section,
      fullName: s.section,
      accuracy: s.accuracy_pct,
      avgTime: Math.round(s.avg_time_sec),
      totalQuestions: s.total_questions,
      score: s.score,
    }))
  }, [data])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700">
          Aggregating global historical mock test data...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 warm:bg-rose-100 flex items-center justify-center text-rose-600 mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white warm:text-warm-950">
          Analytics Unavailable
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700">
          {error || 'Unable to load cumulative analytics.'}
        </p>
      </div>
    )
  }

  const { overall_summary, score_trend, sectional_breakdown, action_matrix, top_weak_topics, top_slow_topics } = data

  // Empty state: no completed attempts yet
  if (overall_summary.total_completed_attempts === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 warm:bg-warm-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-sm">
          <TrendingUp className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
            No Completed Attempts Yet
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 warm:text-warm-700 max-w-md mx-auto">
            Take and submit your first SSC CGL mock test from the Dashboard to unlock cumulative accuracy trends, speed breakdowns, and the 4-Quadrant Topic Action Matrix.
          </p>
        </div>
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white font-bold text-sm shadow hover:opacity-90 transition-opacity"
          >
            <span>Go to Mock Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 warm:border-warm-300">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Screen 3B • Long-Term Readiness Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950">
            Global Topic & Performance Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 warm:text-warm-700">
            Cross-exam performance trends, cumulative sectional accuracy, speed benchmarks, and long-term Topic Action Matrix.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
        >
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* 1. Overall Performance Banner (Bento Grid) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-500" />
          <span>Cumulative Metrics Across All Tests</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Completed Tests
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950 block mt-1">
              {overall_summary.total_completed_attempts}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Across {overall_summary.total_exams_attempted} exams
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Overall Accuracy
            </span>
            <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 block mt-1">
              {overall_summary.overall_accuracy_pct}%
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {overall_summary.total_correct} / {overall_summary.total_attempted} correct
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Average Score
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950 block mt-1">
              {overall_summary.average_score.toFixed(1)}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Peak: {overall_summary.highest_score ?? 'N/A'}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Questions Solved
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950 block mt-1">
              {overall_summary.total_attempted}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              of {overall_summary.total_questions_seen} seen
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Practice Time
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950 block mt-1">
              {formatTime(overall_summary.total_time_spent_sec)}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Active test time
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Avg Pace / Question
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white warm:text-warm-950 block mt-1">
              {overall_summary.avg_time_per_question_sec.toFixed(0)}s
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Target: &le; 54s for CGL
            </span>
          </div>
        </div>
      </section>

      {/* 2. Historical Score Trend Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              <span>Historical Score & Accuracy Progression</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
              Tracking your raw score and accuracy trajectory across consecutive mock sessions.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {score_trend.length} Mock Data Points
          </span>
        </div>

        <div className="h-64 sm:h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={score_trend} margin={{ top: 10, right: 20, left: -15, bottom: 20 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date_label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: '0.75rem',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(val: any, name: any) => [
                  name === 'Accuracy' ? `${val}%` : `${val} pts`,
                  name,
                ]}
                labelFormatter={(_label, items) => {
                  if (items && items.length > 0) {
                    const p = items[0].payload
                    return `Attempt #${p.attempt_number}: ${p.exam_title}`
                  }
                  return ''
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_score"
                name="Score"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#scoreGrad)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="accuracy_pct"
                name="Accuracy"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#accGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 3. Global Sectional Speed & Accuracy Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <span>Cumulative Sectional Breakdown</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 warm:border-warm-200 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-2.5">Section</th>
                  <th className="pb-2.5 text-center">Questions</th>
                  <th className="pb-2.5 text-center">Accuracy</th>
                  <th className="pb-2.5 text-center">Avg Time</th>
                  <th className="pb-2.5 text-right">Score Contrib</th>
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
                    <td className="py-3 text-center font-medium text-slate-600 dark:text-slate-400 warm:text-warm-700">
                      {sec.avg_time_sec.toFixed(0)}s / Q
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white warm:text-warm-950">
                      {sec.score} <span className="text-slate-400 font-normal">/ {sec.max_score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section Accuracy Chart */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white warm:text-warm-950 mb-3 flex items-center justify-between">
            <span>Accuracy % by Section</span>
            <span className="text-xs font-normal text-slate-400">Target &ge; 75%</span>
          </h3>

          <div className="h-48 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionalChartData} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Accuracy']}
                />
                <Bar dataKey="accuracy" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 4. High-Priority Alert Cards: Top Weak Topics & Top Slow Topics */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Weak Topics */}
        <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 warm:border-rose-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Top Priority Weak Topics
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lowest cumulative accuracy across all mock attempts
              </p>
            </div>
          </div>

          {top_weak_topics.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No weak topics identified!</p>
          ) : (
            <div className="space-y-2">
              {top_weak_topics.map((t) => (
                <div
                  key={t.topic}
                  className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 warm:bg-rose-50 border border-rose-100 dark:border-rose-900/40 text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-800 dark:text-slate-200 warm:text-warm-900">
                      {t.topic} <span className="text-[10px] text-slate-400">({t.section})</span>
                    </span>
                    <span className="text-rose-600 font-bold">{t.accuracy_pct}% Acc</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{t.correct}/{t.total_questions} correct • Avg {t.avg_time_sec.toFixed(0)}s</span>
                    <span className="italic text-rose-700 dark:text-rose-400 font-medium">{t.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Slow Topics */}
        <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/60 warm:border-amber-300 bg-white dark:bg-slate-900 warm:bg-warm-50 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                Top Time-Drain Topics
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Highest average seconds spent per question (&gt; 90s)
              </p>
            </div>
          </div>

          {top_slow_topics.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No excessively slow topics found!</p>
          ) : (
            <div className="space-y-2">
              {top_slow_topics.map((t) => (
                <div
                  key={t.topic}
                  className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 warm:bg-amber-50 border border-amber-100 dark:border-amber-900/40 text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-800 dark:text-slate-200 warm:text-warm-900">
                      {t.topic} <span className="text-[10px] text-slate-400">({t.section})</span>
                    </span>
                    <span className="text-amber-600 font-bold">{t.avg_time_sec.toFixed(0)}s / Q</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{t.accuracy_pct}% Acc ({t.correct}/{t.total_questions} correct)</span>
                    <span className="italic text-amber-700 dark:text-amber-400 font-medium">{t.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Cumulative Global Topic Action Matrix */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              <span>Cumulative Topic Action Matrix</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
              Aggregated across all completed tests to identify permanent strengths and revision priorities.
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setSelectedBucket('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                selectedBucket === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 warm:bg-warm-800 warm:text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Topics ({action_matrix.topics.length})
            </button>
            <button
              onClick={() => setSelectedBucket('concept_gap')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedBucket === 'concept_gap'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              Concept Gap ({action_matrix.buckets.concept_gap.length})
            </button>
            <button
              onClick={() => setSelectedBucket('silly_mistakes')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedBucket === 'silly_mistakes'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              Silly Mistakes ({action_matrix.buckets.silly_mistakes.length})
            </button>
            <button
              onClick={() => setSelectedBucket('needs_speed')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedBucket === 'needs_speed'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
              }`}
            >
              Needs Speed ({action_matrix.buckets.needs_speed.length})
            </button>
            <button
              onClick={() => setSelectedBucket('strong_zone')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                selectedBucket === 'strong_zone'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              Strong Zone ({action_matrix.buckets.strong_zone.length})
            </button>
          </div>
        </div>

        {/* 4 Quadrants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quadrant 1: Concept Gap */}
          {(selectedBucket === 'all' || selectedBucket === 'concept_gap') && (
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
                      Low Accuracy (&lt; 60%) + High Time — Needs revision
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {action_matrix.buckets.concept_gap.length} Topics
                </span>
              </div>

              {action_matrix.buckets.concept_gap.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No topics in this quadrant.</p>
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
          {(selectedBucket === 'all' || selectedBucket === 'silly_mistakes') && (
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
                      Low Accuracy (&lt; 60%) + Low Time — Avoid blind guesses
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

          {/* Quadrant 3: Needs Speed */}
          {(selectedBucket === 'all' || selectedBucket === 'needs_speed') && (
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
                      High Accuracy (&ge; 75%) + High Time (&gt; 90s) — Practice shortcuts
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
          {(selectedBucket === 'all' || selectedBucket === 'strong_zone') && (
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
      </section>
    </div>
  )
}

export default GlobalAnalytics

import React, { useEffect, useState, useMemo } from 'react'
import { 
  Bookmark, 
  BookmarkCheck, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  RefreshCw,
  Loader2,
  Sparkles
} from 'lucide-react'
import { api } from '../lib/api'
import type { BookmarkedQuestionItem } from '../lib/api'
import { MarkdownMathRenderer } from '../components/MarkdownMathRenderer'
import { useToast } from '../context/ToastContext'

export const BookmarksHub: React.FC = () => {
  const { toast } = useToast()
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedSection, setSelectedSection] = useState<string>('All')
  const [selectedTopic, setSelectedTopic] = useState<string>('All')

  // Expanded explanations state: set of question IDs
  const [expandedExplanations, setExpandedExplanations] = useState<Record<number, boolean>>({})

  // Unbookmarking loader
  const [unbookmarkingId, setUnbookmarkingId] = useState<number | null>(null)

  const fetchBookmarks = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getBookmarkedQuestions()
      setBookmarks(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load bookmarked questions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookmarks()
  }, [])

  // Dynamic filter options
  const sections = useMemo(() => {
    const set = new Set<string>()
    bookmarks.forEach(b => { if (b.section) set.add(b.section) })
    return ['All', ...Array.from(set)]
  }, [bookmarks])

  const topics = useMemo(() => {
    const set = new Set<string>()
    bookmarks.forEach(b => {
      if (selectedSection === 'All' || b.section === selectedSection) {
        if (b.topic) set.add(b.topic)
      }
    })
    return ['All', ...Array.from(set)]
  }, [bookmarks, selectedSection])

  // Filtered list
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter(b => {
      const matchSection = selectedSection === 'All' || b.section === selectedSection
      const matchTopic = selectedTopic === 'All' || b.topic === selectedTopic
      return matchSection && matchTopic
    })
  }, [bookmarks, selectedSection, selectedTopic])

  const handleToggleBookmark = async (question: BookmarkedQuestionItem) => {
    setUnbookmarkingId(question.id)
    try {
      await api.toggleBookmark(question.id)
      // Optimistically remove from list
      setBookmarks(prev => prev.filter(b => b.id !== question.id))
      toast({
        title: 'Removed from Bookmarks',
        description: `Question #${question.q_no} has been unbookmarked.`,
        type: 'info',
      })
    } catch (err: any) {
      toast({
        title: 'Failed to toggle bookmark',
        description: err.message,
        type: 'error',
      })
    } finally {
      setUnbookmarkingId(null)
    }
  }

  const toggleExplanation = (id: number) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 warm:text-warm-700" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white warm:text-warm-950">
              Bookmarked Questions Hub
            </h1>
          </div>
          <p className="text-sm mt-1 text-slate-600 dark:text-slate-400 warm:text-warm-700">
            Rapid revision notebook of all tricky questions saved across mock test sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchBookmarks}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 warm:text-warm-700">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span>Filter by:</span>
        </div>

        {/* Section Select */}
        <div className="flex items-center gap-1.5 text-xs">
          <label className="text-slate-600 dark:text-slate-400 warm:text-warm-700 font-medium">Section:</label>
          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value)
              setSelectedTopic('All')
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 warm:border-warm-300 bg-slate-50 dark:bg-slate-800 warm:bg-warm-100 text-xs font-medium text-slate-900 dark:text-white warm:text-warm-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sections.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Topic Select */}
        <div className="flex items-center gap-1.5 text-xs">
          <label className="text-slate-600 dark:text-slate-400 warm:text-warm-700 font-medium">Topic:</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 warm:border-warm-300 bg-slate-50 dark:bg-slate-800 warm:bg-warm-100 text-xs font-medium text-slate-900 dark:text-white warm:text-warm-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400 warm:text-warm-700">
          Showing <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredBookmarks.length}</span> question{filteredBookmarks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
          <p className="text-xs">Loading bookmarked questions...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-center text-sm">
          {error}
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 warm:border-warm-300 bg-white/50 dark:bg-slate-900/50 warm:bg-warm-50/50 max-w-lg mx-auto space-y-3">
          <Bookmark className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white warm:text-warm-950">
            No Bookmarked Questions Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
            {bookmarks.length === 0
              ? 'You have not bookmarked any questions yet. While taking an exam or reviewing past attempts, tap the Bookmark icon to save questions here for quick revision.'
              : 'No bookmarked questions match the selected Section and Topic filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredBookmarks.map((q) => {
            const isExpanded = !!expandedExplanations[q.id]
            const isDeleting = unbookmarkingId === q.id

            return (
              <div
                key={q.id}
                className="rounded-2xl border transition-all duration-200 shadow-sm hover:shadow
                  bg-white border-slate-200/90
                  dark:bg-slate-900 dark:border-slate-800
                  warm:bg-warm-50 warm:border-warm-300"
              >
                {/* Question Header Card */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 warm:border-warm-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm">
                      Q.{q.q_no}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 warm:bg-warm-200 warm:text-warm-800">
                      {q.section}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 warm:bg-warm-200 warm:text-warm-800">
                      {q.topic}{q.sub_topic ? ` • ${q.sub_topic}` : ''}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 warm:text-warm-600 ml-1">
                      From: <strong className="font-medium text-slate-600 dark:text-slate-300 warm:text-warm-900">{q.exam_title}</strong>
                    </span>
                  </div>

                  {/* Bookmark Removal Button */}
                  <button
                    onClick={() => handleToggleBookmark(q)}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                      bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100
                      dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 dark:hover:bg-amber-900/80
                      warm:bg-warm-200 warm:text-warm-900 warm:border-warm-400"
                    title="Remove from bookmarks"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>Bookmarked</span>
                  </button>
                </div>

                {/* Question Body */}
                <div className="p-6 space-y-4">
                  {/* Rich Text Question Text */}
                  <div className="text-sm sm:text-base text-slate-900 dark:text-slate-100 warm:text-warm-950 font-normal">
                    <MarkdownMathRenderer content={q.question_text} />
                  </div>

                  {/* Optional Image */}
                  {q.image_path && (
                    <div className="my-3">
                      <img
                        src={q.image_path.startsWith('http') ? q.image_path : `http://${window.location.hostname}:8000${q.image_path}`}
                        alt="Question Diagram"
                        className="max-h-64 rounded-xl border border-slate-200 dark:border-slate-700 warm:border-warm-300 object-contain"
                      />
                    </div>
                  )}

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { key: 'A', text: q.option_a },
                      { key: 'B', text: q.option_b },
                      { key: 'C', text: q.option_c },
                      { key: 'D', text: q.option_d },
                    ].map(opt => {
                      const isCorrect = q.correct_option === opt.key

                      return (
                        <div
                          key={opt.key}
                          className={`p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-100 warm:bg-emerald-900/10 warm:border-emerald-500'
                              : 'bg-slate-50/60 border-slate-200/80 text-slate-800 dark:bg-slate-800/40 dark:border-slate-700/70 dark:text-slate-200 warm:bg-warm-100/50 warm:border-warm-200'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 warm:bg-warm-200 warm:text-warm-800'
                          }`}>
                            {opt.key}
                          </span>

                          <div className="flex-1 text-xs sm:text-sm">
                            <MarkdownMathRenderer content={opt.text} />
                          </div>

                          {isCorrect && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 warm:text-emerald-700 flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Correct Answer
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Revealable Explanation Drawer */}
                <div className="border-t border-slate-100 dark:border-slate-800 warm:border-warm-200 bg-slate-50/60 dark:bg-slate-950/30 warm:bg-warm-100/40 rounded-b-2xl">
                  <button
                    onClick={() => toggleExplanation(q.id)}
                    className="w-full px-6 py-3 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 warm:text-warm-800 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Hide Solution & Step-by-Step Explanation' : 'Show Solution & Step-by-Step Explanation'}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-5 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800 warm:border-warm-200 animate-in fade-in duration-200">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 warm:text-warm-700">
                        Detailed Solution:
                      </div>
                      <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950/80 bg-indigo-50/40 dark:bg-indigo-950/20 warm:bg-warm-200/50 text-xs sm:text-sm text-slate-800 dark:text-slate-200 warm:text-warm-900 leading-relaxed">
                        <MarkdownMathRenderer content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState, useRef } from 'react'
import { 
  UploadCloud, 
  FileJson, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Trash2, 
  Loader2,
  RefreshCw,
  FileCode
} from 'lucide-react'
import { api } from '../lib/api'
import type { ExamListItem, ExamValidateResponse } from '../lib/api'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../lib/utils'

export const AdminHub: React.FC = () => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload & Validation States
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [validationResult, setValidationResult] = useState<ExamValidateResponse | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Exam List State
  const [exams, setExams] = useState<ExamListItem[]>([])
  const [loadingExams, setLoadingExams] = useState(false)
  const [deletingExamId, setDeletingExamId] = useState<number | null>(null)

  const fetchExams = async () => {
    try {
      setLoadingExams(true)
      const data = await api.getExams()
      setExams(data)
    } catch (err: any) {
      toast({
        title: 'Error loading exams',
        description: err.message,
        type: 'error',
      })
    } finally {
      setLoadingExams(false)
    }
  }

  useEffect(() => {
    fetchExams()
  }, [])

  // File Handlers
  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast({
        title: 'Invalid file format',
        description: 'Please upload a JSON file (.json)',
        type: 'error',
      })
      return
    }

    setSelectedFile(file)
    setValidationResult(null)

    // Pre-flight dry-run validation
    setIsValidating(true)
    try {
      const res = await api.validateExamFile(file)
      setValidationResult(res)
      if (res.valid) {
        toast({
          title: 'Validation Successful',
          description: `Payload verified cleanly: ${res.summary?.total_questions} questions ready for import.`,
          type: 'success',
        })
      } else {
        toast({
          title: 'Validation Errors Found',
          description: `Found ${res.errors.length} issue(s) in JSON structure.`,
          type: 'error',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Validation Request Failed',
        description: err.message || 'Server could not parse JSON',
        type: 'error',
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleConfirmImport = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    try {
      const res = await api.uploadExamFile(selectedFile)
      toast({
        title: 'Exam Imported Successfully!',
        description: `"${res.title}" with ${res.question_count} questions is now live.`,
        type: 'success',
      })
      // Reset upload state & refresh exam table
      setSelectedFile(null)
      setValidationResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchExams()
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.message,
        type: 'error',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteExam = async (exam: ExamListItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${exam.title}"? All questions, attempts, and responses will be deleted.`)) {
      return
    }

    setDeletingExamId(exam.id)
    try {
      await api.deleteExam(exam.id)
      toast({
        title: 'Exam Deleted',
        description: `"${exam.title}" has been deleted.`,
        type: 'info',
      })
      await fetchExams()
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message,
        type: 'error',
      })
    } finally {
      setDeletingExamId(null)
    }
  }

  const handleDownloadSample = () => {
    const samplePayload = {
      exam_title: "SSC CGL 2026 Tier-1 Mock Test (Sample)",
      duration_minutes: 60,
      positive_marks: 2.0,
      negative_marks: 0.5,
      questions: [
        {
          q_no: 1,
          section: "Quantitative Aptitude",
          topic: "Profit & Loss",
          sub_topic: "Successive Discounts",
          question_text: "A trader marks an article $30\\%$ above cost price and allows a discount of $10\\%$. Find his net profit percentage.",
          option_a: "17%",
          option_b: "18%",
          option_c: "20%",
          option_d: "15%",
          correct_option: "A",
          explanation: "Let Cost Price = $100$.\nMarked Price = $130$.\nSelling Price = $130 \\times 0.9 = 117$.\nProfit = $117 - 100 = 17\\%$."
        },
        {
          q_no: 2,
          section: "General Intelligence & Reasoning",
          topic: "Number Series",
          sub_topic: "Difference Series",
          question_text: "Select the number that can replace the question mark (?) in the following series:\n\n`4, 7, 12, 19, 28, ?`",
          option_a: "37",
          option_b: "39",
          option_c: "41",
          option_d: "35",
          correct_option: "B",
          explanation: "The differences between consecutive terms are odd numbers: $+3, +5, +7, +9, +11$.\nNext term = $28 + 11 = 39$."
        },
        {
          q_no: 3,
          section: "English Comprehension",
          topic: "Vocabulary",
          sub_topic: "Antonyms",
          question_text: "Select the most appropriate **ANTONYM** of the given word:\n\n**CANDID**",
          option_a: "Blunt",
          option_b: "Devious",
          option_c: "Sincere",
          option_d: "Frank",
          correct_option: "B",
          explanation: "**Candid** means truthful and straightforward; frank.\n**Devious** means showing a skillful use of underhanded tactics to achieve goals, which is the direct antonym."
        },
        {
          q_no: 4,
          section: "General Awareness",
          topic: "Indian Polity",
          sub_topic: "Fundamental Rights",
          question_text: "Which Article of the Constitution of India provides the Right to Constitutional Remedies, often termed the 'Heart and Soul' of the Constitution by Dr. B.R. Ambedkar?",
          option_a: "Article 21",
          option_b: "Article 19",
          option_c: "Article 32",
          option_d: "Article 14",
          correct_option: "C",
          explanation: "**Article 32** empowers citizens to approach the Supreme Court directly for the enforcement of Fundamental Rights via writs (Habeas Corpus, Mandamus, Prohibition, Quo-Warranto, Certiorari)."
        }
      ]
    }

    const blob = new Blob([JSON.stringify(samplePayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_ssc_cgl_mock_template.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white warm:text-warm-950">
            Admin & Upload Hub
          </h1>
          <p className="text-sm mt-1 text-slate-600 dark:text-slate-400 warm:text-warm-700">
            Import new JSON question banks, dry-run validate schemas, and manage active exams.
          </p>
        </div>

        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 warm:border-warm-300 bg-white dark:bg-slate-800 warm:bg-warm-100 hover:bg-slate-50 dark:hover:bg-slate-700 warm:hover:bg-warm-200 text-slate-700 dark:text-slate-200 warm:text-warm-900 shadow-sm transition-colors"
        >
          <Download className="w-4 h-4 text-indigo-500" />
          <span>Download Sample JSON Template</span>
        </button>
      </div>

      {/* Upload & Validation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Drag & Drop Zone */}
        <div className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-indigo-500" />
            <span>Upload Mock Test JSON</span>
          </h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer relative p-8 sm:p-10 border-2 border-dashed rounded-3xl text-center transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 warm:bg-warm-200/50'
                : 'border-slate-300 dark:border-slate-700 warm:border-warm-400 bg-white dark:bg-slate-900 warm:bg-warm-50 hover:border-indigo-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0])
                }
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 warm:bg-warm-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileJson className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white warm:text-warm-950">
                  {selectedFile ? selectedFile.name : 'Drag and drop your exam .json file here'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700 mt-1">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — Click to change file`
                    : 'or browse to select from your device'}
                </p>
              </div>

              {isValidating && (
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running strict pre-flight validation...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pre-Flight Validation Results */}
        <div className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white warm:text-warm-950 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Pre-Flight Validation Status</span>
          </h2>

          {!validationResult && !isValidating && (
            <div className="h-48 rounded-3xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-slate-50 dark:bg-slate-900/40 warm:bg-warm-50 flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500 warm:text-warm-600">
              <FileCode className="w-8 h-8 mb-2 opacity-60" />
              <p className="text-xs">Select or drop a JSON file to inspect question errors & dry-run validate.</p>
            </div>
          )}

          {validationResult && validationResult.valid && (
            <div className="p-6 rounded-3xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 warm:bg-emerald-900/10 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    Schema Passed Cleanly
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  Ready to Import
                </span>
              </div>

              {validationResult.summary && (
                <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 warm:text-warm-900">
                  <div className="font-bold text-sm text-slate-900 dark:text-white warm:text-warm-950">
                    {validationResult.summary.title}
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-emerald-200 dark:border-emerald-900/60 text-center">
                    <div>
                      <span className="block text-[11px] text-slate-500">Duration</span>
                      <span className="font-bold">{validationResult.summary.duration_minutes} Mins</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500">Questions</span>
                      <span className="font-bold">{validationResult.summary.total_questions} Qs</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500">Marking</span>
                      <span className="font-bold">+{validationResult.summary.positive_marks} / -{validationResult.summary.negative_marks}</span>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold block mb-1">Section Distribution:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(validationResult.summary.sections || {}).map(([sec, count]) => (
                        <span key={sec} className="px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800 font-medium">
                          {sec}: <strong className="text-emerald-600 dark:text-emerald-400">{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirmImport}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Import Exam to Database</span>
                  </>
                )}
              </button>
            </div>
          )}

          {validationResult && !validationResult.valid && (
            <div className="p-6 rounded-3xl border border-rose-300 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 warm:bg-rose-900/10 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm">
                  Validation Failed ({validationResult.errors.length} Errors Found)
                </h3>
              </div>

              <p className="text-xs text-rose-600 dark:text-rose-300">
                Please fix the following question-level schema issues before importing:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {validationResult.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800 text-xs font-mono text-rose-800 dark:text-rose-200"
                  >
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exam Management Table */}
      <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800 warm:border-warm-300">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white warm:text-warm-950">
              Exam Database Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 warm:text-warm-700">
              Manage existing exams in <code className="text-indigo-600 dark:text-indigo-400">cgl_prep.db</code>. Deleting an exam cascade-deletes all its questions and attempts.
            </p>
          </div>

          <button
            onClick={fetchExams}
            disabled={loadingExams}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 warm:border-warm-300 hover:bg-slate-100 dark:hover:bg-slate-800 warm:hover:bg-warm-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingExams ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loadingExams ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-2xl">
            No exams in database.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-white dark:bg-slate-900 warm:bg-warm-50 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-slate-50/70 dark:bg-slate-800/50 warm:bg-warm-100 text-slate-600 dark:text-slate-400 warm:text-warm-800 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Exam Title</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Questions</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 warm:divide-warm-200 text-slate-800 dark:text-slate-200 warm:text-warm-900">
                {exams.map(exam => (
                  <tr key={exam.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 warm:hover:bg-warm-100/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      #{exam.id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold max-w-xs truncate">
                      {exam.title}
                    </td>
                    <td className="py-3.5 px-4">
                      {exam.duration_minutes} mins
                    </td>
                    <td className="py-3.5 px-4">
                      {exam.question_count} Qs
                    </td>
                    <td className="py-3.5 px-4">
                      {exam.attempt_count} attempts
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 warm:text-warm-700">
                      {formatDate(exam.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteExam(exam)}
                        disabled={deletingExamId === exam.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Delete Exam and all linked attempts"
                      >
                        {deletingExamId === exam.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

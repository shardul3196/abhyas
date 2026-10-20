import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { Navbar } from './components/Navbar'
import { Dashboard } from './pages/Dashboard'
import { AdminHub } from './pages/AdminHub'
import { BookmarksHub } from './pages/BookmarksHub'
import { ExamRunner } from './pages/ExamRunner'
import { PostExamAnalysis } from './pages/PostExamAnalysis'
import { GlobalAnalytics } from './pages/GlobalAnalytics'

const AppLayout: React.FC = () => {
  const location = useLocation()
  // Distraction-free: hide standard Navbar when in the active Exam Runner
  const isExamRunner = location.pathname.startsWith('/attempts/') && !location.pathname.endsWith('/analysis')

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0b0f19] warm:bg-[#f6f1e7] text-slate-900 dark:text-slate-100 warm:text-[#2d241e] transition-colors duration-150">
      {!isExamRunner && <Navbar />}
      <main className={isExamRunner ? 'flex-1 flex flex-col h-screen overflow-hidden' : 'flex-1 pb-16'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<AdminHub />} />
          <Route path="/bookmarks" element={<BookmarksHub />} />
          <Route path="/attempts/:attemptId" element={<ExamRunner />} />
          <Route path="/attempts/:attemptId/analysis" element={<PostExamAnalysis />} />
          <Route path="/analytics" element={<GlobalAnalytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App

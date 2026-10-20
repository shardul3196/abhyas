import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  BarChart3, 
  Bookmark, 
  UploadCloud, 
  Sun, 
  Moon, 
  BookOpen, 
  Database,
  Loader2
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import type { ThemeMode } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'

export const Navbar: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [isFlushing, setIsFlushing] = useState(false)

  const handleFlushCheckpoint = async () => {
    setIsFlushing(true)
    try {
      const res = await api.flushAndLockCheckpoint()
      const sizeKb = (res.db_size_bytes / 1024).toFixed(1)
      toast({
        title: 'DB Flushed & Checkpointed for Git',
        description: `cgl_prep.db size: ${sizeKb} KB at ${new Date(res.timestamp).toLocaleTimeString()}`,
        type: 'success',
      })
    } catch (err: any) {
      toast({
        title: 'Flush Failed',
        description: err.message || 'Could not checkpoint WAL database',
        type: 'error',
      })
    } finally {
      setIsFlushing(false)
    }
  }

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { mode: 'warm', label: 'Warm', icon: <BookOpen className="w-4 h-4" /> },
  ]

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/analytics', label: 'Topic Analytics', icon: BarChart3 },
    { to: '/bookmarks', label: 'Bookmarked Questions', icon: Bookmark },
    { to: '/admin', label: 'Admin & Upload', icon: UploadCloud },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-900/90 warm:border-warm-300 warm:bg-warm-100/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 warm:bg-warm-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
              SSC
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-50 warm:text-warm-950 block leading-tight">
                Abhyas
              </span>
              <span className="text-[11px] font-medium tracking-wide text-indigo-600 dark:text-indigo-400 warm:text-warm-700 uppercase">
                SSC CGL Prep
              </span>
            </div>
          </div>

          {/* Desktop / Tablet Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white warm:bg-warm-200 warm:text-warm-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50 warm:text-warm-700 warm:hover:bg-warm-200/50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right Action Controls: Flush Button + Theme Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Flush & Lock DB Button */}
            <button
              onClick={handleFlushCheckpoint}
              disabled={isFlushing}
              title="Flush WAL and truncate database for clean Git commits"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 shadow-sm
                bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100
                dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/70
                warm:bg-warm-200 warm:border-warm-400 warm:text-warm-900 warm:hover:bg-warm-300/80
                disabled:opacity-50"
            >
              {isFlushing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span className="hidden sm:inline">Flush & Lock DB for Git</span>
              <span className="sm:hidden">Flush DB</span>
            </button>

            {/* Theme Selector Segmented Pill */}
            <div className="flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 warm:border-warm-300 bg-slate-100 dark:bg-slate-800/80 warm:bg-warm-200/60">
              {themeOptions.map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => setTheme(opt.mode)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    theme === opt.mode
                      ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white warm:bg-warm-50 warm:text-warm-950 shadow-sm font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 warm:text-warm-600'
                  }`}
                  title={`${opt.label} mode`}
                >
                  {opt.icon}
                  <span className="hidden lg:inline">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile / Small-Tablet Bottom Bar Links */}
        <div className="flex md:hidden items-center justify-between py-2 border-t border-slate-200/60 dark:border-slate-800/60 warm:border-warm-300 overflow-x-auto gap-2">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white warm:bg-warm-200 warm:text-warm-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50 warm:text-warm-700'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  )
}

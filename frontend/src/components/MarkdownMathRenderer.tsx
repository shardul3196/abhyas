import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { cn } from '../lib/utils'

interface MarkdownMathRendererProps {
  content: string
  className?: string
}

export const MarkdownMathRenderer: React.FC<MarkdownMathRendererProps> = ({
  content,
  className,
}) => {
  if (!content) return null

  return (
    <div className={cn('markdown-math-content prose max-w-none text-inherit leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-3 border rounded-lg border-slate-200 dark:border-slate-800 warm:border-warm-300">
              <table className="w-full text-left text-sm border-collapse" {...props} />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead className="bg-slate-100 dark:bg-slate-800 warm:bg-warm-200 text-xs uppercase font-semibold text-slate-700 dark:text-slate-300 warm:text-warm-800" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 warm:border-warm-300 font-semibold" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 warm:border-warm-200" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="my-1.5 last:mb-0 first:mt-0" {...props} />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold text-slate-900 dark:text-white warm:text-warm-950" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="list-disc pl-5 my-2 space-y-1" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />
          ),
          code: ({ ...props }) => (
            <code className="bg-slate-100 dark:bg-slate-800 warm:bg-warm-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// src/web/components/MarkdownRenderer.tsx
// Reusable markdown renderer — maps markdown elements to Tailwind-styled React components.
// Uses react-markdown with remark-gfm (tables, task lists, strikethrough) and
// remark-frontmatter (strips YAML frontmatter from display).

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import type { Components } from 'react-markdown'

interface Props {
  content: string
  className?: string
}

const components: Components = {
  // ── Headings ──────────────────────────────────
  h1: ({ children }) => (
    <h1 className="font-heading text-2xl font-medium text-gray-100 mt-8 mb-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-heading text-xl font-medium text-gray-100 mt-7 mb-2.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-heading text-lg font-medium text-gray-200 mt-6 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-heading text-base font-medium text-gray-200 mt-5 mb-1.5 first:mt-0">
      {children}
    </h4>
  ),

  // ── Body text ─────────────────────────────────
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-gray-300 mb-3">{children}</p>
  ),

  // ── Lists ─────────────────────────────────────
  ul: ({ children }) => (
    <ul className="list-disc ml-5 space-y-1.5 text-sm text-gray-300 mb-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 space-y-1.5 text-sm text-gray-300 mb-3">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // ── Code ──────────────────────────────────────
  pre: ({ children }) => (
    <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto mb-3">
      {children}
    </pre>
  ),
  code: ({ className, children, ...rest }) => {
    // react-markdown adds className="language-xxx" for fenced code blocks
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className="font-mono text-xs text-gray-200 leading-relaxed" {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code className="bg-gray-800 text-gray-200 px-1 py-0.5 rounded text-xs font-mono" {...rest}>
        {children}
      </code>
    )
  },

  // ── Tables ────────────────────────────────────
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-gray-600">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left text-gray-200 font-medium px-3 py-2">{children}</th>
  ),
  td: ({ children }) => (
    <td className="text-gray-300 px-3 py-1.5 border-b border-gray-800">{children}</td>
  ),

  // ── Block elements ────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-600 pl-4 text-gray-400 italic mb-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-700 my-6" />,

  // ── Links & images ────────────────────────────
  a: ({ children, href }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ''} className="max-w-full rounded-lg my-3" />
  ),

  // ── Inline ────────────────────────────────────
  strong: ({ children }) => <strong className="font-semibold text-gray-200">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
  del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,

  // ── Task lists (GFM) ──────────────────────────
  input: ({ checked, ...rest }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mr-1.5 accent-green-500"
      {...rest}
    />
  ),
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFrontmatter]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

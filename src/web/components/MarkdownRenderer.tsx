// src/web/components/MarkdownRenderer.tsx
// Reusable markdown renderer — maps markdown elements to Tailwind-styled React components.
// Uses react-markdown with remark-gfm (tables, task lists, strikethrough),
// remark-frontmatter (strips YAML frontmatter), and rehype-highlight (syntax highlighting).

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/atom-one-dark.css'
import type { Components } from 'react-markdown'

interface Props {
  content: string
  className?: string
}

const components: Components = {
  // ── Headings ──────────────────────────────────
  h1: ({ children }) => (
    <h1 className="font-heading text-2xl font-semibold text-gray-100 mt-8 mb-3 first:mt-0 pb-2 border-b border-gray-700/50">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-heading text-xl font-semibold text-gray-100 mt-7 mb-2.5 first:mt-0 pb-1.5 border-b border-gray-700/50">
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
    <ul className="list-disc ml-5 space-y-1.5 text-sm text-gray-300 mb-3 marker:text-gray-600">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 space-y-1.5 text-sm text-gray-300 mb-3 marker:text-gray-600">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // ── Code ──────────────────────────────────────
  pre: ({ children }) => (
    <pre className="bg-[#1e1e1e] border border-gray-700 rounded-lg p-4 overflow-x-auto mb-3">
      {children}
    </pre>
  ),
  code: ({ className, children, ...rest }) => {
    // react-markdown adds className="language-xxx" for fenced code blocks
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <code className={`font-mono text-xs leading-relaxed ${className}`} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code className="bg-gray-800/80 text-[#e06c75] px-1 py-0.5 rounded text-xs font-mono" {...rest}>
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
    <thead className="border-b-2 border-gray-600">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left text-gray-200 font-medium px-3 py-2">{children}</th>
  ),
  tbody: ({ children }) => (
    <tbody className="[&>tr:nth-child(even)]:bg-gray-800/30">{children}</tbody>
  ),
  td: ({ children }) => (
    <td className="text-gray-300 px-3 py-1.5 border-b border-gray-800">{children}</td>
  ),

  // ── Block elements ────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-600 pl-4 bg-gray-900/50 py-1 text-gray-400 italic mb-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-700 my-6" />,

  // ── Links & images ────────────────────────────
  a: ({ children, href }) => (
    <a href={href} className="text-[#7c8dff] hover:text-[#9aa5ff] underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ''} className="max-w-full rounded-lg my-3" />
  ),

  // ── Inline ────────────────────────────────────
  strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
  del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,

  // ── Task lists (GFM) ──────────────────────────
  input: ({ checked, ...rest }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mr-1.5 w-4 h-4 accent-purple-500"
      {...rest}
    />
  ),
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFrontmatter]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

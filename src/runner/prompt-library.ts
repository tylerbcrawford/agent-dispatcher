// src/runner/prompt-library.ts
import { readdirSync, readFileSync, existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import { stringify as stringifyYaml } from 'yaml'
import type { PromptTemplate, PromptSnippet, PromptLibrary, RunMode, ModelHint, ProviderId } from '../shared/types.js'

// --- Frontmatter parsing (replaces gray-matter) ---

interface ParsedFrontmatter {
  data: Record<string, unknown>
  content: string
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { data: {}, content: raw }
  return {
    data: parseYaml(match[1]) ?? {},
    content: match[2].trim(),
  }
}

// --- Loading ---

function parsePromptFile(filePath: string, layer: PromptTemplate['layer']): PromptTemplate {
  const raw = readFileSync(filePath, 'utf-8')
  const { data, content } = parseFrontmatter(raw)
  return {
    id: (data.id as string) ?? '',
    mode: data.mode as RunMode,
    label: (data.label as string) ?? (data.id as string) ?? '',
    description: (data.description as string) ?? '',
    prompt: content,
    defaultProfile: (data.default_profile as string) ?? 'standard',
    defaultTime: (data.default_time as number) ?? 60,
    defaultModel: (data.default_model as string) ?? 'sonnet',
    tags: (data.tags as string[]) ?? [],
    extends: data.extends as string | undefined,
    filePath,
    layer,
  }
}

function parseSnippetFile(filePath: string): PromptSnippet {
  const raw = readFileSync(filePath, 'utf-8')
  const { data, content } = parseFrontmatter(raw)
  return {
    id: (data.id as string) ?? '',
    label: (data.label as string) ?? '',
    description: (data.description as string) ?? '',
    content,
    tags: (data.tags as string[]) ?? [],
    filePath,
  }
}

function parseHintFile(filePath: string): ModelHint {
  const raw = readFileSync(filePath, 'utf-8')
  const { data, content } = parseFrontmatter(raw)
  return {
    id: (data.id as string) ?? '',
    provider: (data.provider as ProviderId) ?? 'claude',
    label: (data.label as string) ?? '',
    description: (data.description as string) ?? '',
    content,
    filePath,
  }
}

function loadMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => join(dir, f))
}

/** Load custom overrides from prompts/custom/ — returns map of mode → PromptTemplate */
function loadCustomOverrides(promptsDir: string): Map<string, PromptTemplate> {
  const customDir = join(promptsDir, 'custom')
  const overrides = new Map<string, PromptTemplate>()
  if (!existsSync(customDir)) return overrides
  for (const file of loadMarkdownFiles(customDir)) {
    const template = parsePromptFile(file, 'base')
    if (template.mode) overrides.set(template.mode, template)
  }
  return overrides
}

export function loadPromptLibrary(promptsDir: string): PromptLibrary {
  const bases = loadMarkdownFiles(join(promptsDir, 'base'))
    .map(f => parsePromptFile(f, 'base'))

  // Merge custom overrides onto bases
  const customOverrides = loadCustomOverrides(promptsDir)
  for (let i = 0; i < bases.length; i++) {
    const override = customOverrides.get(bases[i].mode)
    if (override) {
      // Use the custom prompt body but keep the base's metadata as fallback
      bases[i] = {
        ...bases[i],
        prompt: override.prompt,
        // Use custom frontmatter fields if present, fall back to base
        label: override.label || bases[i].label,
        description: override.description || bases[i].description,
        defaultProfile: override.defaultProfile || bases[i].defaultProfile,
        defaultTime: override.defaultTime || bases[i].defaultTime,
        defaultModel: override.defaultModel || bases[i].defaultModel,
        hasCustomOverride: true,
      }
    }
  }

  // Variants: scan subdirectories (one per mode)
  const variantsDir = join(promptsDir, 'variants')
  const variants: PromptTemplate[] = []
  if (existsSync(variantsDir)) {
    for (const entry of readdirSync(variantsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        variants.push(
          ...loadMarkdownFiles(join(variantsDir, entry.name)).map(f => parsePromptFile(f, 'variant'))
        )
      }
    }
  }

  const snippets = loadMarkdownFiles(join(promptsDir, 'snippets'))
    .map(f => parseSnippetFile(f))

  const taskSpecific = loadMarkdownFiles(join(promptsDir, 'task-specific'))
    .map(f => parsePromptFile(f, 'task-specific'))

  const modelHints = new Map<ProviderId, ModelHint>()
  for (const file of loadMarkdownFiles(join(promptsDir, 'hints'))) {
    const hint = parseHintFile(file)
    if (hint.provider) modelHints.set(hint.provider, hint)
  }

  return { bases, variants, snippets, taskSpecific, modelHints }
}

/** Save a custom prompt override for a mode. Optionally override model/time/profile metadata. */
export function saveCustomPrompt(
  promptsDir: string,
  mode: RunMode,
  content: string,
  meta?: { model?: string; time?: number; profile?: string }
): void {
  const customDir = join(promptsDir, 'custom')
  mkdirSync(customDir, { recursive: true })

  // Read the original base to preserve frontmatter structure
  const basePath = join(promptsDir, 'base', `${mode}.md`)
  let frontmatterData: Record<string, unknown> = { id: mode, mode }
  if (existsSync(basePath)) {
    const { data } = parseFrontmatter(readFileSync(basePath, 'utf-8'))
    frontmatterData = { ...data }
  }

  // Apply per-stage metadata overrides when provided (falls back to base otherwise)
  if (meta?.model) frontmatterData.default_model = meta.model
  if (meta?.time != null) frontmatterData.default_time = meta.time
  if (meta?.profile) frontmatterData.default_profile = meta.profile

  const yaml = stringifyYaml(frontmatterData).trim()
  const fileContent = `---\n${yaml}\n---\n\n${content}`
  writeFileSync(join(customDir, `${mode}.md`), fileContent, 'utf-8')
}

/** Delete a custom prompt override, falling back to base */
export function deleteCustomPrompt(promptsDir: string, mode: RunMode): void {
  const customPath = join(promptsDir, 'custom', `${mode}.md`)
  if (existsSync(customPath)) unlinkSync(customPath)
}

// --- Querying ---

export function getPromptsForMode(library: PromptLibrary, mode: RunMode): PromptTemplate[] {
  const base = library.bases.filter(b => b.mode === mode)
  const variants = library.variants.filter(v => v.mode === mode)
  const taskSpecific = library.taskSpecific.filter(t => t.mode === mode)
  return [...base, ...variants, ...taskSpecific]
}

// --- Composition ---

export interface PromptVars {
  id: number
  name: string
  description: string
  planContent: string | null
  projectName: string
  projectDescription: string
  projectFolder: string
  taskSlug: string
}

export function renderPrompt(template: string, vars: PromptVars): string {
  let result = template
    .replace(/\$\{id\}/g, String(vars.id))
    .replace(/\$\{name\}/g, vars.name)
    .replace(/\$\{description\}/g, vars.description)
    .replace(/\$\{projectName\}/g, vars.projectName)
    .replace(/\$\{projectDescription\}/g, vars.projectDescription)
    .replace(/\$\{projectFolder\}/g, vars.projectFolder)
    .replace(/\$\{taskSlug\}/g, vars.taskSlug)

  // Handle ${planContent ? 'truthy' + planContent : 'falsy'}
  result = result.replace(
    /\$\{planContent\s*\?\s*'([^']*?)'\s*\+\s*planContent\s*:\s*'([^']*?)'\}/g,
    (_, truthy, falsy) => vars.planContent ? truthy + vars.planContent : falsy
  )

  result = result.replace(/\$\{planContent\}/g, vars.planContent || '')

  return result
}

export function composePrompt(
  template: PromptTemplate,
  snippets: PromptSnippet[],
  vars: PromptVars,
  library?: PromptLibrary,
  modelHint?: ModelHint | null,
): string {
  let promptText = template.prompt

  // If variant extends a base, render the base and inject via ${basePrompt}
  if (template.extends && library) {
    const base = library.bases.find(b => b.id === template.extends)
    if (base) {
      const renderedBase = renderPrompt(base.prompt, vars)
      promptText = promptText.replace(/\$\{basePrompt\}/g, renderedBase)
    }
  }

  // Render variables
  let composed = renderPrompt(promptText, vars)

  // Append snippets
  if (snippets.length > 0) {
    composed += '\n\n' + snippets.map(s => s.content).join('\n\n')
  }

  // Append model hint (after snippets, before custom instructions)
  if (modelHint) {
    composed += '\n\n' + modelHint.content
  }

  return composed
}

export function taskToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

import { describe, it, expect } from 'vitest'
import { loadPromptLibrary, renderPrompt, composePrompt, taskToSlug } from '../prompt-library.js'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = resolve(__dirname, '../../../prompts')

describe('loadPromptLibrary', () => {
  it('loads all four base templates', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    expect(library.bases).toHaveLength(4)
    expect(library.bases.map(b => b.id).sort()).toEqual(['audit', 'fix', 'implement', 'plan'])
  })

  it('extracts frontmatter and prompt content', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    const plan = library.bases.find(b => b.id === 'plan')!
    expect(plan.label).toBe('Generate Plan')
    expect(plan.defaultProfile).toBe('plan')
    expect(plan.defaultTime).toBe(20)
    expect(plan.defaultModel).toBe('haiku')
    expect(plan.mode).toBe('plan')
    expect(plan.layer).toBe('base')
    expect(plan.prompt).toContain('[PLAN_READY]')
  })

  it('marks layer correctly for base vs variant', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    for (const base of library.bases) {
      expect(base.layer).toBe('base')
    }
  })

  it('loads variants and snippets from starter files', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    expect(library.variants.length).toBeGreaterThanOrEqual(1)
    expect(library.snippets.length).toBeGreaterThanOrEqual(3)
    expect(library.taskSpecific).toEqual([])
    // Verify the docker-service variant loaded correctly
    const dockerVariant = library.variants.find(v => v.id === 'implement-docker-service')
    expect(dockerVariant).toBeDefined()
    expect(dockerVariant!.extends).toBe('implement')
    expect(dockerVariant!.layer).toBe('variant')
  })
})

describe('getPromptsForMode', () => {
  it('returns base + variants for a given mode', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    const implPrompts = [
      ...library.bases.filter(b => b.mode === 'implement'),
      ...library.variants.filter(v => v.mode === 'implement'),
    ]
    expect(implPrompts.length).toBeGreaterThanOrEqual(1)
    expect(implPrompts[0].id).toBe('implement')
  })
})

describe('composePrompt', () => {
  it('composes base template with no snippets', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    const base = library.bases.find(b => b.id === 'implement')!
    const composed = composePrompt(base, [], {
      id: 1, name: 'Test Task', description: 'Test desc.',
      planContent: null, projectName: 'Website Redesign',
      projectFolder: 'projects/example', taskSlug: 'test-task',
      projectDescription: '',
    })
    expect(composed).toContain('Test Task')
    expect(composed).toContain('Website Redesign')
    expect(composed).toContain('Write tests first')
  })

  it('appends snippet content after base prompt', () => {
    const library = loadPromptLibrary(PROMPTS_DIR)
    const base = library.bases.find(b => b.id === 'implement')!
    const mockSnippet = {
      id: 'test-snippet', label: 'Test', description: 'Test snippet',
      content: '## Extra Rule\nDo the extra thing.', tags: [], filePath: '',
    }
    const composed = composePrompt(base, [mockSnippet], {
      id: 1, name: 'Test', description: '', planContent: null,
      projectName: 'Test', projectFolder: '', taskSlug: '',
      projectDescription: '',
    })
    expect(composed).toContain('Write tests first')  // base content
    expect(composed).toContain('Do the extra thing.') // snippet appended
  })
})

describe('renderPrompt', () => {
  it('interpolates task variables', () => {
    const template = 'Task: ${name}\nProject: ${projectName}\n${description}'
    const result = renderPrompt(template, {
      id: 1, name: 'API Key Rotation', description: 'Rotate all keys.',
      planContent: null, projectName: 'Website Redesign',
      projectFolder: 'projects/example', taskSlug: 'api-key-rotation',
      projectDescription: '',
    })
    expect(result).toContain('Task: API Key Rotation')
    expect(result).toContain('Project: Website Redesign')
  })

  it('handles planContent conditional', () => {
    const template = "${planContent ? 'Plan:\\n' + planContent : ''}"
    const withPlan = renderPrompt(template, {
      id: 1, name: 'Test', description: '', planContent: 'Step 1: do thing',
      projectName: 'Test', projectFolder: '', taskSlug: '',
      projectDescription: '',
    })
    expect(withPlan).toContain('Step 1: do thing')

    const withoutPlan = renderPrompt(template, {
      id: 1, name: 'Test', description: '', planContent: null,
      projectName: 'Test', projectFolder: '', taskSlug: '',
      projectDescription: '',
    })
    expect(withoutPlan).toBe('')
  })
})

describe('taskToSlug', () => {
  it('converts task name to slug', () => {
    expect(taskToSlug('API Key & Token Rotation')).toBe('api-key-token-rotation')
  })
})

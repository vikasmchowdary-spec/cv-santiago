/**
 * Chunk knowledge-base/*.md files into scripts/chunks/*.json for RAG ingestion.
 *
 * Splits by H1/H2/H3 headers. Strips frontmatter.
 * Output matches the Chunk[] format expected by ingest-rag.ts.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.app.json scripts/chunk-knowledge-base.ts
 */

import { writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const KB_DIR = resolve(root, 'knowledge-base')
const CHUNKS_DIR = resolve(root, 'scripts/chunks')

interface ChunkMetadata {
  article_id: string
  article_slug_en: string
  article_slug_es: string
  section_id: string
  section_anchor: string
  page_path_en: string
  page_path_es: string
  source_file: string
  format: 'markdown'
}

interface Chunk {
  content: string
  metadata: ChunkMetadata
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Extract optional frontmatter fields (title, description) and return remaining body.
function parseFrontmatter(content: string): { title: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return { title: '', body: content }

  const fm = match[1]
  const titleMatch = fm.match(/^title:\s*(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : ''
  const body = content.slice(match[0].length)
  return { title, body }
}

function parseMarkdown(content: string, articleId: string, sourceFile: string): Chunk[] {
  const { title, body } = parseFrontmatter(content)

  const chunks: Chunk[] = []
  let currentSection = title ? slugify(title) : 'general'
  let currentText = ''

  function flush() {
    const trimmed = currentText.trim()
    if (!trimmed) return
    chunks.push({
      content: trimmed,
      metadata: {
        article_id: articleId,
        article_slug_en: `/${articleId}`,
        article_slug_es: '',
        section_id: currentSection,
        section_anchor: `#${currentSection}`,
        page_path_en: '',
        page_path_es: '',
        source_file: sourceFile,
        format: 'markdown',
      },
    })
    currentText = ''
  }

  for (const line of body.split('\n')) {
    const h1 = line.match(/^#\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)

    if (h1 || h2 || h3) {
      flush()
      const heading = (h3 ?? h2 ?? h1)![1]
      currentSection = slugify(heading)
    }

    currentText += line + '\n'
  }

  flush()
  return chunks
}

function main() {
  console.log('📦 Chunking knowledge-base markdown files...\n')
  mkdirSync(CHUNKS_DIR, { recursive: true })

  let files: string[]
  try {
    files = readdirSync(KB_DIR).filter(f => f.endsWith('.md'))
  } catch {
    console.warn('⚠️  knowledge-base/ directory not found — skipping')
    return
  }

  if (files.length === 0) {
    console.log('⚠️  No .md files found in knowledge-base/ — add case studies and re-run')
    return
  }

  let total = 0
  for (const file of files) {
    const articleId = basename(file, '.md')
    const relPath = `knowledge-base/${file}`
    const content = readFileSync(resolve(KB_DIR, file), 'utf-8')

    const chunks = parseMarkdown(content, articleId, relPath)
    if (chunks.length === 0) {
      console.warn(`  ⚠ ${file} — 0 chunks produced (file may be empty)`)
      continue
    }

    const outPath = resolve(CHUNKS_DIR, `${articleId}.json`)
    writeFileSync(outPath, JSON.stringify(chunks, null, 2))
    console.log(`  ✓ ${file} → ${chunks.length} chunks → scripts/chunks/${articleId}.json`)
    total += chunks.length
  }

  console.log(`\n✅ Total: ${total} chunks written to scripts/chunks/`)
}

main()

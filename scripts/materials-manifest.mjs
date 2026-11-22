import { readFileSync, readdirSync } from 'node:fs'
import { basename } from 'node:path'

export const manifestPath = 'data/bps301/materials.json'
const directory = new URL('../public/materials/bps301/', import.meta.url)
const theoryFile = new URL('../public/data/bps301/theory.json', import.meta.url)

export function createMaterialsManifest(theory, filenames) {
  const pdfs = filenames.filter((name) => /^[\p{L}\p{N}_. -]+\.pdf$/iu.test(name))
  return {
    version: 1,
    materials: theory.map((lecture) => {
      const sourceFile = basename(lecture.sourceFile)
      const expected = sourceFile.replace(/\.pptx$/i, '.pdf').toLowerCase()
      const exact = pdfs.filter((name) => name.toLowerCase() === expected)
      const numbered = pdfs.filter((name) => name.match(/^lecture[ _-]*(\d+)(?!\d)/i)?.[1] === String(lecture.id))
      const candidates = exact.length ? exact : numbered
      return {
        id: sourceFile,
        title: lecture.title,
        kind: 'pdf',
        sourceFile,
        ...(candidates.length === 1 && { file: 'materials/bps301/' + candidates[0] }),
      }
    }),
  }
}

export function bps301Materials() {
  function manifest() {
    let filenames = []
    try {
      filenames = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return JSON.stringify(createMaterialsManifest(JSON.parse(readFileSync(theoryFile, 'utf8')), filenames), null, 2)
  }
  return {
    name: 'bps301-materials-manifest',
    configureServer(server) {
      server.middlewares.use('/' + manifestPath, (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(manifest())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: manifestPath, source: manifest() })
    },
  }
}

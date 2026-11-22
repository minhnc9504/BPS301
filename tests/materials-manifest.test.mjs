import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMaterialsManifest } from '../scripts/materials-manifest.mjs'

const theory = [
  { id: '1', sourceFile: 'Lecture1-Intro.pptx', title: 'Introduction' },
  { id: '10', sourceFile: 'Lecture10-Automation.pptx', title: 'Automation' },
]

test('manifest keeps stable source IDs and prefers an exact basename over alternate names', () => {
  const { materials } = createMaterialsManifest(theory, ['Lecture1-alt.pdf', 'Lecture1-Intro.PDF', 'Lecture 10.pdf'])
  assert.deepEqual(materials.map(({ id, file }) => [id, file]), [
    ['Lecture1-Intro.pptx', 'materials/bps301/Lecture1-Intro.PDF'],
    ['Lecture10-Automation.pptx', 'materials/bps301/Lecture 10.pdf'],
  ])
})

test('a missing or ambiguous PDF stays unavailable without guessing another lecture', () => {
  const { materials } = createMaterialsManifest(theory, ['Lecture1-alt.pdf', 'Lecture1-copy.pdf', 'Lecture100.pdf'])
  assert.equal(materials[0].file, undefined)
  assert.equal(materials[1].file, undefined)
})

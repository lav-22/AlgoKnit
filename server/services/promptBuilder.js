import { BLOCK_LIMITS } from './puzzleContract.js';

export function buildPuzzlePrompt({ difficulty, topics }, diagnostics = null) {
  const limits = BLOCK_LIMITS[difficulty];
  const topicInstruction = topics.length ? `Use exactly one of these categories: ${topics.join(', ')}.` : 'Choose any supported category.';
  const repair = diagnostics ? `\nThe previous Lean proof failed. Repair it using these sanitized diagnostics:\n${diagnostics.slice(0, 3000)}` : '';
  return `Create one mathematically correct Parsons proof puzzle.

Requirements:
- Difficulty: ${difficulty}.
- ${topicInstruction}
- Produce ${limits.min}-${limits.max} ordered pedagogical proof blocks.
- Provide student-facing KaTeX-compatible LaTeX and a complete Lean 4 theorem using Mathlib.
- Each block must map to a Lean proof fragment and have a unique stable ID.
- Convert the derivation into a complete formal natural-deduction proof. Use the exact assumptions and inference rules, and do not skip any steps.
- Every student-facing block must assert an actual derived formula and name its justification (for example: Assumption, \(\\land E_1\\), \(\\land E_2\\), \(\\land I\\), \(\\to E\\), or \(\\to I\\)).
- A block must never be a proof-plan instruction such as “prove ... first”, “next prove ...”, “it remains to show ...”, “we need to prove ...”, or “finish with ...”.
- When introducing a conjunction, include the completed inference only after both conjuncts have been derived; do not replace the inference with a strategy description.
- The ordered blocks must stand alone as the full proof a student would submit, not commentary about how a proof could be constructed.
- The complete Lean source must contain no sorry, admit, unsafe declarations, custom axioms, or unsolved goals.
- Keep imports minimal and use only Mathlib modules.
- Return only data matching the supplied JSON schema.${repair}`;
}

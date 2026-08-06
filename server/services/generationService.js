import crypto from 'node:crypto';
import Puzzle from '../models/Puzzle.js';
import PuzzleHistory from '../models/PuzzleHistory.js';
import openaiPuzzleService from './openaiPuzzleService.js';
import leanClient from './leanClient.js';
import { buildPuzzlePrompt } from './promptBuilder.js';
import { normalizeGenerationRequest, validateCandidate } from './puzzleContract.js';

const MAX_REPAIR_ATTEMPTS = Number(process.env.OPENAI_REPAIR_ATTEMPTS || 2);

function candidateRepairDiagnostics(error, candidate) {
  const blocks = Array.isArray(candidate?.blocks)
    ? candidate.blocks.map(({ id, latex, pedagogicalRole }) => ({ id, latex, pedagogicalRole }))
    : [];
  return [
    'The previous response was a proof plan rather than a complete natural-deduction proof.',
    'Convert it into a complete formal natural-deduction proof. Use the exact assumptions and inference rules, and do not skip any steps.',
    `Validation error: ${error.message}`,
    `Previous blocks to replace: ${JSON.stringify(blocks)}`
  ].join('\n').slice(0, 3000);
}

function fingerprint(candidate) {
  return crypto.createHash('sha256').update(JSON.stringify({ statement: candidate.statement.trim(), lean: candidate.lean.source.trim() })).digest('hex');
}

function safePuzzle(puzzle, source) {
  const obj = puzzle.toObject ? puzzle.toObject() : puzzle;
  return { id: obj.id, title: obj.title, displayTitle: obj.displayTitle, statement: obj.statement, category: obj.category, difficulty: obj.difficulty, tags: obj.tags, blocks: obj.blocks, solutionOrder: obj.solutionOrder, source, verification: { status: obj.verification?.status || 'verified' } };
}

export class GenerationService {
  constructor({ PuzzleModel = Puzzle, HistoryModel = PuzzleHistory, openai = openaiPuzzleService, lean = leanClient } = {}) {
    this.Puzzle = PuzzleModel; this.History = HistoryModel; this.openai = openai; this.lean = lean;
  }

  async findUnseen({ userId, difficulty, topics }) {
    const history = await this.History.find({ userId, $or: [{ seenCount: { $gt: 0 } }, { attemptCount: { $gt: 0 } }] }).select('puzzleId -_id').lean();
    const excluded = history.map(item => item.puzzleId);
    const filter = { isActive: true, difficulty, 'verification.status': 'verified', id: { $nin: excluded } };
    if (topics.length) filter.category = { $in: topics };
    const count = await this.Puzzle.countDocuments(filter);
    if (!count) return null;
    const puzzle = await this.Puzzle.findOne(filter).skip(Math.floor(Math.random() * count));
    return puzzle;
  }

  async recordSeen(userId, puzzleId) {
    const now = new Date();
    await this.History.updateOne({ userId, puzzleId }, { $min: { firstSeenAt: now }, $max: { lastSeenAt: now }, $inc: { seenCount: 1 } }, { upsert: true });
    await this.Puzzle.updateOne({ id: puzzleId }, { $inc: { useCount: 1 }, $set: { lastServedAt: now } });
  }

  async recordTried(userId, puzzleId, { completed = false } = {}) {
    const now = new Date(); const update = { $min: { firstTriedAt: now }, $max: { lastTriedAt: now }, $inc: { attemptCount: 1 } };
    if (completed) update.$set = { completedAt: now };
    await this.History.updateOne({ userId, puzzleId }, update, { upsert: true });
  }

  async generate(body) {
    const request = normalizeGenerationRequest(body);
    const cached = await this.findUnseen(request);
    if (cached) { await this.recordSeen(request.userId, cached.id); return safePuzzle(cached, 'cache'); }

    let diagnostics = null; let lastVerification = null;
    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      const prompt = buildPuzzlePrompt(request, diagnostics);
      const generated = await this.openai.generate(prompt, {
        ...request,
        requestId: `${request.requestId}:attempt:${attempt}`
      });
      let candidate;
      try {
        candidate = validateCandidate(generated.candidate, request);
      } catch (error) {
        if (error.code === 'PROOF_PLAN_DETECTED' && attempt < MAX_REPAIR_ATTEMPTS) {
          diagnostics = candidateRepairDiagnostics(error, generated.candidate);
          continue;
        }
        throw error;
      }
      lastVerification = await this.lean.verify(candidate.lean);
      if (lastVerification.valid) {
        const id = `llm_${crypto.randomUUID()}`; const contentFingerprint = fingerprint(candidate);
        const puzzleData = { ...candidate, id, source: 'llm-generated', contentFingerprint, verification: { ...lastVerification, status: 'verified', verifiedAt: new Date() }, generation: { model: generated.model, responseId: generated.responseId, promptVersion: '1.1', repairAttemptCount: attempt }, isActive: true };
        let puzzle;
        try { puzzle = await this.Puzzle.create(puzzleData); }
        catch (error) { if (error.code !== 11000) throw error; puzzle = await this.Puzzle.findOne({ contentFingerprint }); }
        await this.recordSeen(request.userId, puzzle.id);
        return safePuzzle(puzzle, 'generated');
      }
      diagnostics = JSON.stringify(lastVerification.diagnostics || []).slice(0, 3000);
    }
    throw Object.assign(new Error('No Lean-verified puzzle could be produced'), { status: lastVerification?.status === 'infrastructure_error' ? 503 : 422, code: 'LEAN_VERIFICATION_FAILED' });
  }
}

export default new GenerationService();

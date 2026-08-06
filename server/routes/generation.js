import express from 'express';
import generationService from '../services/generationService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try { res.json(await generationService.generate(req.body)); }
  catch (error) {
    const databaseUnavailable = ['MongooseError', 'MongoServerSelectionError'].includes(error.name);
    const status = error.status || (databaseUnavailable ? 503 : 500);
    const safeConfigurationErrors = ['OPENAI_NOT_CONFIGURED'];
    const message = databaseUnavailable
      ? 'MongoDB is unavailable. Start MongoDB or correct MONGODB_URI in server/.env.'
      : (safeConfigurationErrors.includes(error.code) || (error.status && error.status < 500)
          ? error.message
          : 'Unable to generate a verified puzzle right now.');
    res.status(status).json({ error: error.code || (databaseUnavailable ? 'DATABASE_UNAVAILABLE' : 'GENERATION_FAILED'), message });
  }
});

router.post('/:puzzleId/tried', async (req, res) => {
  try {
    const userId = String(req.body.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'INVALID_USER_ID' });
    await generationService.recordTried(userId, req.params.puzzleId, { completed: req.body.completed === true });
    res.status(204).end();
  } catch { res.status(500).json({ error: 'HISTORY_UPDATE_FAILED' }); }
});

export default router;

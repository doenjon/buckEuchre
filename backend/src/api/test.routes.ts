import { Router, Request, Response } from 'express';
import { setCustomDeck, setDealerOverride, setShuffleSeed } from '../game/random';

const router = Router();

const controlsEnabled = process.env.ENABLE_TEST_CONTROLS !== 'false';

router.post('/shuffle-seed', (req: Request, res: Response) => {
  if (!controlsEnabled) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Test controls are disabled',
    });
  }

  const { seed } = req.body as { seed?: string | null };
  if (seed !== undefined && seed !== null && typeof seed !== 'string') {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Seed must be a string or null',
    });
  }

  setShuffleSeed(seed ?? null);
  res.status(200).json({ success: true, seed: seed ?? null });
});

router.post('/deck', (req: Request, res: Response) => {
  if (!controlsEnabled) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Test controls are disabled',
    });
  }

  const { deck } = req.body as { deck?: string[] | null };
  if (deck !== undefined && deck !== null) {
    if (
      !Array.isArray(deck) ||
      deck.some((card) => typeof card !== 'string') ||
      deck.length !== 24
    ) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Deck must be an array of 24 card IDs',
      });
    }
  }

  try {
    setCustomDeck(deck ?? null);
  } catch (error: any) {
    return res.status(400).json({
      error: 'bad_request',
      message: error.message || 'Invalid deck',
    });
  }

  res.status(200).json({ success: true, deckSize: deck ? deck.length : null });
});

router.post('/dealer', (req: Request, res: Response) => {
  if (!controlsEnabled) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Test controls are disabled',
    });
  }

  const { position } = req.body as { position?: number | null };

  if (position !== undefined && position !== null) {
    if (typeof position !== 'number' || !Number.isInteger(position)) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Dealer position must be an integer or null',
      });
    }
  }

  setDealerOverride(position ?? null);
  res.status(200).json({ success: true, position: position ?? null });
});

export default router;

import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { rsvpService } from '../services/rsvp/rsvp.service';

const router = Router();

// Create or update RSVP
router.post(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rsvp = await rsvpService.createOrUpdateRSVP({
        userId: req.userId!,
        eventId: req.params.eventId,
        ...req.body,
      });
      res.json(rsvp);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get RSVPs for an event
router.get(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rsvps = await rsvpService.getEventRSVPs(req.params.eventId);
      res.json(rsvps);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Delete RSVP
router.delete(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await rsvpService.removeRSVP(req.userId!, req.params.eventId);
      res.json({ success: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get RSVP counts for an event
router.get('/:eventId/counts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const counts = await rsvpService.getRSVPCounts(req.params.eventId);
    res.json(counts);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

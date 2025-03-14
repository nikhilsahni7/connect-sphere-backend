import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { eventParticipantService } from '../services/event/event.participant.service';

const router = Router();

// Kick a participant from an event
router.delete(
  '/:eventId/kick/:userId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await eventParticipantService.kickParticipant(
        req.params.eventId,
        req.userId!,
        req.params.userId
      );
      res.json({ success: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Leave an event
router.delete(
  '/:eventId/leave',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await eventParticipantService.leaveEvent(req.params.eventId, req.userId!);
      res.json({ success: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get event participants
router.get(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const participants = await eventParticipantService.getParticipants(req.params.eventId);
      res.json(participants);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

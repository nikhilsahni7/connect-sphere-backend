import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { pollService } from '../services/poll/poll.service';

const router = Router();

// Create a poll
router.post(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const poll = await pollService.createPoll({
        eventId: req.params.eventId,
        creatorId: req.userId!,
        question: req.body.question,
        options: req.body.options,
        closeAt: req.body.closeAt ? new Date(req.body.closeAt) : undefined,
      });
      res.json(poll);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get polls for an event
router.get(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const polls = await pollService.getEventPolls(req.params.eventId);
      res.json(polls);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Vote on a poll option
router.post(
  '/vote/:pollId/:optionId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pollService.vote({
        userId: req.userId!,
        pollId: req.params.pollId,
        optionId: req.params.optionId,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Close a poll
router.post(
  '/close/:pollId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pollService.closePoll(req.params.pollId, req.userId!);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Delete a poll
router.delete(
  '/:pollId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pollService.deletePoll(req.params.pollId, req.userId!);
      res.json({ success: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

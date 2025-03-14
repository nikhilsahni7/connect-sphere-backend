import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { chatService } from '../services/chat/chat.service';

const router = Router();

// Send a message
router.post(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const message = await chatService.sendMessage({
        userId: req.userId!,
        eventId: req.params.eventId,
        text: req.body.text,
      });
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get messages for an event
router.get(
  '/:eventId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const messages = await chatService.getMessages(req.params.eventId);
      res.json(messages);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Delete a message
router.delete(
  '/:messageId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await chatService.deleteMessage(req.params.messageId, req.userId!);
      res.json({ success: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { eventService } from '../services/event/event.service';

const router = Router();

// Create event
router.post('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.createEvent({
      ...req.body,
      creatorId: req.userId!,
    });
    res.json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get events created by the authenticated user
router.get('/created', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const events = await eventService.getEventsByCreator(req.userId!);
    res.json(events);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get events the authenticated user is participating in
router.get('/participating', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const events = await eventService.getEventsByParticipant(req.userId!);
    res.json(events);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get dashboard data for the authenticated user
router.get('/dashboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const dashboard = await eventService.getUserDashboard(req.userId!);
    res.json(dashboard);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get event by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get event with attendees
router.get('/:id/attendees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getEventWithAttendees(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update event
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // You might want to add authorization check here
    const event = await eventService.updateEvent(req.params.id, req.body);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete event
router.delete(
  '/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // You might want to add authorization check here
      const success = await eventService.deleteEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get events (with filtering)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorId, isPublic, fromDate, toDate, limit, offset } = req.query;

    const options: any = {};
    if (creatorId) options.creatorId = creatorId as string;
    if (isPublic !== undefined) options.isPublic = isPublic === 'true';
    if (fromDate) options.fromDate = new Date(fromDate as string);
    if (toDate) options.toDate = new Date(toDate as string);
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);

    const result = await eventService.getEvents(options);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's events
router.get(
  '/user/:userId',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // For security, only allow users to see their own events unless admin
      if (req.userId !== req.params.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { upcoming, limit, offset } = req.query;

      const options: any = {};
      if (upcoming !== undefined) options.upcoming = upcoming === 'true';
      if (limit) options.limit = parseInt(limit as string);
      if (offset) options.offset = parseInt(offset as string);

      const result = await eventService.getUserEvents(req.params.userId, options);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Generate ICS file for calendar
router.get('/:id/calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const icsContent = await eventService.generateEventICS(req.params.id);
    if (!icsContent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="event-${req.params.id}.ics"`);
    res.send(icsContent);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

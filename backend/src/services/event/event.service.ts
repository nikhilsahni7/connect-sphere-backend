import { PrismaClient } from '@prisma/client';
import type { Event } from '@prisma/client';
import { redisService } from '../redis.service';
import { getSocketService } from '../socket.service';
import { EventType, config } from '../../config';

const prisma = new PrismaClient();

class EventService {
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async createEvent(data: {
    title: string;
    datetime: Date;
    locationText: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    isPublic: boolean;
    eventType: EventType;
    creatorId: string;
  }): Promise<Event> {
    // Create event in database

    const event = await prisma.event.create({
      data: {
        ...data,
        hasFoodOrDrinks: [EventType.MEAL, EventType.POTLUCK, EventType.DRINKS].includes(
          data.eventType as EventType
        ),
      },
    });

    // Cache the event
    await this.cacheEvent(event);

    // Notify through WebSocket
    getSocketService().emitToUser(data.creatorId, 'event-created', event);

    return event;
  }

  async updateEvent(
    eventId: string,
    data: Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'creatorId'>>
  ): Promise<Event | null> {
    // Find the event first
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      return null;
    }

    // Update event in database
    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...data,
        // Recalculate hasFoodOrDrinks if eventType is being updated
        ...(data.eventType && {
          hasFoodOrDrinks: [EventType.MEAL, EventType.POTLUCK, EventType.DRINKS].includes(
            data.eventType as EventType
          ),
        }),
      },
    });

    // Update cache
    await this.cacheEvent(updatedEvent);

    // Notify through WebSocket
    getSocketService().emitToEvent(eventId, 'event-updated', updatedEvent);

    return updatedEvent;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return false;
    }

    // Delete event from database
    await prisma.event.delete({
      where: { id: eventId },
    });

    // Remove from cache
    await redisService.delete(`event:${eventId}`);

    // Notify through WebSocket
    getSocketService().emitToEvent(eventId, 'event-deleted', { id: eventId });

    return true;
  }

  private async cacheEvent(event: Event) {
    const cacheKey = `event:${event.id}`;
    await redisService.set(cacheKey, event, this.CACHE_TTL);
  }

  async getEvent(eventId: string): Promise<Event | null> {
    // Try cache first
    const cachedEvent = await redisService.get<Event>(`event:${eventId}`);
    if (cachedEvent) {
      return cachedEvent;
    }

    // If not in cache, get from database
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (event) {
      // Cache for next time
      await this.cacheEvent(event);
    }

    return event;
  }

  async getEvents(options: {
    creatorId?: string;
    isPublic?: boolean;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: Event[]; total: number }> {
    const { creatorId, isPublic, fromDate, toDate, limit = 10, offset = 0 } = options;

    // Build where clause
    const where: any = {};

    if (creatorId) {
      where.creatorId = creatorId;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    if (fromDate || toDate) {
      where.datetime = {};
      if (fromDate) {
        where.datetime.gte = fromDate;
      }
      if (toDate) {
        where.datetime.lte = toDate;
      }
    }

    // Get events from database
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { datetime: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    // Cache each event
    await Promise.all(events.map((event) => this.cacheEvent(event)));

    return { events, total };
  }

  async getUserEvents(
    userId: string,
    options: {
      upcoming?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ events: Event[]; total: number }> {
    const { upcoming = true, limit = 10, offset = 0 } = options;

    // Get events where user is creator or has RSVP'd
    const where: any = {
      OR: [{ creatorId: userId }, { rsvps: { some: { userId } } }],
    };

    // Filter for upcoming events if requested
    if (upcoming) {
      where.datetime = { gte: new Date() };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { datetime: upcoming ? 'asc' : 'desc' },
        skip: offset,
        take: limit,
        include: {
          rsvps: {
            where: { userId },
            select: { status: true },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    // Cache each event
    await Promise.all(events.map((event) => this.cacheEvent(event)));

    return { events, total };
  }

  async getEventsByCreator(userId: string) {
    const events = await prisma.event.findMany({
      where: {
        creatorId: userId,
      },
      orderBy: {
        datetime: 'asc',
      },
    });

    return events;
  }

  async getEventsByParticipant(userId: string) {
    const events = await prisma.event.findMany({
      where: {
        rsvps: {
          some: {
            userId: userId,
            status: { in: ['YES', 'MAYBE'] },
          },
        },
      },
      orderBy: {
        datetime: 'asc',
      },
    });

    return events;
  }

  async getUserDashboard(userId: string) {
    // Get events created by user
    const createdEvents = await this.getEventsByCreator(userId);

    // Get events user is participating in
    const participatingEvents = await this.getEventsByParticipant(userId);

    // Get upcoming events (next 7 days)
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    const upcomingEvents = await prisma.event.findMany({
      where: {
        OR: [
          { creatorId: userId },
          {
            rsvps: {
              some: {
                userId: userId,
                status: { in: ['YES', 'MAYBE'] },
              },
            },
          },
        ],
        datetime: {
          gte: now,
          lte: nextWeek,
        },
      },
      orderBy: {
        datetime: 'asc',
      },
    });

    return {
      createdEvents,
      participatingEvents,
      upcomingEvents,
    };
  }

  async getEventWithAttendees(eventId: string): Promise<(Event & { attendees: any[] }) | null> {
    // Try cache first
    const cachedEvent = await redisService.get<Event & { attendees: any[] }>(
      `event:${eventId}:with-attendees`
    );
    if (cachedEvent) {
      return cachedEvent;
    }

    // If not in cache, get from database
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        rsvps: {
          where: { status: 'YES' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return null;
    }

    // Transform the data
    const eventWithAttendees = {
      ...event,
      attendees: event.rsvps.map((rsvp) => ({
        id: rsvp.user.id,
        name: rsvp.user.name,
        hasPlusOne: rsvp.hasPlusOne,
        plusOneName: rsvp.plusOneName,
      })),
    };

    // Cache for next time (shorter TTL for attendee data as it changes more frequently)
    await redisService.set(`event:${eventId}:with-attendees`, eventWithAttendees, 600); // 10 minutes

    return eventWithAttendees;
  }

  async generateEventICS(eventId: string): Promise<string | null> {
    const event = await this.getEvent(eventId);
    if (!event) return null;

    try {
      // Import the ics library dynamically
      const ics = await import('ics');

      // Parse the event date
      const eventDate = new Date(event.datetime);

      // Create an ICS event (assuming 2-hour duration)
      const icsEvent: any = {
        start: [
          eventDate.getFullYear(),
          eventDate.getMonth() + 1, // Month is 0-indexed in JS
          eventDate.getDate(),
          eventDate.getHours(),
          eventDate.getMinutes(),
        ] as [number, number, number, number, number],
        duration: { hours: 2, minutes: 0 },
        title: event.title,
        description: event.description || '',
        location: event.locationText,
        status: 'CONFIRMED' as const,
        organizer: { name: config.calendar.icsAppName, email: config.calendar.icsOrganizerEmail },
        url: `${config.app.frontendUrl}/events/${event.id}`,
      };

      // Only add geo if both lat and lng are available
      if (event.latitude && event.longitude) {
        icsEvent.geo = { lat: event.latitude, lon: event.longitude };
      }

      return new Promise<string | null>((resolve) => {
        ics.createEvent(icsEvent, (error: Error | undefined, value: string) => {
          if (error) {
            console.error('Error generating ICS file:', error);
            resolve(null);
          } else {
            resolve(value);
          }
        });
      });
    } catch (error) {
      console.error('Error importing ics library:', error);
      return null;
    }
  }
}

export const eventService = new EventService();

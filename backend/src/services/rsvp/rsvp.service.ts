import { PrismaClient, RSVPStatus } from '@prisma/client';
import { redisService } from '../redis.service';
import { getSocketService } from '../socket.service';

const prisma = new PrismaClient();

class RSVPService {
  private readonly CACHE_TTL = 1800; // 30 minutes in seconds

  async createOrUpdateRSVP(data: {
    userId: string;
    eventId: string;
    status: RSVPStatus;
    hasPlusOne?: boolean;
    plusOneName?: string;
    comment?: string;
    dietaryPatterns?: string[];
    religiousDietary?: string[];
    allergies?: string[];
    lifestyleChoices?: string[];
    intensityPrefs?: string[];
    alcoholPrefs?: string[];
    customDietaryNotes?: string;
  }) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      include: { creator: { select: { id: true } } },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if RSVP already exists
    const existingRSVP = await prisma.rSVP.findUnique({
      where: {
        userId_eventId: {
          userId: data.userId,
          eventId: data.eventId,
        },
      },
    });

    let rsvp;
    if (existingRSVP) {
      // Update existing RSVP
      rsvp = await prisma.rSVP.update({
        where: {
          userId_eventId: {
            userId: data.userId,
            eventId: data.eventId,
          },
        },
        data: {
          status: data.status,
          hasPlusOne: data.hasPlusOne ?? existingRSVP.hasPlusOne,
          plusOneName: data.plusOneName !== undefined ? data.plusOneName : existingRSVP.plusOneName,
          comment: data.comment !== undefined ? data.comment : existingRSVP.comment,
          dietaryPatterns: data.dietaryPatterns ?? existingRSVP.dietaryPatterns,
          religiousDietary: data.religiousDietary ?? existingRSVP.religiousDietary,
          allergies: data.allergies ?? existingRSVP.allergies,
          lifestyleChoices: data.lifestyleChoices ?? existingRSVP.lifestyleChoices,
          intensityPrefs: data.intensityPrefs ?? existingRSVP.intensityPrefs,
          alcoholPrefs: data.alcoholPrefs ?? existingRSVP.alcoholPrefs,
          customDietaryNotes:
            data.customDietaryNotes !== undefined
              ? data.customDietaryNotes
              : existingRSVP.customDietaryNotes,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else {
      // Create new RSVP
      rsvp = await prisma.rSVP.create({
        data: {
          userId: data.userId,
          eventId: data.eventId,
          status: data.status,
          hasPlusOne: data.hasPlusOne ?? false,
          plusOneName: data.plusOneName || null,
          comment: data.comment || null,
          dietaryPatterns: data.dietaryPatterns ?? [],
          religiousDietary: data.religiousDietary ?? [],
          allergies: data.allergies ?? [],
          lifestyleChoices: data.lifestyleChoices ?? [],
          intensityPrefs: data.intensityPrefs ?? [],
          alcoholPrefs: data.alcoholPrefs ?? [],
          customDietaryNotes: data.customDietaryNotes || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    // Clear cache for event attendees
    await redisService.delete(`event:${data.eventId}:with-attendees`);

    // Notify through WebSocket
    getSocketService().emitToEvent(data.eventId, 'rsvp-updated', {
      rsvp: {
        id: rsvp.id,
        status: rsvp.status,
        hasPlusOne: rsvp.hasPlusOne,
        plusOneName: rsvp.plusOneName,
        userId: rsvp.userId,
        eventId: rsvp.eventId,
      },
      timestamp: new Date(),
    });

    // Also notify the event creator
    if (event.creator.id !== data.userId) {
      getSocketService().emitToUser(event.creator.id, 'event-rsvp-updated', {
        eventId: data.eventId,
        eventTitle: event.title,
        userId: data.userId,
        status: data.status,
        timestamp: new Date(),
      });
    }

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventRSVPChannel(data.eventId), {
      type: 'RSVP_UPDATED',
      eventId: data.eventId,
      userId: data.userId,
      status: data.status,
      timestamp: new Date(),
    });

    return rsvp;
  }

  async getRSVP(userId: string, eventId: string) {
    return prisma.rSVP.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });
  }

  async getEventRSVPs(eventId: string) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Get all RSVPs for the event
    return prisma.rSVP.findMany({
      where: {
        eventId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getRSVPCounts(eventId: string) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Get counts for each RSVP status
    const counts = await prisma.$queryRaw`
      SELECT 
        status, 
        COUNT(*) as count,
        SUM(CASE WHEN "hasPlusOne" = true THEN 1 ELSE 0 END) as plus_ones
      FROM "RSVP"
      WHERE "eventId" = ${eventId}
      GROUP BY status
    `;

    return counts;
  }

  async removeRSVP(userId: string, eventId: string) {
    // Check if RSVP exists
    const rsvp = await prisma.rSVP.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        event: {
          select: {
            creatorId: true,
          },
        },
      },
    });

    if (!rsvp) {
      throw new Error('RSVP not found');
    }

    // Delete the RSVP
    await prisma.rSVP.delete({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    // Clear cache for event attendees
    await redisService.delete(`event:${eventId}:with-attendees`);

    // Notify through WebSocket
    getSocketService().emitToEvent(eventId, 'rsvp-removed', {
      userId,
      userName: rsvp.user.name,
      eventId,
      timestamp: new Date(),
    });

    // Also notify the event creator if different from the user
    if (rsvp.event.creatorId !== userId) {
      getSocketService().emitToUser(rsvp.event.creatorId, 'event-rsvp-removed', {
        eventId,
        userId,
        userName: rsvp.user.name,
        timestamp: new Date(),
      });
    }

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventRSVPChannel(eventId), {
      type: 'RSVP_REMOVED',
      eventId,
      userId,
      userName: rsvp.user.name,
      timestamp: new Date(),
    });

    return true;
  }
}

export const rsvpService = new RSVPService();

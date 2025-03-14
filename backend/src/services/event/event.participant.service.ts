import { PrismaClient } from '@prisma/client';
import { redisService } from '../redis.service';
import { getSocketService } from '../socket.service';

const prisma = new PrismaClient();

class EventParticipantService {
  async kickParticipant(eventId: string, userId: string, kickedUserId: string) {
    // Check if event exists and user is the creator
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.creatorId !== userId) {
      throw new Error('Only the event creator can remove participants');
    }

    // Check if the user to be kicked exists and is a participant
    const participant = await prisma.rSVP.findUnique({
      where: {
        userId_eventId: {
          userId: kickedUserId,
          eventId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!participant) {
      throw new Error('User is not a participant of this event');
    }

    // Remove the participant's RSVP
    await prisma.rSVP.delete({
      where: {
        userId_eventId: {
          userId: kickedUserId,
          eventId,
        },
      },
    });

    // Clear cache for event attendees
    await redisService.delete(`event:${eventId}:with-attendees`);

    // Notify through WebSocket to the event room
    getSocketService().emitToEvent(eventId, 'participant-kicked', {
      eventId,
      userId: kickedUserId,
      userName: participant.user.name,
      kickedBy: userId,
      timestamp: new Date(),
    });

    // Notify the kicked user
    getSocketService().emitToUser(kickedUserId, 'kicked-from-event', {
      eventId,
      eventTitle: event.title,
      kickedBy: userId,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventParticipantChannel(eventId), {
      type: 'PARTICIPANT_KICKED',
      eventId,
      userId,
      kickedUserId,
      userName: participant.user.name,
      timestamp: new Date(),
    });

    return true;
  }

  async leaveEvent(eventId: string, userId: string) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if user is the creator
    if (event.creatorId === userId) {
      throw new Error('Event creator cannot leave the event. Consider deleting the event instead.');
    }

    // Check if user is a participant
    const participant = await prisma.rSVP.findUnique({
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
      },
    });

    if (!participant) {
      throw new Error('You are not a participant of this event');
    }

    // Remove the participant's RSVP
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
    getSocketService().emitToEvent(eventId, 'participant-left', {
      eventId,
      userId,
      userName: participant.user.name,
      timestamp: new Date(),
    });

    // Notify the event creator
    getSocketService().emitToUser(event.creatorId, 'participant-left-event', {
      eventId,
      eventTitle: event.title,
      userId,
      userName: participant.user.name,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventParticipantChannel(eventId), {
      type: 'PARTICIPANT_LEFT',
      eventId,
      userId,
      userName: participant.user.name,
      timestamp: new Date(),
    });

    return true;
  }

  async getParticipants(eventId: string) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Get all participants (RSVPs with status YES)
    const participants = await prisma.rSVP.findMany({
      where: {
        eventId,
        status: 'YES',
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

    return participants.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      hasPlusOne: p.hasPlusOne,
      plusOneName: p.plusOneName,
      joinedAt: p.createdAt,
    }));
  }
}

export const eventParticipantService = new EventParticipantService();

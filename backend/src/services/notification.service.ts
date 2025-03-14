import { PrismaClient } from '@prisma/client';
import { redisService } from './redis.service';
import { getSocketService } from './socket.service';

const prisma = new PrismaClient();

class NotificationService {
  constructor() {
    this.setupRedisListeners();
  }

  private setupRedisListeners() {
    // Listen for RSVP events
    redisService.subscribe('event:*:rsvp', async (message) => {
      if (message.eventId && message.type) {
        await this.handleRSVPNotification(message);
      }
    });

    // Listen for chat events
    redisService.subscribe('event:*:chat', async (message) => {
      if (message.eventId && message.type) {
        await this.handleChatNotification(message);
      }
    });

    // Listen for poll events
    redisService.subscribe('event:*:poll', async (message) => {
      if (message.eventId && message.type) {
        await this.handlePollNotification(message);
      }
    });

    // Listen for participant events
    redisService.subscribe('event:*:participant', async (message) => {
      if (message.eventId && message.type) {
        await this.handleParticipantNotification(message);
      }
    });
  }

  private async handleRSVPNotification(message: any) {
    const { eventId, type, userId, status, userName } = message;

    // Get event details including creator
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        creatorId: true,
        isPublic: true,
      },
    });

    if (!event) return;

    // Notify the event creator about RSVP changes
    if ((type === 'RSVP_CREATED' || type === 'RSVP_UPDATED') && userId !== event.creatorId) {
      const statusText =
        status === 'YES' ? 'is attending' : status === 'MAYBE' ? 'might attend' : 'declined';

      getSocketService().emitToUser(event.creatorId, 'notification', {
        type: 'rsvp',
        message: `${userName} ${statusText} your event "${event.title}"`,
        eventId,
        timestamp: new Date(),
      });
    }

    // For public events, notify all participants about new attendees (only for YES responses)
    if (event.isPublic && status === 'YES' && type === 'RSVP_CREATED') {
      // Get all participants except the one who just RSVP'd
      const participants = await prisma.rSVP.findMany({
        where: {
          eventId,
          userId: { not: userId },
          status: 'YES',
        },
        select: { userId: true },
      });

      // Notify each participant
      for (const participant of participants) {
        getSocketService().emitToUser(participant.userId, 'notification', {
          type: 'new_participant',
          message: `${userName} is now attending "${event.title}"`,
          eventId,
          timestamp: new Date(),
        });
      }
    }
  }

  private async handleChatNotification(message: any) {
    const { eventId, type, userId, text } = message;

    if (type !== 'NEW_MESSAGE') return;

    // Get event participants
    const participants = await prisma.rSVP.findMany({
      where: { eventId },
      select: { userId: true },
    });

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });

    if (!event) return;

    // Get sender name
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!sender) return;

    // Notify all participants except the sender
    for (const participant of participants) {
      if (participant.userId !== userId) {
        getSocketService().emitToUser(participant.userId, 'notification', {
          type: 'chat',
          message: `New message from ${sender.name} in "${event.title}"`,
          eventId,
          timestamp: new Date(),
        });
      }
    }
  }

  private async handlePollNotification(message: any) {
    const { eventId, type, pollId, question } = message;

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });

    if (!event) return;

    // Get event participants
    const participants = await prisma.rSVP.findMany({
      where: { eventId },
      select: { userId: true },
    });

    // Notify based on poll event type
    if (type === 'POLL_CREATED') {
      // Notify all participants about new poll
      for (const participant of participants) {
        getSocketService().emitToUser(participant.userId, 'notification', {
          type: 'poll_created',
          message: `New poll in "${event.title}": ${question}`,
          eventId,
          pollId,
          timestamp: new Date(),
        });
      }
    } else if (type === 'POLL_CLOSED') {
      // Notify all participants about closed poll
      for (const participant of participants) {
        getSocketService().emitToUser(participant.userId, 'notification', {
          type: 'poll_closed',
          message: `Poll closed in "${event.title}": ${question}`,
          eventId,
          pollId,
          timestamp: new Date(),
        });
      }
    }
  }

  private async handleParticipantNotification(message: any) {
    const { eventId, type, userId, kickedUserId, userName } = message;

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, creatorId: true },
    });

    if (!event) return;

    if (type === 'PARTICIPANT_KICKED') {
      // Notify the kicked user
      getSocketService().emitToUser(kickedUserId, 'notification', {
        type: 'kicked',
        message: `You have been removed from the event "${event.title}"`,
        eventId,
        timestamp: new Date(),
      });
    } else if (type === 'PARTICIPANT_LEFT') {
      // Notify the event creator
      getSocketService().emitToUser(event.creatorId, 'notification', {
        type: 'participant_left',
        message: `${userName} has left your event "${event.title}"`,
        eventId,
        timestamp: new Date(),
      });
    }
  }

  // Method to send a direct notification to a user
  async sendNotification(
    userId: string,
    notification: {
      type: string;
      message: string;
      eventId?: string;
      pollId?: string;
      timestamp?: Date;
    }
  ) {
    getSocketService().emitToUser(userId, 'notification', {
      ...notification,
      timestamp: notification.timestamp || new Date(),
    });
  }
}

// Initialize and export as singleton
export const notificationService = new NotificationService();

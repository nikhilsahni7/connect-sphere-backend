import { PrismaClient } from '@prisma/client';
import { redisService } from '../redis.service';
import { getSocketService } from '../socket.service';

const prisma = new PrismaClient();

class ChatService {
  async sendMessage(data: { userId: string; eventId: string; text: string }) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if user has RSVP'd to the event or is the creator
    const canAccessEvent = await prisma.event.findFirst({
      where: {
        id: data.eventId,
        OR: [{ creatorId: data.userId }, { rsvps: { some: { userId: data.userId } } }],
      },
    });

    if (!canAccessEvent) {
      throw new Error('You must RSVP to this event before sending messages');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        text: data.text,
        userId: data.userId,
        eventId: data.eventId,
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

    // Format message for response
    const formattedMessage = {
      id: message.id,
      text: message.text,
      userId: message.userId,
      userName: message.user.name,
      eventId: message.eventId,
      createdAt: message.createdAt,
    };

    // Notify through WebSocket
    getSocketService().emitToEvent(data.eventId, 'new-message', formattedMessage);

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventChatChannel(data.eventId), {
      type: 'NEW_MESSAGE',
      ...formattedMessage,
    });

    return formattedMessage;
  }

  async getMessages(eventId: string, options: { limit?: number; before?: Date } = {}) {
    const { limit = 50, before } = options;

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Build where clause
    const where: any = { eventId };
    if (before) {
      where.createdAt = { lt: before };
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Format messages for response
    return messages
      .map((message) => ({
        id: message.id,
        text: message.text,
        userId: message.userId,
        userName: message.user.name,
        eventId: message.eventId,
        createdAt: message.createdAt,
      }))
      .reverse(); // Reverse to get chronological order
  }

  async deleteMessage(messageId: string, userId: string) {
    // Find the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        event: {
          select: {
            id: true,
            creatorId: true,
          },
        },
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if user is the message creator or event creator
    if (message.userId !== userId && message.event.creatorId !== userId) {
      throw new Error('You do not have permission to delete this message');
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: messageId },
    });

    // Notify through WebSocket
    getSocketService().emitToEvent(message.eventId, 'message-deleted', {
      messageId,
      eventId: message.eventId,
      deletedBy: userId,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventChatChannel(message.eventId), {
      type: 'MESSAGE_DELETED',
      messageId,
      eventId: message.eventId,
      deletedBy: userId,
      timestamp: new Date(),
    });

    return true;
  }
}

export const chatService = new ChatService();

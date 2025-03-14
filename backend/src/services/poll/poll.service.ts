import { PrismaClient } from '@prisma/client';
import { redisService } from '../redis.service';
import { getSocketService } from '../socket.service';
import { eventService } from '../event/event.service';

const prisma = new PrismaClient();

class PollService {
  async createPoll(data: {
    eventId: string;
    creatorId: string;
    question: string;
    options: string[];
    closeAt?: Date;
  }) {
    // Check if event exists and user is the creator
    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.creatorId !== data.creatorId) {
      throw new Error('Only the event creator can create polls');
    }

    // Create poll with options
    const poll = await prisma.poll.create({
      data: {
        question: data.question,
        closeAt: data.closeAt || null,
        eventId: data.eventId,
        options: {
          create: data.options.map((text) => ({ text })),
        },
      },
      include: {
        options: true,
      },
    });

    // Notify through WebSocket
    getSocketService().emitToEvent(data.eventId, 'poll-created', {
      poll,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventPollChannel(data.eventId), {
      type: 'POLL_CREATED',
      eventId: data.eventId,
      pollId: poll.id,
      question: poll.question,
      options: poll.options,
      timestamp: new Date(),
    });

    // Schedule poll closing if closeAt is provided
    if (data.closeAt) {
      const now = new Date();
      const delay = data.closeAt.getTime() - now.getTime();

      if (delay > 0) {
        setTimeout(async () => {
          await this.closePoll(poll.id, data.creatorId);
        }, delay);
      }
    }

    return poll;
  }

  async getPoll(pollId: string) {
    return prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          include: {
            votes: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getEventPolls(eventId: string) {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return prisma.poll.findMany({
      where: { eventId },
      include: {
        options: {
          include: {
            votes: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async vote(data: { userId: string; pollId: string; optionId: string }) {
    // Check if poll exists and is not closed
    const poll = await prisma.poll.findUnique({
      where: { id: data.pollId },
      include: {
        event: true,
        options: {
          where: { id: data.optionId },
        },
      },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (poll.isClosed) {
      throw new Error('Poll is closed');
    }

    if (poll.options.length === 0) {
      throw new Error('Invalid option');
    }

    // Check if user has access to the event
    const canAccessEvent = await prisma.event.findFirst({
      where: {
        id: poll.eventId,
        OR: [{ creatorId: data.userId }, { rsvps: { some: { userId: data.userId } } }],
      },
    });

    if (!canAccessEvent) {
      throw new Error('You must RSVP to this event before voting');
    }

    // Check if user has already voted for this poll
    const existingVote = await prisma.pollVote.findFirst({
      where: {
        userId: data.userId,
        option: {
          pollId: data.pollId,
        },
      },
    });

    // If user has already voted, update their vote
    if (existingVote) {
      await prisma.pollVote.delete({
        where: { id: existingVote.id },
      });
    }

    // Create new vote
    const vote = await prisma.pollVote.create({
      data: {
        userId: data.userId,
        optionId: data.optionId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        option: {
          include: {
            poll: true,
          },
        },
      },
    });

    // Get updated poll with votes
    const updatedPoll = await this.getPoll(data.pollId);

    // Notify through WebSocket
    getSocketService().emitToEvent(poll.eventId, 'poll-vote', {
      pollId: data.pollId,
      poll: updatedPoll,
      userId: data.userId,
      userName: vote.user.name,
      optionId: data.optionId,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventPollChannel(poll.eventId), {
      type: 'POLL_VOTE',
      eventId: poll.eventId,
      pollId: data.pollId,
      userId: data.userId,
      userName: vote.user.name,
      optionId: data.optionId,
      timestamp: new Date(),
    });

    return updatedPoll;
  }

  async closePoll(pollId: string, userId: string) {
    // Check if poll exists
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        event: true,
        options: {
          include: {
            votes: true,
          },
        },
      },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if user is the event creator
    if (poll.event.creatorId !== userId) {
      throw new Error('Only the event creator can close polls');
    }

    if (poll.isClosed) {
      throw new Error('Poll is already closed');
    }

    // Close the poll
    const closedPoll = await prisma.poll.update({
      where: { id: pollId },
      data: { isClosed: true },
      include: {
        options: {
          include: {
            votes: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Find the winning option (most votes)
    let winningOption = null;
    let maxVotes = -1;

    for (const option of closedPoll.options) {
      const voteCount = option.votes.length;
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningOption = option;
      }
    }

    // Notify through WebSocket
    getSocketService().emitToEvent(poll.event.id, 'poll-closed', {
      pollId,
      poll: closedPoll,
      winningOption,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventPollChannel(poll.event.id), {
      type: 'POLL_CLOSED',
      eventId: poll.event.id,
      pollId,
      winningOption,
      timestamp: new Date(),
    });

    // If this is a datetime poll, update the event time
    if (
      winningOption &&
      (poll.question.toLowerCase().includes('time') || poll.question.toLowerCase().includes('when'))
    ) {
      try {
        // Try to parse the winning option as a date
        const possibleDate = new Date(winningOption.text);
        if (!isNaN(possibleDate.getTime())) {
          await eventService.updateEvent(poll.event.id, {
            datetime: possibleDate,
          });
        }
      } catch (error) {
        console.log('Could not parse winning option as date', error);
      }
    }

    // If this is a location poll, update the event location
    if (
      winningOption &&
      (poll.question.toLowerCase().includes('where') ||
        poll.question.toLowerCase().includes('location'))
    ) {
      await eventService.updateEvent(poll.event.id, {
        locationText: winningOption.text,
      });
    }

    return closedPoll;
  }

  async deletePoll(pollId: string, userId: string) {
    // Check if poll exists
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        event: true,
      },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if user is the event creator
    if (poll.event.creatorId !== userId) {
      throw new Error('Only the event creator can delete polls');
    }

    // Delete the poll (cascade will delete options and votes)
    await prisma.poll.delete({
      where: { id: pollId },
    });

    // Notify through WebSocket
    getSocketService().emitToEvent(poll.event.id, 'poll-deleted', {
      pollId,
      eventId: poll.event.id,
      timestamp: new Date(),
    });

    // Publish to Redis for other services
    await redisService.publish(redisService.getEventPollChannel(poll.event.id), {
      type: 'POLL_DELETED',
      eventId: poll.event.id,
      pollId,
      timestamp: new Date(),
    });

    return true;
  }
}

export const pollService = new PollService();

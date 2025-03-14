"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { initializeSocket } from "@/lib/socket";
import EventCard from "@/components/EventCard";

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [hostedEvents, setHostedEvents] = useState([]);
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchEvents = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      // Fetch events created by the user
      const createdEvents = await api.getUserEvents(user.id, {
        role: "creator",
      });
      setHostedEvents(Array.isArray(createdEvents) ? createdEvents : []);

      // Fetch events the user is attending
      const attendingEvts = await api.getUserEvents(user.id, {
        role: "attendee",
      });
      setAttendingEvents(Array.isArray(attendingEvts) ? attendingEvts : []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast.error("Failed to load events");
      setHostedEvents([]);
      setAttendingEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Initialize socket
    const socket = initializeSocket(localStorage.getItem("token"), user.id);

    // Listen for new events where user is invited
    socket.on("event-invitation", (eventData) => {
      // Add the new event to the attending events list
      setAttendingEvents((prev) =>
        Array.isArray(prev) ? [eventData, ...prev] : [eventData]
      );
      toast.info(`You've been invited to ${eventData.title}`);
    });

    // Listen for RSVP updates
    socket.on("rsvp-updated", (data) => {
      // Refresh the events lists when RSVPs change
      fetchEvents();
      toast.info(`RSVP updated for ${data.eventTitle || "an event"}`);
    });

    // Listen for event updates
    socket.on("event-updated", (updatedEvent) => {
      // Update the event in both lists if it exists
      const updateEventInList = (list) => {
        if (!Array.isArray(list)) return list;
        return list.map((event) =>
          event.id === updatedEvent.id ? { ...event, ...updatedEvent } : event
        );
      };

      setHostedEvents(updateEventInList(hostedEvents));
      setAttendingEvents(updateEventInList(attendingEvents));
      toast.info(`Event "${updatedEvent.title}" has been updated`);
    });

    // Listen for event deletions
    socket.on("event-deleted", (data) => {
      // Remove the deleted event from both lists
      const removeEventFromList = (list) => {
        if (!Array.isArray(list)) return list;
        return list.filter((event) => event.id !== data.id);
      };

      setHostedEvents(removeEventFromList(hostedEvents));
      setAttendingEvents(removeEventFromList(attendingEvents));
      toast.info(`An event has been cancelled`);
    });

    return () => {
      socket.off("event-invitation");
      socket.off("rsvp-updated");
      socket.off("event-updated");
      socket.off("event-deleted");
    };
  }, [user, hostedEvents, attendingEvents]);

  if (authLoading || !user) {
    return <div className="container py-10">Loading...</div>;
  }

  // Make sure we have arrays before checking length
  const hasHostedEvents =
    Array.isArray(hostedEvents) && hostedEvents.length > 0;
  const hasAttendingEvents =
    Array.isArray(attendingEvents) && attendingEvents.length > 0;

  // Create a safe array of upcoming events
  const upcomingEvents = [
    ...(Array.isArray(hostedEvents) ? hostedEvents : []),
    ...(Array.isArray(attendingEvents) ? attendingEvents : []),
  ].filter((e) => new Date(e.datetime) > new Date());

  const hasUpcomingEvents = upcomingEvents.length > 0;

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/events/create">
            <PlusIcon className="mr-2 h-4 w-4" /> Create Event
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Upcoming Events
          </TabsTrigger>
          <TabsTrigger value="hosting">
            <UsersIcon className="mr-2 h-4 w-4" />
            Hosting
          </TabsTrigger>
          <TabsTrigger value="attending">
            <UsersIcon className="mr-2 h-4 w-4" />
            Attending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-[200px]">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : hasUpcomingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-lg font-medium mb-2">
                You don&apos;t have any upcoming events
              </h3>
              <p className="text-muted-foreground mb-6">
                Create or join an event to see it here.
              </p>
              <Button asChild>
                <Link href="/events/create">
                  <PlusIcon className="mr-2 h-4 w-4" /> Create Event
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="hosting">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="h-[200px]">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : hasHostedEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hostedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-lg font-medium mb-2">
                You&apos;re not hosting any events
              </h3>
              <p className="text-muted-foreground mb-6">
                Create a new event to see it here.
              </p>
              <Button asChild>
                <Link href="/events/create">
                  <PlusIcon className="mr-2 h-4 w-4" /> Create Event
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attending">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="h-[200px]">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : hasAttendingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {attendingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-lg font-medium mb-2">
                You&apos;re not attending any events
              </h3>
              <p className="text-muted-foreground mb-6">
                Join an event to see it here.
              </p>
              <Button asChild variant="outline">
                <Link href="/events">Browse Events</Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

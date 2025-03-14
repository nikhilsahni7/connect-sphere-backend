"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { getSocket } from "@/lib/socket";
import api from "@/lib/api";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  MessageCircleIcon,
  BarChartIcon,
  Share2Icon,
  PlusIcon,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [rsvpCounts, setRsvpCounts] = useState({ YES: 0, MAYBE: 0, NO: 0 });
  const [userRsvp, setUserRsvp] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRsvpLoading, setIsRsvpLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchEventData = async () => {
      try {
        setIsLoading(true);

        // Fetch event details
        const eventResponse = await api.get(`/events/${id}`);
        setEvent(eventResponse.data);

        // Fetch participants
        const participantsResponse = await api.get(`/participants/${id}`);
        setParticipants(participantsResponse.data);

        // Fetch RSVP counts
        const rsvpCountsResponse = await api.get(`/rsvp/${id}/counts`);
        setRsvpCounts(rsvpCountsResponse.data);

        // Fetch user's RSVP
        try {
          const userRsvpResponse = await api.get(`/rsvp/${id}`);
          setUserRsvp(userRsvpResponse.data);
        } catch (error) {
          // User hasn't RSVP'd yet
          setUserRsvp(null);
        }
      } catch (error) {
        console.error("Failed to fetch event data:", error);
        toast.error("Failed to load event details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventData();

    // Set up socket listeners for real-time updates
    const socket = getSocket();

    socket.on(`event:${id}:update`, (updatedEvent) => {
      setEvent(updatedEvent);
    });

    socket.on(`event:${id}:participant:join`, (newParticipant) => {
      setParticipants((prev) => [...prev, newParticipant]);
    });

    socket.on(`event:${id}:participant:leave`, (userId) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
    });

    socket.on(`event:${id}:rsvp:update`, (updatedCounts) => {
      setRsvpCounts(updatedCounts);
    });

    return () => {
      socket.off(`event:${id}:update`);
      socket.off(`event:${id}:participant:join`);
      socket.off(`event:${id}:participant:leave`);
      socket.off(`event:${id}:rsvp:update`);
    };
  }, [id, user]);

  useEffect(() => {
    if (!user) return;

    // Initialize socket connection
    const socket = getSocket(); // Use getSocket instead of initializeSocket since it's already initialized

    // Join event room
    socket.emit("join-event", id);

    // Join user room
    socket.emit("join-user", user.id);

    // Listen for event updates
    socket.on(`event:${id}:update`, (updatedEvent) => {
      setEvent((prev) => ({ ...prev, ...updatedEvent }));
    });

    // Listen for RSVP updates
    socket.on("rsvp-updated", (data) => {
      if (data.eventId === id) {
        // Refresh RSVP counts
        fetchRSVPCounts();
        // If this is the current user's RSVP, update the UI
        if (data.userId === user.id) {
          setUserRsvp(data);
        }
      }
    });

    // Clean up on unmount
    return () => {
      socket.off(`event:${id}:update`);
      socket.off("rsvp-updated");
      socket.emit("leave-event", id);
    };
  }, [id, user]);

  const fetchRSVPCounts = async () => {
    try {
      const rsvpCountsResponse = await api.get(`/rsvp/${id}/counts`);
      setRsvpCounts(rsvpCountsResponse.data);
    } catch (error) {
      console.error("Failed to fetch RSVP counts:", error);
      setRsvpCounts({ YES: 0, MAYBE: 0, NO: 0 });
    }
  };

  const handleRSVP = async (status) => {
    if (!user) {
      toast.error("Please log in to RSVP");
      router.push("/login");
      return;
    }

    setIsRsvpLoading(true);
    try {
      const response = await api.post(`/rsvp/${id}`, {
        status,
        hasPlusOne: userRsvp?.hasPlusOne || false,
        plusOneName: userRsvp?.plusOneName || "",
        comment: userRsvp?.comment || "",
        // Add dietary preferences if they exist in the UI
        dietaryPatterns: userRsvp?.dietaryPatterns || [],
        religiousDietary: userRsvp?.religiousDietary || [],
        allergies: userRsvp?.allergies || [],
        lifestyleChoices: userRsvp?.lifestyleChoices || [],
        intensityPrefs: userRsvp?.intensityPrefs || [],
        alcoholPrefs: userRsvp?.alcoholPrefs || [],
        customDietaryNotes: userRsvp?.customDietaryNotes || "",
      });

      setUserRsvp(response.data);
      toast.success(`You've RSVP'd ${status.toLowerCase()}`);

      // Update RSVP counts locally for immediate feedback
      setRsvpCounts((prev) => ({
        ...prev,
        [status]: prev[status] + 1,
        // Decrease previous status count if changing RSVP
        ...(userRsvp?.status && userRsvp.status !== status
          ? { [userRsvp.status]: Math.max(0, prev[userRsvp.status] - 1) }
          : {}),
      }));
    } catch (error) {
      console.error("RSVP error:", error);
      toast.error("Failed to update your RSVP");
    } finally {
      setIsRsvpLoading(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!event) return;

    const startTime = new Date(event.datetime);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 2); // Default to 2 hours

    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${event.title}`,
      `DTSTART:${startTime
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/g, "")}`,
      `DTEND:${endTime
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/g, "")}`,
      `LOCATION:${event.location}`,
      `DESCRIPTION:${event.description || ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event.title}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareEvent = () => {
    if (navigator.share) {
      navigator
        .share({
          title: event.title,
          text: `Join me at ${event.title}!`,
          url: window.location.href,
        })
        .catch((error) => console.error("Error sharing:", error));
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Event link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>

          <Skeleton className="h-64 mb-8" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Event not found</h1>
        <p className="mb-6">
          The event you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const isCreator = user?.id === event.creatorId;
  const eventDate = new Date(event.datetime);
  const isPastEvent = eventDate < new Date();

  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
            <div className="flex items-center text-muted-foreground">
              <CalendarIcon className="mr-1 h-4 w-4" />
              <span>
                {format(eventDate, "PPP")} at {format(eventDate, "p")}
              </span>
            </div>
          </div>

          <div className="flex mt-4 md:mt-0 space-x-2">
            {isCreator && (
              <Button variant="outline" asChild>
                <Link href={`/events/${id}/edit`}>Edit Event</Link>
              </Button>
            )}
            <Button variant="outline" onClick={handleAddToCalendar}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              Add to Calendar
            </Button>
            <Button variant="outline" onClick={handleShareEvent}>
              <Share2Icon className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {!isPastEvent && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>RSVP to this event</CardTitle>
              <CardDescription>
                Let the host know if you&#39;re coming
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={userRsvp?.status === "YES" ? "default" : "outline"}
                  onClick={() => handleRSVP("YES")}
                  disabled={isRsvpLoading}
                >
                  {isRsvpLoading && userRsvp?.status !== "YES" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>Yes ({rsvpCounts.YES})</>
                  )}
                </Button>
                <Button
                  variant={userRsvp?.status === "MAYBE" ? "default" : "outline"}
                  onClick={() => handleRSVP("MAYBE")}
                  disabled={isRsvpLoading}
                >
                  {isRsvpLoading && userRsvp?.status !== "MAYBE" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>Maybe ({rsvpCounts.MAYBE})</>
                  )}
                </Button>
                <Button
                  variant={userRsvp?.status === "NO" ? "default" : "outline"}
                  onClick={() => handleRSVP("NO")}
                  disabled={isRsvpLoading}
                >
                  {isRsvpLoading && userRsvp?.status !== "NO" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>No ({rsvpCounts.NO})</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="details" className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="attendees">Attendees</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="polls">Polls</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {event.description || "No description provided."}
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-2">Location</h3>
                  <div className="flex items-start">
                    <MapPinIcon className="h-5 w-5 mr-2 mt-0.5 text-muted-foreground" />
                    <div>
                      <p>{event.location}</p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View on Google Maps
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-2">Event Type</h3>
                  {event.eventType ? (
                    <Badge variant="outline">
                      {event.eventType.charAt(0).toUpperCase() +
                        event.eventType.slice(1).toLowerCase()}
                    </Badge>
                  ) : (
                    <Badge variant="outline">General</Badge>
                  )}
                  {event.isPrivate && (
                    <Badge variant="outline" className="ml-2">
                      Private
                    </Badge>
                  )}
                  {event.hasDietaryRestrictions && (
                    <Badge variant="outline" className="ml-2">
                      Food Event
                    </Badge>
                  )}
                </div>

                {event.maxParticipants && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2">Capacity</h3>
                      <p>
                        {participants.length} / {event.maxParticipants}{" "}
                        participants
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendees">
            <Card>
              <CardHeader>
                <CardTitle>Attendees</CardTitle>
                <CardDescription>
                  {rsvpCounts.YES} confirmed, {rsvpCounts.MAYBE} maybe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {participants.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-3">
                        Going ({rsvpCounts.YES})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {participants
                          .filter((p) => p.rsvpStatus === "YES")
                          .map((participant) => (
                            <div
                              key={participant.userId}
                              className="flex items-center space-x-3"
                            >
                              <Avatar>
                                <AvatarImage src={participant.user?.avatar} />
                                <AvatarFallback>
                                  {participant.user?.name?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {participant.user?.name}
                                </p>
                                {participant.plusOne && (
                                  <p className="text-sm text-muted-foreground">
                                    +1 guest
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {participants.filter((p) => p.rsvpStatus === "MAYBE")
                      .length > 0 && (
                      <div>
                        <h3 className="font-medium mb-3">
                          Maybe ({rsvpCounts.MAYBE})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {participants
                            .filter((p) => p.rsvpStatus === "MAYBE")
                            .map((participant) => (
                              <div
                                key={participant.userId}
                                className="flex items-center space-x-3"
                              >
                                <Avatar>
                                  <AvatarImage src={participant.user?.avatar} />
                                  <AvatarFallback>
                                    {participant.user?.name?.charAt(0) || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {participant.user?.name}
                                  </p>
                                  {participant.plusOne && (
                                    <p className="text-sm text-muted-foreground">
                                      +1 guest
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No attendees yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

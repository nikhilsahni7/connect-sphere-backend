import React from "react";
import { format } from "date-fns";
import { CalendarIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function EventCard({ event }) {
  // Format the date
  const formattedDate = event.datetime
    ? format(new Date(event.datetime), "PPP")
    : "Date not set";

  // Format the time
  const formattedTime = event.datetime
    ? format(new Date(event.datetime), "p")
    : "Time not set";

  // Check if event is in the past
  const isPast = event.datetime && new Date(event.datetime) < new Date();

  return (
    <Card className={isPast ? "opacity-70" : ""}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="line-clamp-1">{event.title}</CardTitle>
            <CardDescription className="flex items-center mt-1">
              <CalendarIcon className="h-4 w-4 mr-1" />
              {formattedDate} at {formattedTime}
            </CardDescription>
          </div>
          {event.eventType && (
            <Badge variant={event.isPublic ? "default" : "outline"}>
              {event.eventType}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {event.locationText && (
          <p className="text-sm text-muted-foreground flex items-center mb-2">
            <MapPinIcon className="h-4 w-4 mr-1" />
            {event.locationText}
          </p>
        )}
        {event.attendeeCount !== undefined && (
          <p className="text-sm text-muted-foreground flex items-center">
            <UsersIcon className="h-4 w-4 mr-1" />
            {event.attendeeCount}{" "}
            {event.attendeeCount === 1 ? "attendee" : "attendees"}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={`/events/${event.id}`}>
            {isPast ? "View Past Event" : "View Event"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

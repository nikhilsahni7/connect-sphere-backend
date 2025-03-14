import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Event methods
api.createEvent = async (eventData) => {
  const response = await fetch(`${API_URL}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create event");
  }

  return response.json();
};

api.getEvents = async (options = {}) => {
  const queryParams = new URLSearchParams();
  if (options.page) queryParams.append("page", options.page);
  if (options.limit) queryParams.append("limit", options.limit);
  if (options.search) queryParams.append("search", options.search);
  if (options.upcoming !== undefined)
    queryParams.append("upcoming", options.upcoming);

  const response = await fetch(`${API_URL}/events?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch events");
  }

  return response.json();
};

api.getUserEvents = async (userId, options = {}) => {
  const queryParams = new URLSearchParams();
  if (options.upcoming !== undefined)
    queryParams.append("upcoming", options.upcoming);

  const response = await fetch(
    `${API_URL}/events/user/${userId}?${queryParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch user events");
  }

  return response.json();
};

api.getEvent = async (eventId) => {
  const response = await fetch(`${API_URL}/events/${eventId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch event");
  }

  return response.json();
};

api.updateEvent = async (eventId, eventData) => {
  const response = await fetch(`${API_URL}/events/${eventId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update event");
  }

  return response.json();
};

api.deleteEvent = async (eventId) => {
  const response = await fetch(`${API_URL}/events/${eventId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete event");
  }

  return response.json();
};

// RSVP methods
api.createOrUpdateRSVP = async (eventId, rsvpData) => {
  const response = await fetch(`${API_URL}/rsvp/${eventId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(rsvpData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update RSVP");
  }

  return response.json();
};

api.getRSVP = async (eventId) => {
  const response = await fetch(`${API_URL}/rsvp/${eventId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch RSVP");
  }

  return response.json();
};

api.getRSVPCounts = async (eventId) => {
  const response = await fetch(`${API_URL}/rsvp/${eventId}/counts`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch RSVP counts");
  }

  return response.json();
};

api.removeRSVP = async (eventId) => {
  const response = await fetch(`${API_URL}/rsvp/${eventId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to remove RSVP");
  }

  return response.json();
};

// Participant methods
api.getParticipants = async (eventId) => {
  const response = await fetch(`${API_URL}/participants/${eventId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch participants");
  }

  return response.json();
};

api.leaveEvent = async (eventId) => {
  const response = await fetch(`${API_URL}/participants/${eventId}/leave`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to leave event");
  }

  return response.json();
};

api.kickParticipant = async (eventId, userId) => {
  const response = await fetch(
    `${API_URL}/participants/${eventId}/kick/${userId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to kick participant");
  }

  return response.json();
};

export default api;

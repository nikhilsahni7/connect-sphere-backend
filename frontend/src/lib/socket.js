// src/lib/socket.js
import { io } from "socket.io-client";
import { toast } from "sonner";

let socket = null;

export const initializeSocket = (token, userId) => {
  if (socket) return socket;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  socket = io(API_URL, {
    auth: {
      token,
    },
  });

  socket.on("connect", () => {
    console.log("Socket connected");
    socket.emit("join", { userId });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("notification", (notification) => {
    toast(notification.title, {
      description: notification.message,
      action: notification.actionUrl
        ? {
            label: "View",
            onClick: () => (window.location.href = notification.actionUrl),
          }
        : undefined,
    });
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error("Socket not initialized. Call initializeSocket first.");
  }
  return socket;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

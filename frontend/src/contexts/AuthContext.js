"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { initializeSocket, closeSocket } from "@/lib/socket";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      const data = response.data;
      localStorage.setItem("token", data.token);
      setUser(data.user);

      // Initialize socket connection
      initializeSocket(data.token, data.user.id);

      router.push("/dashboard");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData) => {
    setIsLoading(true);
    try {
      // Validate required fields
      if (!userData.email || !userData.password || !userData.name) {
        toast.error("Email, password, and name are required");
        return false;
      }

      const response = await api.post("/auth/signup", userData);
      const data = response.data;
      localStorage.setItem("token", data.token);
      setUser(data.user);

      // Initialize socket connection
      initializeSocket(data.token, data.user.id);

      toast.success("Account created successfully!");
      router.push("/dashboard");
      return true;
    } catch (error) {
      console.error("Signup error:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to create account";
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);

    // Close socket connection
    closeSocket();

    router.push("/login");
  };

  const checkAuth = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("token");

    if (!token) {
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    try {
      const response = await api.get("/auth/me");
      const data = response.data;
      setUser(data);

      // Initialize socket connection
      initializeSocket(token, data.id);
    } catch (error) {
      console.error("Auth check error:", error);
      localStorage.removeItem("token");
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitialized,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

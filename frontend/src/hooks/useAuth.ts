"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { User, TokenResponse } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const autoAuth = useCallback(async () => {
    const email = "user@transcriber.local";
    const password = "transcriber";
    const name = "User";
    try {
      const data = (await api.post("/api/auth/login", { email, password })) as TokenResponse;
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
    } catch {
      const data = (await api.post("/api/auth/register", { email, password, name })) as TokenResponse;
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    let token = localStorage.getItem("access_token");
    if (!token) {
      await autoAuth();
      token = localStorage.getItem("access_token");
    }
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/api/auth/me");
      setUser(data as User);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      await autoAuth();
      try {
        const data = await api.get("/api/auth/me");
        setUser(data as User);
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [autoAuth]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const data = (await api.post("/api/auth/login", { email, password })) as TokenResponse;
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    await fetchUser();
  };

  const register = async (email: string, password: string, name: string) => {
    const data = (await api.post("/api/auth/register", { email, password, name })) as TokenResponse;
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    await fetchUser();
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return { user, loading, login, register, logout };
}

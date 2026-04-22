"use client";

import { useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/auth";
import { canAccessApi } from "@/lib/rbac";

type AuthUser = {
  username: string;
  name: string;
  role: Role;
};

export function useAuthz() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!mounted) return;
        setUser(data.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const can = useMemo(() => {
    return (pathname: string, method: string): boolean => {
      if (!user) return false;
      return canAccessApi(user.role, pathname, method);
    };
  }, [user]);

  return {
    user,
    loading,
    role: user?.role ?? null,
    can,
  };
}

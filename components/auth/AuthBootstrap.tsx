"use client";
import { useEffect } from "react";
import { hydrateAdmin } from "@/lib/auth";
export default function AuthBootstrap() {
  useEffect(() => { void hydrateAdmin(); }, []);
  return null;
}

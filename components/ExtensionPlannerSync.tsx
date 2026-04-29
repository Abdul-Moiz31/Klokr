"use client";

import { useEffect, useRef } from "react";
import type { PlannerTaskRule } from "@/lib/daily-planner/types";

type ChromeRuntime = {
  lastError?: { message: string };
  sendMessage: (
    extensionId: string,
    message: { type: string; rules: PlannerTaskRule[] },
    responseCallback?: () => void
  ) => void;
};

/**
 * Sends domain–task rules to the extension for tab-time attribution.
 * Requires NEXT_PUBLIC_Klokrs_EXTENSION_ID.
 */
export function ExtensionPlannerSync({
  rules,
}: {
  rules: PlannerTaskRule[];
}) {
  const extId = process.env.NEXT_PUBLIC_Klokrs_EXTENSION_ID;
  const lastJson = useRef<string>("");

  useEffect(() => {
    if (!extId || typeof window === "undefined") return;
    const payload = JSON.stringify(rules);
    if (payload === lastJson.current) return;
    lastJson.current = payload;

    const runtime = (window as unknown as { chrome?: { runtime?: ChromeRuntime } })
      .chrome?.runtime;
    if (!runtime?.sendMessage) return;

    runtime.sendMessage(
      extId,
      { type: "SET_PLANNER_RULES", rules },
      () => {
        void runtime.lastError;
      }
    );
  }, [extId, rules]);

  return null;
}

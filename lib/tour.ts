export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** Pathname this step's target only exists on. Tour navigates here if needed. */
  route?: string;
  /** Appended to the route when navigating to this step. */
  routeQuery?: string;
  placement?: "right" | "bottom" | "left";
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "sidebar-dashboard",
    title: "Your Dashboard",
    body: "A snapshot of today — time tracked, your accountability score, and streaks, all in one place.",
    placement: "right",
  },
  {
    id: "sidebar-activity",
    title: "Activity",
    body: "A 90-day heatmap of your tracked time, plus today's full domain-by-domain breakdown.",
    placement: "right",
  },
  {
    id: "sidebar-reports",
    title: "Reports",
    body: "Daily, weekly, and monthly breakdowns with charts and category splits — exportable as PDF.",
    placement: "right",
  },
  {
    id: "sidebar-progress",
    title: "Progress",
    body: "Your level, streak, personal records, and badges — earned from your own tracked time.",
    placement: "right",
  },
  {
    id: "sidebar-pomodoro",
    title: "Pomodoro",
    body: "Focus sessions with built-in breaks and a lightweight task list for the session.",
    placement: "right",
  },
  {
    id: "sidebar-daily-planner",
    title: "Daily planner",
    body: "Plan your day hour by hour, with routine templates you can reuse every day.",
    placement: "right",
  },
  {
    id: "sidebar-ai",
    title: "AI Insights",
    body: "Ask plain-English questions about your tracked time — \"How much time did I spend on YouTube this week?\"",
    placement: "right",
  },
  {
    id: "header-search",
    title: "Ask from anywhere",
    body: "This same AI search box lives in the header on every page, so you don't need to leave what you're doing.",
    placement: "bottom",
  },
  {
    id: "sidebar-settings",
    title: "One last thing — Settings",
    body: "This is where you control how Klokr scores your time. Let's set your productive-day threshold now.",
    placement: "right",
  },
  {
    id: "productivity-threshold",
    title: "Your productive-day threshold",
    body: "Days where you track at least this many hours are marked productive on your Activity heatmap and count toward your streak. Pick whatever fits how you work — you can change it any time.",
    placement: "bottom",
    route: "/dashboard/settings",
    routeQuery: "?tab=preferences",
  },
];

export const TOUR_STORAGE_KEY = "klokrs_tour_completed_v1";
export const TOUR_START_EVENT = "klokrs:start-tour";

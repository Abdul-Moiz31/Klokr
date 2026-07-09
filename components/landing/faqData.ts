export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How is my data stored?",
    a: "Your data lives in Supabase (PostgreSQL) on AWS, encrypted at rest and in transit. Row-level security means only your account can ever read your data — even we query it the same way you do.",
  },
  {
    q: "What does the extension actually record?",
    a: "Just the domain and page title of tabs you visit, plus start time, end time, and duration. We never capture full URLs, page content, form inputs, passwords, or anything you type — and incognito tabs are never tracked.",
  },
  {
    q: "Do I have to start a timer every day?",
    a: "No. Klokrs tracks passively while you browse. You can set daily tracking hours (e.g. 9am–5pm) in Dashboard Settings, and the extension automatically tracks within that window — nothing to start or stop yourself. The Daily Planner and Pomodoro timer are optional layers on top if you want more structure.",
  },
  {
    q: "Can I use the dashboard without the extension?",
    a: "You can sign in and view the app, but tab time and domain analytics only populate once the Chrome extension is installed and tracking is enabled on the browser you want measured.",
  },
  {
    q: "Is Klokrs really free?",
    a: "Yes — every feature on the Free plan is free today, no credit card required. We're building paid Standard and Pro tiers for extra features like PDF export and API access, but nothing you already use for free will be paywalled, and you'll be notified before anything changes.",
  },
  {
    q: "Which browsers are supported?",
    a: "Klokrs is a Manifest V3 Chrome extension, so it works on Chrome and other Chromium-based browsers (Edge, Brave, Arc). Firefox and Safari support isn't available yet.",
  },
  {
    q: "Does the Ask AI feature cost extra?",
    a: "No — Ask AI is bring-your-own-key. Connect your own OpenAI, Gemini, Anthropic, or OpenRouter API key and ask questions about your tracked data. You're billed by your AI provider directly, not by Klokrs.",
  },
  {
    q: "How do I delete my data or account?",
    a: "Go to Settings — you can pause tracking anytime, export everything as CSV, or permanently delete your account. Deletion is irreversible and fully processed within 30 days.",
  },
  {
    q: "Can Klokrs block distracting sites for me?",
    a: "Yes — and there's no toggle to remember. Add an always-blocked list once in Settings for sites you never want open, then tag any Daily Planner task with sites to block only during that task's scheduled window. It enforces itself the moment the window starts and lifts automatically the moment it ends.",
  },
  {
    q: "Does Klokrs know if I actually finished a scheduled task?",
    a: "Yes. Any task you tag with domains auto-resolves the moment its scheduled window ends — done if you hit your completion threshold (80% by default, adjustable in Settings), partial if you were on-task 50–79% of the window, or missed below that. No manual checkbox required, and the same status shows up in the Daily Planner, the Week view, and the dashboard's Plan vs Actual card.",
  },
];

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/reports", "/activity", "/progress", "/ai", "/pomodoro", "/routine-templates", "/daily-planner"],
    },
    sitemap: "https://klokrs.com/sitemap.xml",
  };
}

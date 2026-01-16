import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(timestamp);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case "positive":
      return "bg-green-100 text-green-800 border-green-200";
    case "negative":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getClassificationColor(classification: string | null): string {
  switch (classification) {
    case "question":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "showcase":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "tutorial":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "resource":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "feedback_request":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "discussion":
      return "bg-green-100 text-green-800 border-green-200";
    case "announcement":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "rant":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "self_promo":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "spam":
      return "bg-red-100 text-red-800 border-red-200";
    // Legacy classifications for backward compatibility
    case "thought_leadership":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "low_effort":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getClassificationLabel(classification: string | null): string {
  switch (classification) {
    case "question":
      return "Question";
    case "showcase":
      return "Showcase";
    case "tutorial":
      return "Tutorial";
    case "resource":
      return "Resource";
    case "feedback_request":
      return "Feedback";
    case "discussion":
      return "Discussion";
    case "announcement":
      return "Announcement";
    case "rant":
      return "Rant";
    case "self_promo":
      return "Self-Promo";
    case "spam":
      return "Spam";
    // Legacy classifications for backward compatibility
    case "thought_leadership":
      return "Thought Leadership";
    case "low_effort":
      return "Low Effort";
    default:
      return classification ? classification.replace(/_/g, " ") : "Unknown";
  }
}

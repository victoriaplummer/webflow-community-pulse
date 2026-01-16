import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface StarButtonProps {
  contentId: number;
  initialStarred?: boolean;
  size?: "sm" | "default";
  onToggle?: (starred: boolean) => void;
}

export function StarButton({
  contentId,
  initialStarred = false,
  size = "default",
  onToggle,
}: StarButtonProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      const response = await fetch(`/pulse/api/content/${contentId}/star`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle star");
      }

      const data = await response.json();
      setStarred(data.isRoundupCandidate);
      onToggle?.(data.isRoundupCandidate);
    } catch (error) {
      console.error("Error toggling star:", error);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const buttonSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        buttonSize,
        "transition-colors",
        starred && "text-yellow-500 hover:text-yellow-600"
      )}
      onClick={handleClick}
      disabled={loading}
      title={starred ? "Remove from roundup candidates" : "Add to roundup candidates"}
    >
      <Star
        className={cn(
          iconSize,
          loading && "animate-pulse",
          starred && "fill-yellow-500"
        )}
      />
    </Button>
  );
}

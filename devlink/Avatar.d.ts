import * as React from "react";
import * as Types from "./types";

declare function Avatar(props: {
  as?: React.ElementType;
  /** Optional: Add Additional Tailwind CSS classes*/
  className?: Types.Builtin.Text;
  /** Add the Avatar Image Component here as a slot*/
  content?: Types.Slots.SlotContent;
  /** Controls the size of the avatar.*/
  size?: "default" | "sm" | "lg" | "xl";
}): React.JSX.Element;

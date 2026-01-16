import * as React from "react";
import * as Types from "./types";

declare function AvatarImage(props: {
  as?: React.ElementType;
  /** Optional: Add Additional Tailwind CSS classes*/
  className?: Types.Builtin.Text;
  /** Select an image for the avatar.*/
  image?: Types.Asset.Image;
}): React.JSX.Element;

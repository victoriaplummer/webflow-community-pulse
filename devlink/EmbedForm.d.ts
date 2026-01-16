import * as React from "react";
import * as Types from "./types";

declare function EmbedForm(props: {
  as?: React.ElementType;
  formUrl?: Types.Builtin.Text;
  width?: Types.Builtin.Text;
  height?: Types.Builtin.Text;
  title?: Types.Builtin.Text;
}): React.JSX.Element;

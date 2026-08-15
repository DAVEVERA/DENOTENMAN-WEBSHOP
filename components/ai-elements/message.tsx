"use client";

import { memo, type ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/cn";

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(({ className, ...props }: MessageResponseProps) => (
  <Streamdown className={cn("text-body-sm leading-relaxed text-text", className)} {...props} />
));

MessageResponse.displayName = "MessageResponse";

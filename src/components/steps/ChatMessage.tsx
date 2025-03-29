import React from "react";
import { Card } from "@/components/ui/card";

interface ChatMessageProps {
  message: string;
  isUser?: boolean;
}

export function ChatMessage({ message, isUser = false }: ChatMessageProps) {
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <Card className={`p-4 max-w-[80%] ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        <div className="text-sm">
          {message}
        </div>
      </Card>
    </div>
  );
} 
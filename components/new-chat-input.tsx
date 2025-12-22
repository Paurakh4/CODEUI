"use client";

import { AI_Prompt } from "@/components/ui/animated-ai-input";

interface NewChatInputProps {
    onSend?: (message: string) => void;
}

export function NewChatInput({ onSend }: NewChatInputProps) {
    return <AI_Prompt onSend={onSend} />;
}

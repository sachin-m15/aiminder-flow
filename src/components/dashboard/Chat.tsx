import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    text: string;
    role: "user" | "assistant";
    timestamp: Date;
}

interface ChatProps {
    userRole: "admin" | "employee";
}

interface ChatResponse {
    response: string;
    conversation_id: string;
    requires_followup: boolean;
    followup_question?: string;
}

const Chat = ({ userRole }: ChatProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const chatbotApiUrl = import.meta.env.VITE_CHATBOT_API_URL;

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputMessage,
            role: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputMessage("");
        setIsLoading(true);

        try {
            const response = await fetch(chatbotApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: inputMessage,
                    conversation_id: conversationId,
                    role: userRole,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: ChatResponse = await response.json();

            // Update conversation ID if this is the first message
            if (!conversationId && data.conversation_id) {
                setConversationId(data.conversation_id);
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: data.response,
                role: "assistant",
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message. Please make sure the chatbot API is running.");

            // Add error message to chat
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I'm having trouble connecting to the chatbot service. Please try again later.",
                role: "assistant",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([]);
        setConversationId(null);
        toast.success("Chat history cleared");
    };

    return (
        <Card className="flex flex-col h-[calc(100vh-12rem)]">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-6 w-6" />
                        <CardTitle>AI Assistant</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearChat}>
                        Clear Chat
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 p-4">
                {/* Messages Area */}
                <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Welcome to AI Assistant</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    I'm here to help you with tasks, employee management, and more.
                                    Ask me anything!
                                </p>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    "flex gap-3",
                                    message.role === "user" ? "justify-end" : "justify-start"
                                )}
                            >
                                {message.role === "assistant" && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-primary">
                                            <Bot className="h-5 w-5 text-primary-foreground" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}

                                <div
                                    className={cn(
                                        "rounded-lg px-4 py-2 max-w-[80%]",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-foreground"
                                    )}
                                >
                                    <div className={cn(
                                        "text-sm max-w-none",
                                        message.role === "user"
                                            ? "text-primary-foreground"
                                            : "prose prose-sm dark:prose-invert"
                                    )}>
                                        {message.role === "assistant" ? (
                                            <ReactMarkdown
                                                components={{
                                                    h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-2 mb-1" {...props} />,
                                                    h2: ({ node, ...props }) => <h2 className="text-base font-bold mt-2 mb-1" {...props} />,
                                                    h3: ({ node, ...props }) => <h3 className="text-sm font-bold mt-1 mb-1" {...props} />,
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                                    li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                                                    code: ({ ...props }) => (
                                                        <code className="bg-muted-foreground/20 px-1 py-0.5 rounded text-xs" {...props} />
                                                    ),
                                                    pre: ({ node, ...props }) => (
                                                        <pre className="bg-muted-foreground/20 p-2 rounded my-2 text-xs overflow-x-auto" {...props} />
                                                    ),
                                                    strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                                                    em: ({ node, ...props }) => <em className="italic" {...props} />,
                                                    a: ({ node, ...props }) => <a className="underline hover:text-primary" {...props} />,
                                                }}
                                            >
                                                {message.text}
                                            </ReactMarkdown>
                                        ) : (
                                            <p className="whitespace-pre-wrap text-primary-foreground">{message.text}</p>
                                        )}
                                    </div>
                                    <p className={cn(
                                        "text-xs mt-1",
                                        message.role === "user"
                                            ? "text-primary-foreground/70"
                                            : "text-muted-foreground"
                                    )}>
                                        {message.timestamp.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>

                                {message.role === "user" && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-secondary">
                                            <User className="h-5 w-5" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary">
                                        <Bot className="h-5 w-5 text-primary-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="rounded-lg px-4 py-2 bg-muted">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Type your message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                        className="flex-1"
                    />
                    <Button
                        onClick={sendMessage}
                        disabled={isLoading || !inputMessage.trim()}
                        size="icon"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default Chat;

"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PerformanceTaskSummary } from "@/components/PerformanceTaskSummary";
import { PerformanceTask } from "@/lib/langchain/schemas";

export default function Home() {
  const [sessionId, setSessionId] = useState<string>("");
  const [topic, setTopic] = useState<string>("Revolutions and Change");
  const [unitTitle, setUnitTitle] = useState<string>("Revolutionary Movements");
  const [gradeName, setGradeName] = useState<string>("8th");
  const [messages, setMessages] = useState<{role: "user" | "assistant"; content: string}[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showTopicInput, setShowTopicInput] = useState<boolean>(true);
  const [performanceTask, setPerformanceTask] = useState<Partial<PerformanceTask> | null>(null);

  // Store sessionId in localStorage when it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('ptSessionId', sessionId);
    }
  }, [sessionId]);

  // Try to restore sessionId from localStorage on first load
  useEffect(() => {
    const savedSessionId = localStorage.getItem('ptSessionId');
    if (savedSessionId) {
      setSessionId(savedSessionId);
      setShowTopicInput(false);
    }
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session on topic submission
  const handleTopicSubmit = async () => {
    if (!topic.trim() || !unitTitle.trim() || !gradeName.trim()) return;
    
    setIsLoading(true);
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    // Save to localStorage
    localStorage.setItem('ptSessionId', newSessionId);
    
    try {
      const response = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId: newSessionId, 
          topic,
          unitTitle,
          gradeName
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessages([{ role: "assistant", content: data.message }]);
        setShowTopicInput(false);
      } else {
        console.error("Error initializing session:", data.error);
      }
    } catch (error) {
      console.error("Error initializing session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle special responses like "yes" to view performance task summary
  const handleSpecialResponses = (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // Check if the last assistant message was about viewing the performance task summary
    const lastAssistantMessage = messages.filter(m => m.role === "assistant").pop();
    if (lastAssistantMessage && lastAssistantMessage.content.includes("Would you like to see the full performance task summary?")) {
      if (lowerMessage === "yes" || lowerMessage === "y") {
        // If user says "yes" to viewing summary, fetch the final result
        return true;
      }
    }
    
    return false;
  };

  // Send user message to API
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId) return;
    
    const userMessage = inputMessage;
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    
    // Check if this is a special response (like "yes" to view summary)
    const isSpecialResponse = handleSpecialResponses(userMessage);
    
    try {
      const response = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, 
          message: userMessage,
          isPerformanceTaskSummaryRequest: isSpecialResponse 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
        
        // If we receive a performance task in the response, store it
        if (data.performanceTask) {
          setPerformanceTask(data.performanceTask);
        }
      } else {
        console.error("Error sending message:", data.error);
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "Sorry, there was an error processing your message." 
        }]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, there was an error processing your message." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showTopicInput) {
        handleTopicSubmit();
      } else {
        handleSendMessage();
      }
    }
  };

  // Format message content with Markdown-like syntax
  const formatMessage = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        // Bold text
        const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={i} dangerouslySetInnerHTML={{ __html: boldLine }} />;
      });
  };

  // Handle reset/start a new task
  const handleReset = () => {
    localStorage.removeItem('ptSessionId');
    setSessionId("");
    setMessages([]);
    setPerformanceTask(null);
    setShowTopicInput(true);
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-24">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl sm:text-2xl">Performance Task Designer</CardTitle>
              <CardDescription>
                Design authentic performance tasks for students step-by-step with AI assistance
              </CardDescription>
            </div>
            {!showTopicInput && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                New Task
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {showTopicInput ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  General Topic
                </label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter the general topic..."
                  className="w-full mb-4"
                  disabled={isLoading}
                />
                
                <label className="block text-sm font-medium mb-1">
                  Unit Title
                </label>
                <Input
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  placeholder="Enter the specific unit title..."
                  className="w-full mb-4"
                  disabled={isLoading}
                />
                
                <label className="block text-sm font-medium mb-1">
                  Grade Level
                </label>
                <Input
                  value={gradeName}
                  onChange={(e) => setGradeName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter the grade level..."
                  className="w-full mb-4"
                  disabled={isLoading}
                />
                
                <Button 
                  onClick={handleTopicSubmit} 
                  disabled={!topic.trim() || !unitTitle.trim() || !gradeName.trim() || isLoading}
                  className="w-full"
                >
                  {isLoading ? "Starting..." : "Create Performance Task"}
                </Button>
                
                <p className="text-xs text-muted-foreground mt-1">
                  Examples: Topic "Revolutions and Change", Unit "French Revolution", Grade "8th"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-[400px] overflow-y-auto border rounded-md p-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`mb-4 ${
                      message.role === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <div className="text-sm">
                        {formatMessage(message.content)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
                {isLoading && (
                  <div className="text-left mb-4">
                    <div className="inline-block p-3 rounded-lg bg-muted">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          {!showTopicInput && (
            <div className="flex gap-2 w-full">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 resize-none"
                disabled={isLoading}
                rows={2}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputMessage.trim() || isLoading}
              >
                Send
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Display performance task summary when available */}
      {performanceTask && (
        <div className="w-full max-w-3xl mx-auto mt-8">
          <PerformanceTaskSummary 
            task={performanceTask} 
            unitTitle={unitTitle}
            gradeName={gradeName}
          />
        </div>
      )}
    </main>
  );
}

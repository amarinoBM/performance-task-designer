"use client";

import { useReducer, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PerformanceTaskSummary } from "@/components/PerformanceTaskSummary";

// Define the state interface
interface AppState {
  sessionId: string;
  topic: string;
  unitTitle: string;
  gradeName: string;
  messages: Array<{role: "user" | "assistant", content: string}>;
  inputMessage: string;
  isLoading: boolean;
  showTopicInput: boolean;
  performanceTask: any | null;
}

// Define action types
type AppAction = 
  | { type: 'SET_SESSION_ID', payload: string }
  | { type: 'SET_TOPIC', payload: string }
  | { type: 'SET_UNIT_TITLE', payload: string }
  | { type: 'SET_GRADE_NAME', payload: string }
  | { type: 'SET_INPUT_MESSAGE', payload: string }
  | { type: 'SET_LOADING', payload: boolean }
  | { type: 'ADD_MESSAGE', payload: {role: "user" | "assistant", content: string} }
  | { type: 'SET_MESSAGES', payload: Array<{role: "user" | "assistant", content: string}> }
  | { type: 'SET_SHOW_TOPIC_INPUT', payload: boolean }
  | { type: 'SET_PERFORMANCE_TASK', payload: any | null }
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_SESSION', payload: Partial<AppState> };

// Define the reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'SET_TOPIC':
      return { ...state, topic: action.payload };
    case 'SET_UNIT_TITLE':
      return { ...state, unitTitle: action.payload };
    case 'SET_GRADE_NAME':
      return { ...state, gradeName: action.payload };
    case 'SET_INPUT_MESSAGE':
      return { ...state, inputMessage: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_SHOW_TOPIC_INPUT':
      return { ...state, showTopicInput: action.payload };
    case 'SET_PERFORMANCE_TASK':
      return { ...state, performanceTask: action.payload };
    case 'RESET_STATE':
      return {
        ...initialState,
        sessionId: '',
        messages: [],
        performanceTask: null,
        showTopicInput: true
      };
    case 'LOAD_SESSION':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// Define the initial state
const initialState: AppState = {
  sessionId: "",
  topic: "Revolutions and Change",
  unitTitle: "Revolutionary Movements",
  gradeName: "8th",
  messages: [],
  inputMessage: "",
  isLoading: false,
  showTopicInput: true,
  performanceTask: null
};

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('ptSessionId');
    if (savedSessionId) {
      dispatch({ type: 'LOAD_SESSION', payload: { 
        sessionId: savedSessionId,
        showTopicInput: false 
      }});
    }
  }, []);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (state.sessionId) {
      localStorage.setItem('ptSessionId', state.sessionId);
    }
  }, [state.sessionId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Initialize session on topic submission
  const handleTopicSubmit = async () => {
    if (!state.topic.trim() || !state.unitTitle.trim() || !state.gradeName.trim()) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    
    const newSessionId = uuidv4();
    dispatch({ type: 'SET_SESSION_ID', payload: newSessionId });
    
    try {
      const response = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId: newSessionId, 
          topic: state.topic,
          unitTitle: state.unitTitle,
          gradeName: state.gradeName
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        dispatch({ type: 'SET_MESSAGES', payload: [{ role: "assistant", content: data.message }] });
        dispatch({ type: 'SET_SHOW_TOPIC_INPUT', payload: false });
      } else {
        console.error("Error initializing session:", data.error);
      }
    } catch (error) {
      console.error("Error initializing session:", error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Send user message to API
  const handleSendMessage = async () => {
    if (!state.inputMessage.trim() || state.isLoading || !state.sessionId) return;
    
    const userMessage = state.inputMessage;
    dispatch({ type: 'SET_INPUT_MESSAGE', payload: '' });
    dispatch({ type: 'ADD_MESSAGE', payload: { role: "user", content: userMessage } });
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId: state.sessionId, 
          message: userMessage
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        dispatch({ type: 'ADD_MESSAGE', payload: { role: "assistant", content: data.message } });
        
        if (data.performanceTask) {
          dispatch({ type: 'SET_PERFORMANCE_TASK', payload: data.performanceTask });
        }
      } else {
        console.error("Error sending message:", data.error);
        dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: { 
            role: "assistant", 
            content: "Sorry, there was an error processing your message." 
          } 
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      dispatch({ 
        type: 'ADD_MESSAGE', 
        payload: { 
          role: "assistant", 
          content: "Sorry, there was an error processing your message." 
        } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (state.showTopicInput) {
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

  // Reset state and start new task
  const handleReset = () => {
    localStorage.removeItem('ptSessionId');
    dispatch({ type: 'RESET_STATE' });
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
            {!state.showTopicInput && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                New Task
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {state.showTopicInput ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  General Topic
                </label>
                <Input
                  value={state.topic}
                  onChange={(e) => dispatch({ type: 'SET_TOPIC', payload: e.target.value })}
                  placeholder="Enter the general topic..."
                  className="w-full mb-4"
                  disabled={state.isLoading}
                />
                
                <label className="block text-sm font-medium mb-1">
                  Unit Title
                </label>
                <Input
                  value={state.unitTitle}
                  onChange={(e) => dispatch({ type: 'SET_UNIT_TITLE', payload: e.target.value })}
                  placeholder="Enter the specific unit title..."
                  className="w-full mb-4"
                  disabled={state.isLoading}
                />
                
                <label className="block text-sm font-medium mb-1">
                  Grade Level
                </label>
                <Input
                  value={state.gradeName}
                  onChange={(e) => dispatch({ type: 'SET_GRADE_NAME', payload: e.target.value })}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter the grade level..."
                  className="w-full mb-4"
                  disabled={state.isLoading}
                />
                
                <Button 
                  onClick={handleTopicSubmit} 
                  disabled={!state.topic.trim() || !state.unitTitle.trim() || !state.gradeName.trim() || state.isLoading}
                  className="w-full"
                >
                  {state.isLoading ? "Starting..." : "Create Performance Task"}
                </Button>
                
                <p className="text-xs text-muted-foreground mt-1">
                  Examples: Topic "Revolutions and Change", Unit "French Revolution", Grade "8th"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-[400px] overflow-y-auto border rounded-md p-4">
                {state.messages.map((message, index) => (
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
                {state.isLoading && (
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
          {!state.showTopicInput && (
            <div className="flex gap-2 w-full">
              <Textarea
                value={state.inputMessage}
                onChange={(e) => dispatch({ type: 'SET_INPUT_MESSAGE', payload: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 resize-none"
                disabled={state.isLoading}
                rows={2}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!state.inputMessage.trim() || state.isLoading}
              >
                Send
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Display performance task summary when available */}
      {state.performanceTask && (
        <div className="w-full max-w-3xl mx-auto mt-8">
          <PerformanceTaskSummary 
            task={state.performanceTask} 
            unitTitle={state.unitTitle}
            gradeName={state.gradeName}
          />
        </div>
      )}
    </main>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { PerformanceTaskService } from "@/lib/langchain/service";
import { PerformanceTaskStepType } from "@/lib/langchain/schemas";

// Map to store active sessions
const activeSessions: Map<string, PerformanceTaskService> = new Map();

// Common error response helper
const errorResponse = (message: string, status: number = 400) => {
  return NextResponse.json({ error: message }, { status });
};

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, topic, unitTitle, gradeName } = await request.json();

    // Required parameter check
    if (!sessionId) {
      return errorResponse("Missing sessionId parameter");
    }

    // Get or create session
    let session = activeSessions.get(sessionId);
    
    // Initialize new session
    if (!session && topic) {
      if (!unitTitle || !gradeName) {
        return errorResponse("Missing unitTitle or gradeName parameters");
      }
      
      session = new PerformanceTaskService(topic);
      activeSessions.set(sessionId, session);
      const initialMessage = session.initialize(unitTitle, gradeName);
      return NextResponse.json({ message: initialMessage });
    }
    
    // Session not found
    if (!session) {
      return errorResponse("Session not found. Please create a new session with a topic, unitTitle, and gradeName.", 404);
    }

    // Process message
    if (!message) {
      return errorResponse("Missing message parameter");
    }
    
    try {
      // Process the message
      const response = await session.processMessage(message);
      
      // Get state and check if we're on the final step
      const state = session.getState();
      const currentStep = state.currentStep;
      
      // Include performance task data for final step
      if (currentStep === PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE) {
        return NextResponse.json({ 
          message: response,
          performanceTask: state.performanceTask
        });
      }
      
      return NextResponse.json({ message: response });
    } catch (error) {
      console.error("Error processing message:", error);
      return errorResponse("Failed to process message", 500);
    }
  } catch (error) {
    console.error("Error in performance task API:", error);
    return errorResponse("Failed to process request", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return errorResponse("Missing sessionId parameter");
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return errorResponse("Session not found", 404);
    }

    return NextResponse.json({ state: session.getState() });
  } catch (error) {
    console.error("Error getting session state:", error);
    return errorResponse("Failed to get session state", 500);
  }
} 
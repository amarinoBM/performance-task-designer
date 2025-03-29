import { NextRequest, NextResponse } from "next/server";
import { PerformanceTaskService } from "@/lib/langchain/service";
import { PerformanceTaskStepType } from "@/lib/langchain/schemas";

// Map to store active sessions
const activeSessions: Map<string, PerformanceTaskService> = new Map();

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, topic, unitTitle, gradeName, isPerformanceTaskSummaryRequest } = await request.json();

    // Check that we have all required parameters
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    let session = activeSessions.get(sessionId);

    // If the session doesn't exist and we're trying to create a new one
    if (!session && topic) {
      session = new PerformanceTaskService(topic);
      activeSessions.set(sessionId, session);
      
      // If unitTitle and gradeName are provided, initialize the performance task
      if (unitTitle && gradeName) {
        const initialMessage = session.initialize(unitTitle, gradeName);
        return NextResponse.json({ message: initialMessage });
      } else {
        return NextResponse.json(
          { error: "Missing unitTitle or gradeName parameters" },
          { status: 400 }
        );
      }
    }
    
    // If we couldn't find or create a session
    if (!session) {
      return NextResponse.json(
        { error: "Session not found. Please create a new session with a topic, unitTitle, and gradeName." },
        { status: 404 }
      );
    }

    // Process the message if provided
    if (message) {
      try {
        let response;
        
        // If this is a special request to get the performance task summary
        if (isPerformanceTaskSummaryRequest) {
          // Force the current step to be PERFORMANCE_TASK_COMPLETE if it's not already
          const currentState = session.getState();
          if (currentState.currentStep !== PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE) {
            // We need to process a message to advance to the next step
            // Just use a generic message that will be accepted
            response = await session.processMessage("yes");
          } else {
            // If we're already on the performance task complete step, just process the message
            response = await session.processMessage(message);
          }
        } else {
          // Normal message processing
          response = await session.processMessage(message);
        }
        
        // Get the current state to check if we're on the final step
        const state = session.getState();
        const currentStep = state.currentStep;
        
        // If we're on the final step, include the performance task data
        if (currentStep === PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE) {
          return NextResponse.json({ 
            message: response,
            performanceTask: state.performanceTask
          });
        }
        
        return NextResponse.json({ message: response });
      } catch (error) {
        console.error("Error processing message:", error);
        
        // Send a more helpful error response
        return NextResponse.json(
          { 
            message: "I encountered an error while processing your request. Please try again with a different prompt or refresh the page if the issue persists.",
            error: "Message processing failed" 
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Missing message parameter" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in performance task API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Get session state
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    const session = activeSessions.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ state: session.getState() });
  } catch (error) {
    console.error("Error getting session state:", error);
    return NextResponse.json(
      { error: "Failed to get session state" },
      { status: 500 }
    );
  }
} 
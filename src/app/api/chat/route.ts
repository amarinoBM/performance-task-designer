import { NextRequest, NextResponse } from "next/server";
import { processStepInput } from "@/lib/langchain/steps";

export async function POST(request: NextRequest) {
  try {
    const { stepId, userInput, history } = await request.json();

    if (!stepId || !userInput) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const response = await processStepInput(stepId, userInput, history);

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error processing chat:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
} 
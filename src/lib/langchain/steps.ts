import { PerformanceTaskUnit } from './schemas';
import { PerformanceTaskService } from './service';

/**
 * Process user input for a specific step in a conversation
 * 
 * @param stepId The ID of the step to process
 * @param userInput The user's input text
 * @param history Optional chat history for context
 * @returns The AI response from processing the step
 */
export async function processStepInput(
  stepId: string,
  userInput: string,
  history?: Array<{ role: string, content: string }>
): Promise<string> {
  try {
    // Create a new service instance
    const service = new PerformanceTaskService(userInput);
    
    // Process the message directly
    return await service.processMessage(userInput);
  } catch (error: unknown) {
    console.error("Error in processStepInput:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to process step: ${errorMessage}`);
  }
} 
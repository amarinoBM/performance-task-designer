import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { StepValidationResult, PerformanceTaskStepType } from "./schemas";

/**
 * Interface for step validators
 */
export interface StepValidator {
  validateStep(
    step: PerformanceTaskStepType,
    userInput: string,
    previousStepOutput: any
  ): Promise<StepValidationResult>;
}

/**
 * LLM-based step validator that uses a language model to determine if a step
 * is ready to proceed to the next step based on user input.
 */
export class LLMStepValidator implements StepValidator {
  private model: ChatOpenAI;
  private parser: JsonOutputParser;

  constructor() {
    this.model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0
    });
    this.parser = new JsonOutputParser();
  }

  /**
   * Validates if a step is ready to proceed based on user input
   */
  async validateStep(
    step: PerformanceTaskStepType,
    userInput: string,
    previousStepOutput: any
  ): Promise<StepValidationResult> {
    const promptTemplate = PromptTemplate.fromTemplate(
      `You are a step validator for a performance task design workflow.
      
Current step: {step}
User input: {userInput}
Previous step output: {previousStepOutput}

Determine if the user is ready to proceed to the next step or if they are asking for refinements/changes to the current step.

Instructions:
- If the user clearly indicates they want to select or proceed with what was presented, return isReadyForNextStep: true
- If the user is asking for modifications, refinements, or has questions about the current step, return isReadyForNextStep: false
- If the user's intent is unclear, return isReadyForNextStep: false
- For task ideas selection, check if the user mentions a specific idea number or clearly indicates a preference
- Include any relevant data from the user's input that should be saved in currentStepData
- Include a helpful message explaining your reasoning in message

Return JSON in the following format:
{
  "isReadyForNextStep": boolean,
  "currentStepData": object (optional),
  "message": string (optional)
}`
    );

    const prompt = await promptTemplate.format({
      step,
      userInput,
      previousStepOutput: JSON.stringify(previousStepOutput)
    });

    try {
      const result = await this.model.invoke(prompt);
      
      // Convert MessageContent to string before parsing
      const contentStr = typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content);
      
      const parsed = await this.parser.parse(contentStr);
      
      // Validate and construct a proper StepValidationResult
      return {
        isReadyForNextStep: Boolean(parsed.isReadyForNextStep),
        currentStepData: parsed.currentStepData || undefined,
        message: parsed.message || undefined
      };
    } catch (error) {
      console.error("Error in step validation:", error);
      // Default to not ready in case of errors
      return {
        isReadyForNextStep: false,
        message: "Could not determine intent. Please clarify your choice."
      };
    }
  }
}

/**
 * Simple rule-based validator that uses regex patterns to determine
 * if a step is ready to proceed based on user input.
 */
export class SimpleRuleValidator implements StepValidator {
  /**
   * Validates if a step is ready to proceed based on user input
   */
  async validateStep(
    step: PerformanceTaskStepType,
    userInput: string,
    previousStepOutput: any
  ): Promise<StepValidationResult> {
    // Clean input and convert to lowercase for easier matching
    const cleanInput = userInput.toLowerCase().trim();
    
    // Default validation result
    const result: StepValidationResult = {
      isReadyForNextStep: false,
      message: "Please provide clearer instructions on how to proceed."
    };

    // Patterns indicating readiness to proceed
    const proceedPatterns = [
      /\b(?:select|choose|pick)\b.+?\b(?:\d+)\b/i,  // "I select option 3"
      /\bnumber\s*\d+\b/i,                          // "number 2"
      /\boption\s*\d+\b/i,                          // "option 1"
      /\btask\s*\d+\b/i,                            // "task 3"
      /\btopic\s*\d+\b/i,                           // "topic 2" 
      /\b\d+\b/i,                                   // Just a number like "3"
      /\byes\b/i,                                   // Agreement
      /\bproceed\b/i,                               // Explicit proceed
      /\bnext\b/i,                                  // Next step
      /\bcontinue\b/i,                              // Continue
      /\bgood\b/i,                                  // Affirmative
      /\bgreat\b/i,                                 // Affirmative
      /\bi like\b/i,                                // Positive sentiment
      /\bsounds good\b/i,                           // Positive sentiment
      /\blet's go\b/i,                              // Proceed
    ];
    
    // Patterns indicating refinement requests
    const refinementPatterns = [
      /\bchange\b/i,                               // Change request
      /\bmodify\b/i,                               // Modification request 
      /\brefine\b/i,                               // Refinement request
      /\breword\b/i,                               // Rewording request
      /\bdifferent\b/i,                            // Something different
      /\btry again\b/i,                            // Try again
      /\bdon'?t like\b/i,                          // Negative sentiment
      /\bnot good\b/i,                             // Negative sentiment
      /\bcan you\b.+?\bchange\b/i,                 // Can you change
      /\bcan you\b.+?\bupdate\b/i,                 // Can you update
      /\bcan you\b.+?\bmodify\b/i,                 // Can you modify
      /\bwhat if\b/i,                              // Alternative suggestion
      /\bhow about\b/i,                            // Alternative suggestion
      /\bwhat about\b/i,                           // Alternative suggestion
      /\?$/i,                                       // Ends with question mark
    ];

    // Check if the input matches any proceed patterns
    for (const pattern of proceedPatterns) {
      if (pattern.test(cleanInput)) {
        result.isReadyForNextStep = true;
        result.message = "Ready to proceed to the next step.";
        
        // Extract numbers if present for task/option/topic selection
        const numbers = cleanInput.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          result.currentStepData = {
            selectedIds: numbers.map(num => parseInt(num, 10))
          };
        }
        
        break;
      }
    }
    
    // Check if the input matches any refinement patterns
    // This will override any proceed matches
    for (const pattern of refinementPatterns) {
      if (pattern.test(cleanInput)) {
        result.isReadyForNextStep = false;
        result.message = "User is requesting refinements or has questions.";
        result.currentStepData = { refinementRequest: cleanInput };
        break;
      }
    }

    return result;
  }
}

// Factory to create the appropriate validator
export class StepValidatorFactory {
  static createValidator(type: "llm" | "simple" = "simple"): StepValidator {
    if (type === "llm") {
      return new LLMStepValidator();
    } else {
      return new SimpleRuleValidator();
    }
  }
} 
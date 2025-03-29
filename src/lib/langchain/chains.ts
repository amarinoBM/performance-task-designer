import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  TaskIdeasSchema,
  FocusTopicsSchema,
  ProductOptionsSchema,
  PerformanceTaskSchema,
  PerformanceTaskStepType,
  TaskIdea,
  FocusTopic,
  ProductOption
} from "./schemas";
import { PerformanceTaskMemory } from "./memory";

// Define UnitForUnitStory type
export type UnitForUnitStory = {
  title: string;
  grade: {
    name: string;
  };
};

// Create LLM instances
const chatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
  streaming: true,
});

const structuredChatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.2, // Lower temperature for more structured outputs
});

/**
 * Chain factory to create the appropriate chain based on the current step
 */
export class PerformanceTaskChainFactory {
  private memory: PerformanceTaskMemory;

  constructor(memory: PerformanceTaskMemory) {
    this.memory = memory;
  }

  /**
   * Create the appropriate chain based on the current step
   */
  createChainForStep(step: string, userInput: string): RunnableSequence {
    switch (step) {
      case PerformanceTaskStepType.TASK_IDEAS:
        return this.createTaskIdeasChain(userInput);
      case PerformanceTaskStepType.FOCUS_TOPICS:
        return this.createFocusTopicsChain(userInput);
      case PerformanceTaskStepType.PRODUCT_OPTIONS:
        return this.createProductOptionsChain(userInput);
      case PerformanceTaskStepType.REQUIREMENTS:
        return this.createRequirementsChain(userInput);
      case PerformanceTaskStepType.RUBRIC:
        return this.createRubricChain(userInput);
      case PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE:
        return this.createPerformanceTaskSummaryChain();
      default:
        throw new Error(`Unsupported step: ${step}`);
    }
  }

  /**
   * Chain to generate task ideas for performance task (Step 1)
   */
  private createTaskIdeasChain(userInput: string): RunnableSequence {
    const taskIdeasParser = StructuredOutputParser.fromZodSchema(TaskIdeasSchema);
    
    const unit = this.memory.getPerformanceTaskUnit();
    const unitInfo = unit.unit || { title: "Unnamed Unit", grade: { name: "unspecified" }};
    
    const taskIdeasTemplate = `
      # Goal:
      Design task ideas for the unit titled "${unitInfo.title}" tailored for ${unitInfo.grade.name} grade students in a virtual school for neurodiverse learners.
      
      User has provided this context: "{userInput}"
      
      ## Step 1: Design Three Task Ideas
      Create 3 distinct, engaging task ideas that align with real-world roles and scenarios. Each idea should:
      - Connect to a real-world role relevant to the unit skills
      - Include a clear audience and purpose
      - Directly connect to the skills needing assessment
      
      Generate 3 distinct task ideas. Each should have an id, title, description, role, audience, and purpose.
      
      {format_instructions}
    `;
    
    const taskIdeasPrompt = PromptTemplate.fromTemplate(taskIdeasTemplate);
    
    const inputs = new RunnablePassthrough<Record<string, unknown>>().assign({
      userInput: () => userInput,
      format_instructions: () => taskIdeasParser.getFormatInstructions()
    });
    
    return RunnableSequence.from([
      inputs,
      taskIdeasPrompt,
      structuredChatModel,
      taskIdeasParser
    ]);
  }

  /**
   * Chain to generate focus topics based on selected task idea (Step 2)
   */
  private createFocusTopicsChain(userInput: string): RunnableSequence {
    const focusTopicsParser = StructuredOutputParser.fromZodSchema(FocusTopicsSchema);
    
    // Get the selected task idea from memory
    const selectedTaskIdea = this.memory.get<TaskIdea>("selectedTaskIdea");
    
    if (!selectedTaskIdea) {
      throw new Error("No selected task idea found in memory");
    }
    
    const focusTopicsTemplate = `
      The selected task idea is:
      
      Title: {title}
      Description: {description}
      Role: {role}
      Audience: {audience}
      Purpose: {purpose}
      
      User has provided this additional context: "{userInput}"
      
      ## Step 2: Provide Focus Topic Options
      Provide 5-7 diverse focus topic options tied to the unit's essential question and content themes. Keep descriptions brief and accessible.
      
      Each focus topic should have an id, topic (title), and description.
      
      {format_instructions}
    `;
    
    const focusTopicsPrompt = PromptTemplate.fromTemplate(focusTopicsTemplate);
    
    const inputs = new RunnablePassthrough<Record<string, unknown>>().assign({
      title: () => selectedTaskIdea.title,
      description: () => selectedTaskIdea.description,
      role: () => selectedTaskIdea.role,
      audience: () => selectedTaskIdea.audience,
      purpose: () => selectedTaskIdea.purpose,
      userInput: () => userInput,
      format_instructions: () => focusTopicsParser.getFormatInstructions()
    });
    
    return RunnableSequence.from([
      inputs,
      focusTopicsPrompt,
      structuredChatModel,
      focusTopicsParser
    ]);
  }

  /**
   * Chain to generate product options based on selected focus topics (Step 3)
   */
  private createProductOptionsChain(userInput: string): RunnableSequence {
    const productOptionsParser = StructuredOutputParser.fromZodSchema(ProductOptionsSchema);
    
    // Get the selected task idea and focus topics from memory
    const selectedTaskIdea = this.memory.get<TaskIdea>("selectedTaskIdea");
    const selectedFocusTopics = this.memory.get<FocusTopic[]>("selectedFocusTopics") || [];
    
    if (!selectedTaskIdea) {
      throw new Error("No selected task idea found in memory");
    }
    
    const focusTopicsText = selectedFocusTopics.map(topic => 
      `${topic.id}. ${topic.topic}: ${topic.description}`
    ).join("\n");
    
    const productOptionsTemplate = `
      The selected task idea is:
      
      Title: {title}
      Description: {description}
      Role: {role}
      Audience: {audience}
      Purpose: {purpose}
      
      Selected focus topics:
      {focusTopicsText}
      
      User has provided this additional context: "{userInput}"
      
      ## Step 3: Offer Final Product Options
      Present 4 diverse, accessible final product options that align with the selected task idea and focus topics.
      Each option should:
      - Be practical and engaging for a virtual school environment
      - Support Universal Design for Learning principles
      - Be presented as a clear, single-sentence description
      
      Each product option should have an id, title, and description.
      
      {format_instructions}
    `;
    
    const productOptionsPrompt = PromptTemplate.fromTemplate(productOptionsTemplate);
    
    const inputs = new RunnablePassthrough<Record<string, unknown>>().assign({
      title: () => selectedTaskIdea.title,
      description: () => selectedTaskIdea.description,
      role: () => selectedTaskIdea.role,
      audience: () => selectedTaskIdea.audience,
      purpose: () => selectedTaskIdea.purpose,
      focusTopicsText: () => focusTopicsText,
      userInput: () => userInput,
      format_instructions: () => productOptionsParser.getFormatInstructions()
    });
    
    return RunnableSequence.from([
      inputs,
      productOptionsPrompt,
      structuredChatModel,
      productOptionsParser
    ]);
  }

  /**
   * Chain to generate student-facing requirements (Step 4)
   */
  private createRequirementsChain(userInput: string): RunnableSequence {
    // This won't use a full parser since we're building up the performance task step by step
    
    // Get the selected components from memory
    const selectedTaskIdea = this.memory.get<TaskIdea>("selectedTaskIdea");
    const selectedFocusTopics = this.memory.get<FocusTopic[]>("selectedFocusTopics") || [];
    const selectedProductOptions = this.memory.get<ProductOption[]>("selectedProductOptions") || [];
    
    if (!selectedTaskIdea) {
      throw new Error("No selected task idea found in memory");
    }
    
    const focusTopicsText = selectedFocusTopics.map(topic => 
      `${topic.id}. ${topic.topic}: ${topic.description}`
    ).join("\n");
    
    const productOptionsText = selectedProductOptions.map(option => 
      `${option.id}. ${option.title}: ${option.description}`
    ).join("\n");
    
    const requirementsTemplate = `
      The selected task components are:
      
      Task Idea:
      Title: {title}
      Description: {description}
      Role: {role}
      Audience: {audience}
      Purpose: {purpose}
      
      Focus Topics:
      {focusTopicsText}
      
      Product Options:
      {productOptionsText}
      
      User has provided this additional context: "{userInput}"
      
      ## Step 4: Create Student-Facing Requirements
      Provide a thorough, practical student-facing description including:
      - A clear, engaging title (15 words or less)
      - A brief, descriptive subtitle (25 words or less)
      - A 2-3 sentence overview of the task in simple terms
      - A purpose statement explaining why this task matters to their lives (3-5 sentences)
      - 8-10 detailed bullet points tied to essential skills
      
      Return in the following JSON format:
      {
        "title": "Title of the performance task",
        "subtitle": "Subtitle of the performance task",
        "description": "2-3 sentence description of the task",
        "purpose": "3-5 sentence purpose statement",
        "requirements": "8-10 bullet points separated by \\n"
      }
    `;
    
    const requirementsPrompt = PromptTemplate.fromTemplate(requirementsTemplate);
    
    const inputs = new RunnablePassthrough<Record<string, unknown>>().assign({
      title: () => selectedTaskIdea.title,
      description: () => selectedTaskIdea.description,
      role: () => selectedTaskIdea.role,
      audience: () => selectedTaskIdea.audience,
      purpose: () => selectedTaskIdea.purpose,
      focusTopicsText: () => focusTopicsText,
      productOptionsText: () => productOptionsText,
      userInput: () => userInput
    });
    
    return RunnableSequence.from([
      inputs,
      requirementsPrompt,
      structuredChatModel,
      new StringOutputParser()
    ]);
  }

  /**
   * Chain to generate student-facing rubric (Step 5)
   */
  private createRubricChain(userInput: string): RunnableSequence {
    // Get the components created so far from memory
    const selectedTaskIdea = this.memory.get<TaskIdea>("selectedTaskIdea");
    const requirements = this.memory.get<string>("requirements");
    
    if (!selectedTaskIdea || !requirements) {
      throw new Error("Missing required components for rubric creation");
    }
    
    const rubricTemplate = `
      The performance task so far:
      
      Task Idea:
      Title: {title}
      Description: {description}
      Role: {role}
      Audience: {audience}
      Purpose: {purpose}
      
      Requirements: {requirements}
      
      User has provided this additional context: "{userInput}"
      
      ## Step 5: Develop a Student-Facing Rubric
      Create a detailed, skill-focused rubric with four levels: Try, Relevant, Accurate, and Complex.
      Each level should:
      - Include clear, descriptive language for neurodiverse students
      - Focus on observable behaviors for the targeted skills
      
      Return in the following JSON format:
      {
        "successCriteria": "4 product options as bullet points separated by \\n",
        "suggestedFocusTopic": "5-7 topic options as bullet points separated by \\n",
        "rubricTitle": "Clear, descriptive title for the rubric",
        "rubricDescription": "Brief description of what the rubric assesses",
        "rubricCriteria": [
          {
            "name": "Try",
            "description": "Description for this level",
            "orderNumber": 1
          },
          {
            "name": "Relevant",
            "description": "Description for this level",
            "orderNumber": 2
          },
          {
            "name": "Accurate",
            "description": "Description for this level",
            "orderNumber": 3
          },
          {
            "name": "Complex",
            "description": "Description for this level",
            "orderNumber": 4
          }
        ]
      }
    `;
    
    const rubricPrompt = PromptTemplate.fromTemplate(rubricTemplate);
    
    const inputs = new RunnablePassthrough<Record<string, unknown>>().assign({
      title: () => selectedTaskIdea.title,
      description: () => selectedTaskIdea.description,
      role: () => selectedTaskIdea.role,
      audience: () => selectedTaskIdea.audience,
      purpose: () => selectedTaskIdea.purpose,
      requirements: () => requirements,
      userInput: () => userInput
    });
    
    return RunnableSequence.from([
      inputs,
      rubricPrompt,
      structuredChatModel,
      new StringOutputParser()
    ]);
  }

  /**
   * Chain to generate the complete performance task summary (Step 6)
   */
  createPerformanceTaskSummaryChain(): RunnableSequence {
    const performanceTaskParser = StructuredOutputParser.fromZodSchema(PerformanceTaskSchema);
    
    // Get all the components from memory
    const requirements = JSON.parse(this.memory.get<string>("requirements") || "{}");
    const rubricInfo = JSON.parse(this.memory.get<string>("rubricInfo") || "{}");
    
    const performanceTaskTemplate = `
      ## Step 6: Return a Summary in JSON Format
      Create a complete performance task summary with all required fields.
      
      Requirements data:
      {requirementsData}
      
      Rubric data:
      {rubricData}
      
      Combine these components into a complete performance task.
      
      {format_instructions}
    `;
    
    const performanceTaskPrompt = PromptTemplate.fromTemplate(performanceTaskTemplate);
    
    const inputs = new RunnablePassthrough<Record<string, unknown>>().assign({
      requirementsData: () => JSON.stringify(requirements, null, 2),
      rubricData: () => JSON.stringify(rubricInfo, null, 2),
      format_instructions: () => performanceTaskParser.getFormatInstructions()
    });
    
    return RunnableSequence.from([
      inputs,
      performanceTaskPrompt,
      structuredChatModel,
      performanceTaskParser
    ]);
  }
} 
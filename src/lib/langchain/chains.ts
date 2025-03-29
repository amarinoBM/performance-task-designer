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

// Create system prompt for performance tasks
export const performanceTaskSystemPrompt = (unit: UnitForUnitStory) => `# Goal:
Design an authentic, engaging, and real-world performance task for the unit titled "${unit.title}" tailored for ${unit.grade.name} grade students in a virtual school for neurodiverse learners. This performance task serves as the culminating assessment, allowing students to demonstrate mastery of essential skills through accessible, practical scenarios, implicitly following Jay Tighe's GRASPS model (Goal, Role, Audience, Situation, Product, Standards).
# Required Fields (ALL MUST BE INCLUDED):
- title (string): Clear, engaging title (15 words or less)
- subtitle (string): Brief, descriptive subtitle (25 words or less)
- description (string): Concise explanation in student-friendly language (3-5 sentences)
- purpose (string): 3-5 warm, student-facing sentences explaining why this task matters to their lives
- requirements (string): 8-10 student-friendly bullet points (MUST use \\n between points)
- successCriteria (string): 4 product options, each as a single bullet point (MUST use \\n between points)
- suggestedFocusTopic (string): 5-7 topic options as bullet points (CRITICAL: MUST use \\n between EACH topic)
- rubricTitle (string): Clear, descriptive title for the rubric
- rubricDescription (string): Brief description of what the rubric assesses (1-2 sentences)
- rubricCriteria (array of objects): Four performance levels (Try, Relevant, Accurate, Complex) with descriptions and orderNumber
# Context:
This prompt is for a progressive virtual school focused on mastery-based learning for neurodiverse students. Performance tasks should be authentic, engaging, and accessible, connecting classroom learning to real-world applications.`;

// Create LLM instances
const chatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
  streaming: true,
});

const structuredChatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.2, // Lower temperature for more structured outputs
  maxTokens: 2048,  // Ensure enough tokens for complex responses
  timeout: 60000,   // Increase timeout to 60 seconds
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
      Design an authentic, engaging, and real-world performance task for the unit titled "${unitInfo.title}" tailored for ${unitInfo.grade.name} grade students in a virtual school for neurodiverse learners. 
      
      This performance task serves as the culminating assessment, allowing students to demonstrate mastery of essential skills through accessible, practical scenarios, implicitly following Jay Tighe's GRASPS model (Goal, Role, Audience, Situation, Product, Standards).
      
      User has provided this context: "{userInput}"
      
      ## Step 1: Propose Three GRASPS-Aligned Task Ideas
      Analyze the unit description, the specific skills requiring assessment, and the essential question. Propose **3 distinct, engaging ideas** for performance tasks that implicitly align with the GRASPS model. Present each idea clearly and concisely (2-3 sentences each), focusing on an authentic role, realistic scenario, and implied audience, while avoiding overly specific focus topics or final products at this stage.
      
      ### Each Task Idea Should:
      - Reflect a real-world role and scenario tied to the unit's essential skills.
      - Suggest a clear audience and purpose without naming a specific product.
      - Connect directly to the skills needing assessment, keeping flexibility for later refinement.
      
      **Example (for a unit on U.S. Presidents and American History):**
      1. "Assume the role of a historian advising a museum on how to honor a U.S. President's legacy, sharing insights with visitors to highlight their influence on history."
      2. "Take on the role of a journalist investigating a U.S. President's leadership, presenting findings to readers eager to understand their impact on society."
      3. "Become a community leader organizing an event to celebrate a U.S. President's contributions, proposing ideas to local citizens to promote historical awareness."
      
      Generate 3 distinct task ideas that follow the GRASPS model. Each should have an id, title, description, role, audience, and purpose.
      
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
      
      ## Step 2: Offer Focus Topic Options
      Provide **10 diverse, engaging focus topic options** tied to the unit's essential question, key understandings, and content themes. Keep descriptions brief (1 sentence each) and accessible for neurodiverse learners.
      
      ### Examples of Suggested Focus Topic Types (for U.S. Presidents):
      1. "George Washington's leadership during the Revolutionary War."
      2. "Abraham Lincoln's role in the abolition of slavery."
      3. "Franklin D. Roosevelt's New Deal during the Great Depression."
      4. "John F. Kennedy's handling of the Cuban Missile Crisis."
      5. "Richard Nixon's foreign policy with China."
      6. "Jimmy Carter's focus on human rights."
      7. "Ronald Reagan's economic policies in the 1980s."
      8. "Bill Clinton's impact on technology and economy."
      9. "Barack Obama's Affordable Care Act."
      10. "Donald Trump's approach to immigration policy."
      
      Each focus topic should have an id, topic (title), and description. Create topics that are suitable for neurodiverse learners in a virtual school environment.
      
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
      
      ## Step 3: Provide Final Product Options
      Present a **list of 10 diverse, accessible final product options** that align with the selected task idea, focus topic(s), and essential skills. Each option should be practical, engaging, and suited to a virtual school environment, supporting Universal Design for Learning (UDL) principles. Present each as a single bullet point with a brief description (1 sentence).
      
      ### Final Product Examples (For a Historical Legacy Project):
      1. **Digital Exhibit Guide:** Create an online guide with visuals for museum visitors to learn about a historical figure's legacy.
      2. **Podcast Episode:** Record a 5-minute audio segment for museum visitors to hear about a historical impact.
      3. **Infographic Poster:** Make a visual poster summarizing achievements for a museum wall.
      4. **Video Tour Script:** Write and record a short script for a virtual museum tour.
      5. **Interactive Timeline:** Design a clickable timeline showing key moments for a museum display.
      6. **Letter to Museum Board:** Write a letter suggesting how the museum should honor a historical figure.
      7. **Photo Essay:** Combine images (drawn or found) with captions to showcase a legacy.
      8. **Blog Post:** Write a short online article for a museum's website about historical influence.
      9. **Storyboard for Exhibit:** Draw or design a layout for a museum exhibit.
      10. **Social Media Campaign:** Create a series of posts to promote a museum's exhibit.
      
      Each product option should:
      - Be practical and engaging for neurodiverse students in a virtual school environment
      - Support Universal Design for Learning principles for maximum accessibility
      - Be presented as a clear, single-sentence description
      - Provide multiple means of engagement, representation, and expression
      
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
      
      ## Step 4: Present Student-Facing Requirements and Criteria
      Create a student-friendly performance task description with clear requirements, tailored for neurodiverse learners.
      
      Format your response in this exact structure:
      
      TITLE: [A clear, engaging title for the performance task (15 words or less)]
      
      SUBTITLE: [A brief, descriptive subtitle explaining the task (25 words or less)]
      
      DESCRIPTION: [A 2-3 sentence overview of the task in simple terms that students can understand]
      
      PURPOSE: [3-5 warm, student-facing sentences explaining why this task matters to their lives]
      
      REQUIREMENTS:
      - [Requirement 1]
      - [Requirement 2]
      - [Requirement 3]
      - [And so on... (8-10 total requirements)]
      
      Here's an example for a Revolutionary Movement Performance Task:
      
      TITLE: Revolutionary Voices Project
      
      SUBTITLE: Amplify historical perspectives through creative communication
      
      DESCRIPTION: You will take on the role of a historian documenting voices from a revolutionary movement. By researching key figures and events, you'll create a compelling product that helps others understand the human experiences behind historical change.
      
      PURPOSE: Understanding revolutionary movements helps us see how ordinary people can create extraordinary change. By exploring these stories, you'll discover how social movements develop, what motivates people to take action, and how their choices still impact our world today. These insights can help you recognize your own power to influence communities you care about.
      
      REQUIREMENTS:
      - Select a specific revolutionary movement or time period to research
      - Identify at least three key individuals or groups from your chosen movement
      - Research their motivations, challenges, and contributions using reliable sources
      - Analyze how their actions created change and still influence society today
      - Choose one of the approved product formats to present your findings
      - Include both factual information and personal perspectives/stories
      - Connect historical events to contemporary issues or movements
      - Incorporate visual elements to enhance understanding
      - Provide proper citations for all sources used
      - Review your work using the provided rubric before submission
      
      Keep language clear, direct, and accessible for neurodiverse students. Include concrete expectations and avoid ambiguity.
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
    const requirements = this.memory.get<string>("requirements") || "";
    
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
      
      Requirements: 
      {requirements}
      
      User has provided this additional context: "{userInput}"
      
      ## Step 5: Create a Student-Facing Rubric
      Develop a detailed, skill-focused rubric to assess specific skills (not content knowledge). 
      
      Format your response like this:
      
      RUBRIC TITLE: [Clear title for the rubric]
      
      RUBRIC DESCRIPTION: [Brief description of what the rubric assesses]
      
      SUCCESS CRITERIA:
      - [Product option 1]
      - [Product option 2]
      - [Product option 3]
      - [Product option 4]
      
      SUGGESTED FOCUS TOPICS:
      - [Topic 1]
      - [Topic 2]
      - [Topic 3]
      - [Topic 4]
      - [Topic 5]
      
      CRITERIA:
      
      TRY: [Description for initial effort at the skill, with significant gaps]
      
      RELEVANT: [Description for partial use of the skill, with some correct application but notable weaknesses]
      
      ACCURATE: [Description for consistent and correct application of the skill, meeting expectations]
      
      COMPLEX: [Description for advanced and detailed application of the skill, exceeding expectations with depth]
      
      Here's an example for a Revolutionary Movement Performance Task:
      
      RUBRIC TITLE: Revolutionary Perspectives Assessment
      
      RUBRIC DESCRIPTION: This rubric evaluates your ability to research historical movements, analyze multiple perspectives, and communicate complex ideas effectively.
      
      SUCCESS CRITERIA:
      - Digital Story Map with images and text explaining key events and figures
      - Podcast Series featuring "interviews" with revolutionary figures
      - Virtual Museum Exhibit showcasing artifacts and personal stories
      - Illustrated Timeline connecting revolutionary events to modern impacts
      
      SUGGESTED FOCUS TOPICS:
      - The American Revolution (1765-1783)
      - The French Revolution (1789-1799)
      - The Haitian Revolution (1791-1804)
      - Women's Suffrage Movements (19th-20th century)
      - Civil Rights Movement (1954-1968)
      - Arab Spring (2010-2012)
      
      CRITERIA:
      
      TRY: Research identifies basic facts about the revolutionary movement but lacks detail or contains inaccuracies. Few perspectives are included, and connections between events are minimal. Product organization is difficult to follow, with limited use of visual elements and source citations.
      
      RELEVANT: Research includes some accurate facts about the movement and a few different perspectives. Makes simple connections between events and their outcomes. Product is somewhat organized with some supporting visual elements and attempted citations, though quality may be inconsistent.
      
      ACCURATE: Research presents accurate, detailed information about the movement with multiple perspectives clearly represented. Makes logical connections between events and their historical impact. Product is well-organized with effective visual elements and proper citations for all major sources.
      
      COMPLEX: Research demonstrates exceptional depth, including nuanced details and diverse perspectives that show thorough understanding. Makes insightful connections between revolutionary events and contemporary issues. Product is exceptionally organized with compelling visual elements that enhance meaning, and impeccable, detailed citations.
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
      ## Step 6: Return a Summary of the Performance Task
      Create a complete performance task summary with all required fields following Jay Tighe's GRASPS model.
      
      Requirements data:
      {requirementsData}
      
      Rubric data:
      {rubricData}
      
      Combine these components into a complete performance task with the following fields:
      - title
      - subtitle
      - description
      - purpose
      - requirements
      - successCriteria
      - suggestedFocusTopic
      - rubricTitle
      - rubricDescription
      - rubricCriteria
      
      !IMPORTANT: the return format must be in json format.
      
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
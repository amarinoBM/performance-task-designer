import { PerformanceTaskMemory, InMemoryMemory } from "./memory";
import { PerformanceTaskChainFactory } from "./chains";
import { 
  PerformanceTaskStepType,
  TaskIdeas,
  TaskIdea,
  FocusTopics,
  FocusTopic,
  ProductOptions,
  ProductOption,
  PerformanceTask
} from "./schemas";

/**
 * Service to manage the performance task design flow
 */
export class PerformanceTaskService {
  private memory: PerformanceTaskMemory;
  private chainFactory: PerformanceTaskChainFactory;

  constructor(topic: string) {
    this.memory = new PerformanceTaskMemory(new InMemoryMemory(), topic);
    this.chainFactory = new PerformanceTaskChainFactory(this.memory);
  }

  /**
   * Initialize a performance task design session
   */
  initialize(unitTitle: string, gradeName: string): string {
    // Set unit information
    this.memory.updatePerformanceTaskUnit({
      unit: {
        title: unitTitle,
        grade: {
          name: gradeName
        }
      },
      currentStep: PerformanceTaskStepType.TASK_IDEAS
    });
    
    return `Let's design a performance task for "${unitTitle}" for ${gradeName} grade students. What skills should students demonstrate through this task?`;
  }

  /**
   * Process a user message based on the current step
   */
  async processMessage(userMessage: string): Promise<string> {
    // Add user message to memory
    this.memory.addMessage("user", userMessage);

    const currentStep = this.memory.getPerformanceTaskUnit().currentStep;
    let responseMessage = "";

    try {
      switch (currentStep) {
        case PerformanceTaskStepType.TASK_IDEAS:
          // Check if the user is selecting a task idea
          if (userMessage.match(/\d+/) && this.memory.get<TaskIdea[]>("taskIdeas")) {
            responseMessage = this.handleSelectTaskIdea(userMessage);
          } else {
            responseMessage = await this.handleTaskIdeasStep(userMessage);
          }
          break;
        case PerformanceTaskStepType.FOCUS_TOPICS:
          // Check if the user is selecting focus topics
          if (userMessage.match(/\d+/) && this.memory.get<FocusTopic[]>("focusTopics")) {
            responseMessage = this.handleSelectFocusTopics(userMessage);
          } else {
            responseMessage = await this.handleFocusTopicsStep(userMessage);
          }
          break;
        case PerformanceTaskStepType.PRODUCT_OPTIONS:
          // Check if the user is selecting product options
          if (userMessage.match(/\d+/) && this.memory.get<ProductOption[]>("productOptions")) {
            responseMessage = this.handleSelectProductOptions(userMessage);
          } else {
            responseMessage = await this.handleProductOptionsStep(userMessage);
          }
          break;
        case PerformanceTaskStepType.REQUIREMENTS:
          responseMessage = await this.handleRequirementsStep(userMessage);
          break;
        case PerformanceTaskStepType.RUBRIC:
          responseMessage = await this.handleRubricStep(userMessage);
          break;
        case PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE:
          responseMessage = await this.handlePerformanceTaskCompleteStep();
          break;
        default:
          throw new Error(`Unsupported step: ${currentStep}`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      responseMessage = "Sorry, I encountered an error. Please try again.";
    }

    // Add assistant message to memory
    this.memory.addMessage("assistant", responseMessage);
    return responseMessage;
  }

  /**
   * Handle the task ideas step - generate performance task ideas
   */
  private async handleTaskIdeasStep(userInput: string): Promise<string> {
    const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.TASK_IDEAS, userInput);
    
    // Execute the chain
    const result = await chain.invoke({});
    const taskIdeas = result as TaskIdeas;
    
    // Store the task ideas in memory
    this.memory.set("taskIdeas", taskIdeas.ideas);
    
    // Format the response
    const formattedIdeas = taskIdeas.ideas.map(idea => 
      `**Task ${idea.id}: ${idea.title}**\n${idea.description}\n**Role:** ${idea.role}\n**Audience:** ${idea.audience}\n**Purpose:** ${idea.purpose}`
    ).join("\n\n");
    
    return `Based on the unit information, I've generated these performance task ideas:\n\n${formattedIdeas}\n\nWhich task idea would you like to develop further? Please select by number.`;
  }

  /**
   * Handle when a user selects a task idea
   */
  private handleSelectTaskIdea(userInput: string): string {
    // Try to extract a number from the user input
    const match = userInput.match(/\d+/);
    if (!match) {
      return "I'm not sure which task idea you're selecting. Please provide the task number.";
    }
    
    const ideaId = parseInt(match[0], 10);
    const taskIdeas = this.memory.get<TaskIdea[]>("taskIdeas") || [];
    const selectedIdea = taskIdeas.find(idea => idea.id === ideaId);
    
    if (!selectedIdea) {
      return `I couldn't find task idea ${ideaId}. Please select a valid task number.`;
    }
    
    // Store the selected task idea and move to the next step
    this.memory.set("selectedTaskIdea", selectedIdea);
    this.memory.setCurrentStep(PerformanceTaskStepType.FOCUS_TOPICS);
    
    return `Great choice! You've selected:\n\n**${selectedIdea.title}**\n${selectedIdea.description}\n\nNow, let's identify some focus topics for this performance task. What specific content areas should students explore?`;
  }

  /**
   * Handle the focus topics step - generate focus topics
   */
  private async handleFocusTopicsStep(userInput: string): Promise<string> {
    const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.FOCUS_TOPICS, userInput);
    
    // Execute the chain
    const result = await chain.invoke({});
    const focusTopics = result as FocusTopics;
    
    // Store the focus topics in memory
    this.memory.set("focusTopics", focusTopics.topics);
    
    // Format the response
    const formattedTopics = focusTopics.topics.map(topic => 
      `**Topic ${topic.id}: ${topic.topic}**\n${topic.description}`
    ).join("\n\n");
    
    return `Here are some potential focus topics for this performance task:\n\n${formattedTopics}\n\nWhich topics would you like to include? You can select multiple by number (e.g., "1, 3, and 5").`;
  }

  /**
   * Handle when a user selects focus topics
   */
  private handleSelectFocusTopics(userInput: string): string {
    // Try to extract numbers from the user input
    const matches = userInput.match(/\d+/g);
    if (!matches || matches.length === 0) {
      return "I'm not sure which topics you're selecting. Please provide topic numbers.";
    }
    
    const topicIds = matches.map(num => parseInt(num, 10));
    const allTopics = this.memory.get<FocusTopic[]>("focusTopics") || [];
    const selectedTopics = allTopics.filter(topic => topicIds.includes(topic.id));
    
    if (selectedTopics.length === 0) {
      return "I couldn't find any of the topic numbers you specified. Please select valid topic numbers.";
    }
    
    // Store the selected topics and move to the next step
    this.memory.set("selectedFocusTopics", selectedTopics);
    this.memory.setCurrentStep(PerformanceTaskStepType.PRODUCT_OPTIONS);
    
    // Format the selected topics
    const formattedTopics = selectedTopics.map(topic => 
      `**Topic ${topic.id}: ${topic.topic}**`
    ).join("\n");
    
    return `You've selected these focus topics:\n\n${formattedTopics}\n\nNow, let's consider product options for students to demonstrate their learning. What types of products would be engaging and accessible?`;
  }

  /**
   * Handle the product options step - generate product options
   */
  private async handleProductOptionsStep(userInput: string): Promise<string> {
    const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.PRODUCT_OPTIONS, userInput);
    
    // Execute the chain
    const result = await chain.invoke({});
    const productOptions = result as ProductOptions;
    
    // Store the product options in memory
    this.memory.set("productOptions", productOptions.options);
    
    // Format the response
    const formattedOptions = productOptions.options.map(option => 
      `**Option ${option.id}: ${option.title}**\n${option.description}`
    ).join("\n\n");
    
    return `Here are product options for students to demonstrate their learning:\n\n${formattedOptions}\n\nWhich product options would you like to include? Please select four options by number.`;
  }

  /**
   * Handle when a user selects product options
   */
  private handleSelectProductOptions(userInput: string): string {
    // Try to extract numbers from the user input
    const matches = userInput.match(/\d+/g);
    if (!matches || matches.length === 0) {
      return "I'm not sure which product options you're selecting. Please provide option numbers.";
    }
    
    const optionIds = matches.map(num => parseInt(num, 10));
    const allOptions = this.memory.get<ProductOption[]>("productOptions") || [];
    const selectedOptions = allOptions.filter(option => optionIds.includes(option.id));
    
    if (selectedOptions.length === 0) {
      return "I couldn't find any of the option numbers you specified. Please select valid option numbers.";
    }
    
    if (selectedOptions.length > 4) {
      return "You've selected more than 4 product options. Please narrow your selection to 4 options.";
    }
    
    // Store the selected options and move to the next step
    this.memory.set("selectedProductOptions", selectedOptions);
    this.memory.setCurrentStep(PerformanceTaskStepType.REQUIREMENTS);
    
    // Format the selected options
    const formattedOptions = selectedOptions.map(option => 
      `**Option ${option.id}: ${option.title}**`
    ).join("\n");
    
    return `You've selected these product options:\n\n${formattedOptions}\n\nNow, let's create the student-facing requirements. What essential skills should students demonstrate through this task?`;
  }

  /**
   * Handle the requirements step - generate requirements
   */
  private async handleRequirementsStep(userInput: string): Promise<string> {
    const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.REQUIREMENTS, userInput);
    
    // Execute the chain
    const result = await chain.invoke({});
    
    // Store the requirements in memory
    this.memory.set("requirements", result);
    this.memory.setCurrentStep(PerformanceTaskStepType.RUBRIC);
    
    // Parse the requirements to display
    try {
      const reqObj = JSON.parse(result as string);
      
      return `Here's the start of your performance task:\n\n**Title:** ${reqObj.title}\n**Subtitle:** ${reqObj.subtitle}\n\n**Description:**\n${reqObj.description}\n\n**Purpose:**\n${reqObj.purpose}\n\n**Requirements:**\n${reqObj.requirements}\n\nNow, let's create a rubric to assess student work. What specific skills should we assess?`;
    } catch (e) {
      // If we can't parse the JSON, just return the raw result
      return `Here are the requirements for your performance task:\n\n${result}\n\nNow, let's create a rubric to assess student work. What specific skills should we assess?`;
    }
  }

  /**
   * Handle the rubric step - generate rubric
   */
  private async handleRubricStep(userInput: string): Promise<string> {
    const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.RUBRIC, userInput);
    
    // Execute the chain
    const result = await chain.invoke({});
    
    // Store the rubric info in memory
    this.memory.set("rubricInfo", result);
    this.memory.setCurrentStep(PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE);
    
    // Parse the rubric to display
    try {
      const rubricObj = JSON.parse(result as string);
      
      const criteriaText = rubricObj.rubricCriteria.map((c: any) => 
        `**${c.name}:** ${c.description}`
      ).join("\n");
      
      return `Here's the rubric for your performance task:\n\n**Title:** ${rubricObj.rubricTitle}\n\n**Description:**\n${rubricObj.rubricDescription}\n\n**Criteria:**\n${criteriaText}\n\nThe performance task is now complete! Would you like to see the full performance task summary?`;
    } catch (e) {
      // If we can't parse the JSON, just return the raw result
      return `Here's the rubric information for your performance task:\n\n${result}\n\nThe performance task is now complete! Would you like to see the full performance task summary?`;
    }
  }

  /**
   * Handle the performance task complete step - generate final summary
   */
  private async handlePerformanceTaskCompleteStep(): Promise<string> {
    const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE, "");
    
    // Execute the chain
    const result = await chain.invoke({});
    const performanceTask = result as PerformanceTask;
    
    // Store the complete performance task in memory
    this.memory.updatePerformanceTaskUnit({
      performanceTask
    });
    
    // Format the criteria for display
    const criteriaText = performanceTask.rubricCriteria.map(c => 
      `**${c.name}:** ${c.description}`
    ).join("\n");
    
    return `# Complete Performance Task Summary\n\n**Title:** ${performanceTask.title}\n**Subtitle:** ${performanceTask.subtitle}\n\n**Description:**\n${performanceTask.description}\n\n**Purpose:**\n${performanceTask.purpose}\n\n**Requirements:**\n${performanceTask.requirements}\n\n**Success Criteria:**\n${performanceTask.successCriteria}\n\n**Suggested Focus Topics:**\n${performanceTask.suggestedFocusTopic}\n\n**Rubric Title:** ${performanceTask.rubricTitle}\n\n**Rubric Description:**\n${performanceTask.rubricDescription}\n\n**Rubric Criteria:**\n${criteriaText}`;
  }

  /**
   * Get the current state of the performance task design
   */
  getState(): Record<string, any> {
    return this.memory.toJSON();
  }
} 
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
  PerformanceTask,
  StepValidationResult
} from "./schemas";
import { StepValidator, StepValidatorFactory } from "./validators";

/**
 * Service to manage the performance task design flow
 */
export class PerformanceTaskService {
  private memory: PerformanceTaskMemory;
  private chainFactory: PerformanceTaskChainFactory;
  private validator: StepValidator;

  constructor(topic: string, validatorType: "llm" | "simple" = "simple") {
    this.memory = new PerformanceTaskMemory(new InMemoryMemory(), topic);
    this.chainFactory = new PerformanceTaskChainFactory(this.memory);
    this.validator = StepValidatorFactory.createValidator(validatorType);
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
    
    return `Hi. Let's design an engaging performance task for your unit "${unitTitle}".
This task will help students show what they've learned in a creative and meaningful way.
Before I suggest some ideas, tell me a bit about what you're hoping for:
What kind of work do you want students to do or create? Do you want students to create something (like a song, exhibit, podcast)?
Should they take on a real-world role (like curator, journalist, activist)?
Should they present, build, perform, or reflect?
Anything to avoid or emphasize?
Tell me anything you're thinking — or just say "start with ideas" and I'll take it from there.`;
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
      // First validate if the user is ready to proceed or is asking for refinements
      const previousStepOutput = this.getPreviousStepOutput(currentStep);
      const validationResult = await this.validator.validateStep(
        currentStep,
        userMessage,
        previousStepOutput
      );

      switch (currentStep) {
        case PerformanceTaskStepType.TASK_IDEAS:
          if (validationResult.isReadyForNextStep && validationResult.currentStepData?.selectedIds) {
            // If validation indicates user selected a specific task
            responseMessage = this.handleSelectTaskIdea(validationResult.currentStepData.selectedIds[0].toString());
          } else {
            // Otherwise generate/refine task ideas
            responseMessage = await this.handleTaskIdeasStep(userMessage);
          }
          break;
        case PerformanceTaskStepType.FOCUS_TOPICS:
          if (validationResult.isReadyForNextStep && validationResult.currentStepData?.selectedIds) {
            // If validation indicates user selected specific topics
            responseMessage = this.handleSelectFocusTopics(validationResult.currentStepData.selectedIds.join(', '));
          } else {
            // Otherwise generate/refine focus topics
            responseMessage = await this.handleFocusTopicsStep(userMessage);
          }
          break;
        case PerformanceTaskStepType.PRODUCT_OPTIONS:
          if (validationResult.isReadyForNextStep && validationResult.currentStepData?.selectedIds) {
            // If validation indicates user selected specific product options
            responseMessage = this.handleSelectProductOptions(validationResult.currentStepData.selectedIds.join(', '));
          } else {
            // Otherwise generate/refine product options
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
   * Get the relevant data from the previous step
   */
  private getPreviousStepOutput(currentStep: PerformanceTaskStepType): any {
    switch (currentStep) {
      case PerformanceTaskStepType.TASK_IDEAS:
        return this.memory.get<TaskIdea[]>("taskIdeas") || [];
      case PerformanceTaskStepType.FOCUS_TOPICS:
        return {
          taskIdea: this.memory.get<TaskIdea>("selectedTaskIdea"),
          focusTopics: this.memory.get<FocusTopic[]>("focusTopics") || []
        };
      case PerformanceTaskStepType.PRODUCT_OPTIONS:
        return {
          taskIdea: this.memory.get<TaskIdea>("selectedTaskIdea"),
          focusTopics: this.memory.get<FocusTopic[]>("selectedFocusTopics") || [],
          productOptions: this.memory.get<ProductOption[]>("productOptions") || []
        };
      case PerformanceTaskStepType.REQUIREMENTS:
        return {
          taskIdea: this.memory.get<TaskIdea>("selectedTaskIdea"),
          focusTopics: this.memory.get<FocusTopic[]>("selectedFocusTopics") || [],
          productOptions: this.memory.get<ProductOption[]>("selectedProductOptions") || []
        };
      case PerformanceTaskStepType.RUBRIC:
        return {
          taskIdea: this.memory.get<TaskIdea>("selectedTaskIdea"),
          focusTopics: this.memory.get<FocusTopic[]>("selectedFocusTopics") || [],
          productOptions: this.memory.get<ProductOption[]>("selectedProductOptions") || [],
          requirements: this.memory.get("requirements")
        };
      default:
        return {};
    }
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
    
    return `Based on the unit information, I've generated these performance task ideas:\n\n${formattedIdeas}\n\nWhich of these ideas resonates with you, or would you like me to refine them based on your feedback?`;
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
    try {
      const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.REQUIREMENTS, userInput);
      
      // Execute the chain
      const result = await chain.invoke({});
      
      // Check if result is valid
      if (!result) {
        throw new Error("Empty result from requirements chain");
      }
      
      // Store the requirements in memory
      this.memory.set("requirements", result);
      this.memory.setCurrentStep(PerformanceTaskStepType.RUBRIC);
      
      // Simply use the formatted output directly
      return `Here's the start of your performance task:\n\n${result}\n\nNow, let's create a rubric to assess student work. What specific skills should we assess?`;
    } catch (error) {
      console.error("Error in requirements step:", error);
      
      // Return a helpful error message
      return "I'm having trouble generating the requirements for your performance task. Could you please provide more details about what skills you want students to demonstrate through this task?";
    }
  }

  /**
   * Handle the rubric step - generate rubric
   */
  private async handleRubricStep(userInput: string): Promise<string> {
    try {
      const chain = this.chainFactory.createChainForStep(PerformanceTaskStepType.RUBRIC, userInput);
      
      // Execute the chain
      const result = await chain.invoke({});
      
      // Store the rubric info in memory
      this.memory.set("rubricInfo", result);
      this.memory.setCurrentStep(PerformanceTaskStepType.PERFORMANCE_TASK_COMPLETE);
      
      // Just return the formatted output directly
      return `Here's the rubric for your performance task:\n\n${result}\n\nThe performance task is now complete! Would you like to see the full performance task summary?`;
    } catch (error) {
      console.error("Error in rubric step:", error);
      return "I'm having trouble generating the rubric. Could you provide more details about what skills you want to assess?";
    }
  }

  /**
   * Handle the performance task complete step - generate final summary
   */
  private async handlePerformanceTaskCompleteStep(): Promise<string> {
    try {
      // Get the necessary data from memory
      const selectedTaskIdea = this.memory.get<any>("selectedTaskIdea") || {};
      const requirements = this.memory.get<string>("requirements") || "";
      const rubricInfo = this.memory.get<string>("rubricInfo") || "";
      
      // Create a structured performance task object without relying on JSON parsing
      const performanceTask = {
        title: selectedTaskIdea.title || "Performance Task",
        subtitle: selectedTaskIdea.description || "",
        description: selectedTaskIdea.description || "",
        purpose: selectedTaskIdea.purpose || "",
        requirements: requirements,
        successCriteria: requirements, // Use requirements for success criteria if not available separately
        suggestedFocusTopic: "",
        rubricTitle: "Performance Assessment Rubric",
        rubricDescription: "This rubric evaluates student mastery of key skills and understanding.",
        // Create a default criterion instead of trying to parse JSON
        rubricCriteria: [
          {
            name: "Overall Performance",
            description: rubricInfo.split("\n").slice(0, 3).join(" ").substring(0, 100) + "...",
            orderNumber: 0
          }
        ]
      };
      
      // Store the performance task in memory for the API to access
      this.memory.updatePerformanceTaskUnit({
        performanceTask: performanceTask
      });
      
      // Format a complete summary with section headers for the text response
      return `# Complete Performance Task Summary\n\n## Requirements\n${requirements}\n\n## Rubric\n${rubricInfo}`;
    } catch (error) {
      console.error("Error generating performance task summary:", error);
      return "I'm having trouble generating the complete summary. Please let me know if you'd like to review specific parts of the performance task.";
    }
  }

  /**
   * Get the current state of the performance task design
   */
  getState(): Record<string, any> {
    return this.memory.toJSON();
  }
} 
import { PerformanceTaskUnit } from "./schemas";

export interface Memory {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  clear(): void;
}

/**
 * In-memory implementation of the Memory interface
 */
export class InMemoryMemory implements Memory {
  private storage: Map<string, any> = new Map();

  get<T>(key: string): T | undefined {
    return this.storage.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.storage.set(key, value);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Memory implementation specifically for the performance task workflow
 */
export class PerformanceTaskMemory {
  private memory: Memory;
  private performanceTaskUnit: PerformanceTaskUnit;
  private conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

  constructor(memory: Memory, topic: string) {
    this.memory = memory;
    this.performanceTaskUnit = {
      topic,
      currentStep: "task_ideas"
    };
    this.conversationHistory = [];
  }

  /**
   * Get a value from memory
   */
  get<T>(key: string): T | undefined {
    return this.memory.get<T>(key);
  }

  /**
   * Set a value in memory
   */
  set<T>(key: string, value: T): void {
    this.memory.set(key, value);
  }

  /**
   * Get the current performance task unit
   */
  getPerformanceTaskUnit(): PerformanceTaskUnit {
    return this.performanceTaskUnit;
  }

  /**
   * Update the performance task unit
   */
  updatePerformanceTaskUnit(update: Partial<PerformanceTaskUnit>): void {
    this.performanceTaskUnit = {
      ...this.performanceTaskUnit,
      ...update
    };
  }

  /**
   * Set the current step
   */
  setCurrentStep(step: string): void {
    this.performanceTaskUnit.currentStep = step as any;
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(role: "user" | "assistant", content: string): void {
    this.conversationHistory.push({ role, content });
  }

  /**
   * Get the conversation history
   */
  getConversationHistory(): { role: "user" | "assistant"; content: string }[] {
    return this.conversationHistory;
  }

  /**
   * Clear the memory
   */
  clear(): void {
    this.memory.clear();
    this.performanceTaskUnit = {
      topic: this.performanceTaskUnit.topic,
      currentStep: "task_ideas"
    };
    this.conversationHistory = [];
  }

  /**
   * Convert the memory to a JSON object
   */
  toJSON(): Record<string, any> {
    return {
      performanceTaskUnit: this.performanceTaskUnit,
      conversationHistory: this.conversationHistory
    };
  }
} 
import { z } from "zod";

// Performance task workflow schemas
export const TaskIdeaSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  role: z.string(),
  audience: z.string(),
  purpose: z.string(),
});

export type TaskIdea = z.infer<typeof TaskIdeaSchema>;

export const TaskIdeasSchema = z.object({
  ideas: z.array(TaskIdeaSchema),
});

export type TaskIdeas = z.infer<typeof TaskIdeasSchema>;

export const FocusTopicSchema = z.object({
  id: z.number(),
  topic: z.string(),
  description: z.string(),
});

export type FocusTopic = z.infer<typeof FocusTopicSchema>;

export const FocusTopicsSchema = z.object({
  topics: z.array(FocusTopicSchema),
});

export type FocusTopics = z.infer<typeof FocusTopicsSchema>;

export const ProductOptionSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
});

export type ProductOption = z.infer<typeof ProductOptionSchema>;

export const ProductOptionsSchema = z.object({
  options: z.array(ProductOptionSchema),
});

export type ProductOptions = z.infer<typeof ProductOptionsSchema>;

export const RubricCriterionSchema = z.object({
  name: z.string(),
  description: z.string(),
  orderNumber: z.number(),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const PerformanceTaskSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  purpose: z.string(),
  requirements: z.string(),
  successCriteria: z.string(),
  suggestedFocusTopic: z.string(),
  rubricTitle: z.string(),
  rubricDescription: z.string(),
  rubricCriteria: z.array(RubricCriterionSchema),
});

export type PerformanceTask = z.infer<typeof PerformanceTaskSchema>;

// Performance task step types
export const PerformanceTaskStepType = {
  TASK_IDEAS: "task_ideas",
  FOCUS_TOPICS: "focus_topics",
  PRODUCT_OPTIONS: "product_options",
  REQUIREMENTS: "requirements",
  RUBRIC: "rubric",
  PERFORMANCE_TASK_COMPLETE: "performance_task_complete"
} as const;

export type PerformanceTaskStepType = typeof PerformanceTaskStepType[keyof typeof PerformanceTaskStepType];

// Performance task unit schema
export const PerformanceTaskUnitSchema = z.object({
  topic: z.string(),
  currentStep: z.enum([
    "task_ideas", 
    "focus_topics", 
    "product_options", 
    "requirements", 
    "rubric", 
    "performance_task_complete"
  ]),
  // Performance task specific fields
  selectedTaskIdea: TaskIdeaSchema.optional(),
  selectedFocusTopics: z.array(FocusTopicSchema).optional(),
  selectedProductOptions: z.array(ProductOptionSchema).optional(),
  performanceTask: PerformanceTaskSchema.optional(),
  unit: z.object({
    title: z.string(),
    grade: z.object({
      name: z.string()
    })
  }).optional()
});

export type PerformanceTaskUnit = z.infer<typeof PerformanceTaskUnitSchema>; 
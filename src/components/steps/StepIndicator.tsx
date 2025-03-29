import React from "react";
import { PerformanceTaskStepType } from "@/lib/langchain/schemas";

export interface Step {
  id: string;
  label: string;
  type: PerformanceTaskStepType;
}

export interface StepIndicatorProps {
  steps: Step[];
  currentStepIndex: number;
}

export function StepIndicator({ steps, currentStepIndex }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center space-x-2 mb-8">
      {steps.map((step: Step, index: number) => (
        <React.Fragment key={step.id}>
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm 
              ${index <= currentStepIndex 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
              }`}
          >
            {index + 1}
          </div>
          {index < steps.length - 1 && (
            <div 
              className={`h-1 w-8 
                ${index < currentStepIndex 
                  ? "bg-primary" 
                  : "bg-muted"
                }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
} 
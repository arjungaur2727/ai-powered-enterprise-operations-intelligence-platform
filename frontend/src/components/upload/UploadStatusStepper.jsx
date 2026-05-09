/**
 * src/components/upload/UploadStatusStepper.jsx
 *
 * Horizontal 4-step progress indicator for the upload flow.
 * Props:
 *   currentStep {1|2|3|4}
 */

import React from "react";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Upload File" },
  { label: "Preview & Validate" },
  { label: "Confirm Import" },
  { label: "Complete" },
];

export default function UploadStatusStepper({ currentStep }) {
  return (
    <div className="flex items-start justify-between w-full">
      {STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isDone = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-2 flex-1">
              {/* Circle */}
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                  isDone
                    ? "bg-primary border-primary text-white"
                    : isCurrent
                    ? "border-primary text-primary animate-pulse bg-primary/10"
                    : "border-surface-border text-text-muted bg-white"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              {/* Label */}
              <span
                className={`text-xs font-medium text-center leading-tight ${
                  isDone || isCurrent ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div className="flex-1 mt-4 mx-1">
                <div
                  className={`h-0.5 w-full transition-all duration-300 ${
                    stepNum < currentStep ? "bg-primary" : "bg-surface-border"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

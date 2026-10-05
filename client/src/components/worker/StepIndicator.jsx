import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function StepIndicator({ steps, currentStep }) {
  return (
    <div className="w-full px-1">
      <div className="relative flex items-center justify-between">
        {steps.map((label, index) => (
          <React.Fragment key={label}>
            <div className="relative z-10 flex flex-col items-center" style={{ width: 72 }}>
              {index < currentStep && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#246427] text-[#FFFFFF] shadow-sm">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </div>
              )}
              {index === currentStep && (
                <motion.div
                  className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#246427] bg-[#FFFFFF] text-sm font-semibold text-[#246427]"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                >
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#246427]"
                    animate={{ opacity: [0.45, 0, 0.45], scale: [1, 1.35, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  />
                  <span className="relative z-10">{index + 1}</span>
                </motion.div>
              )}
              {index > currentStep && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#E0E7DC] bg-[#FFFFFF] text-sm font-medium text-[#9E9E9E]">
                  {index + 1}
                </div>
              )}
              <p
                className={`mt-2 max-w-[5.5rem] text-center text-[0.75rem] leading-tight ${
                  index > currentStep
                    ? 'text-[#616161]'
                    : index === currentStep
                      ? 'font-semibold text-[#246427]'
                      : 'text-[#616161]'
                }`}
              >
                {label}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className="relative mx-1 h-0.5 min-w-[16px] flex-1 -translate-y-5 rounded-full bg-[#E0E7DC]">
                <motion.div
                  layoutId={`worker-step-seg-${index}`}
                  className="absolute inset-y-0 left-0 rounded-full bg-[#246427]"
                  initial={false}
                  animate={{
                    width: index < currentStep ? '100%' : index === currentStep ? '55%' : '0%',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

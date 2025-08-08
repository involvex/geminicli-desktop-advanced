import React from "react";
import { GeminiLogo } from "./GeminiLogo";
import { PiebaldLogo } from "./PiebaldLogo";

type PageLayoutProps = {
  children: React.ReactNode;
};

/**
 * PageLayout
 * Shared layout for top header + a single scrollable content region.
 * Assumes the parent provides a flex h-screen w-full overflow-hidden wrapper.
 */
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Top Header */}
      <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center w-full">
            {/* Left section - Gemini Desktop Logo */}
            <div className="flex flex-1 items-center gap-1">
              <GeminiLogo />
              <span className="text-lg font-medium bg-gradient-to-r from-[#3186ff] via-[#346bf1] to-[#4fa0ff] bg-clip-text text-transparent">
                Desktop
              </span>
            </div>

            {/* Right section - Piebald branding */}
            <div className="flex flex-1 flex-col items-end text-xs text-neutral-400">
              <p>From the creators of</p> <PiebaldLogo />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 flex flex-col bg-background min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

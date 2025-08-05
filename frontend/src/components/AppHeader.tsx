import React from "react";
import { GeminiLogo } from "./GeminiLogo";
import { PiebaldLogo } from "./PiebaldLogo";

export const AppHeader: React.FC = () => {
  return (
    <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
      <div className="px-6 py-4">
        <div className="flex items-center w-full">
          {/* Left section - Gemini Desktop Logo */}
          <div className="flex flex-1 items-center gap-1">
            <GeminiLogo />
            <span className="text-lg font-medium gradient-text-desktop">
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
  );
};
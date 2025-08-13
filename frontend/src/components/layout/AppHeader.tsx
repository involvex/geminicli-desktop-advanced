import React from "react";
import { GeminiLogo } from "../branding/GeminiLogoFixed";
import { PiebaldLogo } from "../branding/PiebaldLogoFixed";

import { StatsWidget } from "./StatsWidget";
import { ThemeToggle } from "../ui/theme-toggle";

export const AppHeader: React.FC = () => {
  return (
    <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
      <div className="px-6 py-4">
        <div className="flex items-center w-full">
          {/* Left section */}
          <div className="flex items-center gap-3">
          </div>

          {/* Center section - Logos and branding inline */}
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <GeminiLogo />
                <span className="text-lg font-medium gradient-text-desktop">
                  Desktop
                </span>
              </div>
              <div className="flex items-center gap-2 text-lg font-medium text-neutral-400">
                <span>Improved by InvolveX</span>
                <img src="/icon.png" alt="App Icon" className="w-6 h-6 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">From the creators of</span>
                <PiebaldLogo />
              </div>
            </div>
            
            {/* Stats Widget and Theme Toggle */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <StatsWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

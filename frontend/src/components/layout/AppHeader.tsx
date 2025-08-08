import React from "react";
import { GeminiLogo } from "../branding/GeminiLogo";
import { PiebaldLogo } from "../branding/PiebaldLogo";
import { SidebarTrigger } from "../ui/sidebar";

export const AppHeader: React.FC = () => {
  return (
    <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
      <div className="px-6 py-4">
        <div className="flex items-center w-full">
          {/* Left section - Sidebar trigger + Gemini Desktop Logo */}
          <div className="flex flex-1 items-center gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <GeminiLogo />
              <span className="text-lg font-medium gradient-text-desktop">
                Desktop
              </span>
            </div>
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

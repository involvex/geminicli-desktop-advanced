import React from "react";
import { GeminiLogo } from "../branding/GeminiLogo";
import { PiebaldLogo } from "../branding/PiebaldLogo";
import { SidebarTrigger } from "../ui/sidebar";

export const AppHeader: React.FC = () => {
  return (
    <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
      <div className="px-6 py-4">
        <div className="flex items-center w-full">
          {/* Left section - Sidebar trigger */}
          <div className="flex items-center gap-3">
            <SidebarTrigger />
          </div>

          {/* Center section - Logos and branding inline */}
          <div className="flex-1 flex items-center justify-center gap-6">
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
        </div>
      </div>
    </div>
  );
};

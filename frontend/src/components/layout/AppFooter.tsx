import React from "react";

export const AppFooter: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 min-h-12 py-2 border-t border-border bg-background flex items-center justify-center z-10">
      {/* Left corner: logo and created by */}
      <div className="absolute left-4 bottom-2 flex items-center gap-1">
        <img 
          src="/icon.png" 
          alt="App Icon" 
          className="w-8 h-8 rounded-md mr-2" 
        />
        <span className="text-pink-300 text-xs font-semibold mr-1">
          Created by{" "}
          <a 
            href="https://github.com/involvex/gemini-desktop-advanced" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-pink-300 underline hover:text-pink-200"
          >
            InvolveX
          </a>
        </span>
      </div>

      {/* Center: links */}
      <div className="flex gap-4 items-center justify-center">
        <a 
          href="https://involvex.github.io/geminicli-desktop-advanced/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-pink-300 underline flex items-center gap-1 hover:text-pink-200 text-sm"
        >
          <span role="img" aria-label="homepage">🌐</span> Homepage
        </a>
        <a 
          href="https://www.buymeacoffee.com/involvex" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-yellow-200 underline flex items-center gap-1 hover:text-yellow-100 text-sm"
        >
          <span role="img" aria-label="coffee">☕</span> Buy me a coffee
        </a>
        <a 
          href="https://github.com/involvex/geminicli-desktop-advanced" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-pink-300 underline flex items-center gap-1 hover:text-pink-200 text-sm"
        >
          <span role="img" aria-label="github">🐙</span> GitHub
        </a>
      </div>
    </footer>
  );
};

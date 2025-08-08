"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  type JSX,
} from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import {
  type BundledLanguage,
  bundledLanguages,
  bundledThemes,
  createHighlighter,
} from "shiki/bundle/full";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useTheme } from "next-themes";

const LANGUAGE_MAPPINGS: Record<string, string> = {
  "c++": "cpp",
};

// Remove debounce hook - not needed with proper caching

// Utility function to convert CSS string to React style object
const cssStringToObject = (cssString: string): React.CSSProperties => {
  const styleObject: React.CSSProperties = {};

  // Split by semicolon and process each declaration
  cssString.split(";").forEach((declaration) => {
    const [property, value] = declaration.split(":").map((s) => s.trim());

    if (property && value) {
      let processedProperty: string;
      let processedValue: string | number = value;

      // Handle CSS variables (custom properties starting with --)
      if (property.startsWith("--")) {
        // CSS variables should remain as-is
        processedProperty = property;
        // CSS variable values should always be strings
        processedValue = value;
      } else {
        // Convert kebab-case to camelCase for regular CSS properties
        processedProperty = property.replace(/-([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );

        // Handle values containing CSS variables (var()) - keep as strings
        if (value.includes("var(")) {
          processedValue = value;
        }
        // Convert pixel values to numbers if they're just numbers + 'px'
        else if (value.endsWith("px") && !isNaN(Number(value.slice(0, -2)))) {
          processedValue = Number(value.slice(0, -2));
        }
        // Keep other values as strings
        else {
          processedValue = value;
        }
      }

      (styleObject as Record<string, string | number>)[processedProperty] =
        processedValue;
    }
  });

  return styleObject;
};

// Global cache to persist across component instances
const highlightCache = new Map<
  string,
  { content: React.ReactElement; preStyle: string }
>();

// Create highlighter instance - initialize as promise
const highlighterPromise = createHighlighter({
  themes: Object.keys(bundledThemes),
  langs: [], // Start with no languages - load on demand
});

const CodeBlock = React.memo(
  ({ code, language }: { code: string; language: string }) => {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    // Default themes based on current theme
    const lightTheme = "github-light";
    const darkTheme = "github-dark";

    // Memoize the mapping to prevent unnecessary effect triggers
    const mappedLanguage = useMemo(() => {
      if (!language || language.trim() === "") {
        return "text"; // Default to plain text for empty languages
      }
      return language in LANGUAGE_MAPPINGS
        ? LANGUAGE_MAPPINGS[language]
        : language;
    }, [language]);

    // Create cache key based on actual code (like original)
    const cacheKey = useMemo(() => {
      return `${code}-${language}-${mappedLanguage}-${lightTheme}-${darkTheme}-${resolvedTheme}`;
    }, [code, language, mappedLanguage, lightTheme, darkTheme, resolvedTheme]);

    // Create fallback content (plain code) - memoized to prevent unnecessary re-creation
    const createFallback = useCallback(() => {
      const lines = code.split("\n");
      return (
        <pre>
          {lines.map((line, idx) => (
            <div className="line" key={idx}>
              {line}
            </div>
          ))}
        </pre>
      );
    }, [code]);

    // Initialize state with null to indicate loading
    const [highlightedContent, setHighlightedContent] =
      useState<React.ReactElement | null>(null);
    const [preStyle, setPreStyle] = useState<string>("");

    useEffect(() => {
      // Check if we have cached content for this specific key
      const cached = highlightCache.get(cacheKey);

      // If we have cached content, use it immediately
      if (cached) {
        setHighlightedContent(cached.content);
        setPreStyle(cached.preStyle);
        return;
      }

      // If we don't have cached content, we need to highlight
      let isMounted = true;

      const highlightCode = async () => {
        try {
          // Wait for highlighter to be ready
          const highlighter = await highlighterPromise;

          // Clear conflicting cache entries to prevent bloat
          const conflictingKeys = Array.from(highlightCache.keys()).filter(
            (key) =>
              key.startsWith(`${code}-${language}-${mappedLanguage}-`) &&
              key !== cacheKey
          );
          conflictingKeys.forEach((key) => highlightCache.delete(key));

          // Load language if not already loaded
          if (
            mappedLanguage !== "text" &&
            !highlighter.getLoadedLanguages().includes(mappedLanguage)
          ) {
            try {
              await highlighter.loadLanguage(mappedLanguage as BundledLanguage);
            } catch {
              // Ignore errors - Shiki will just not highlight (i.e. use the `text` language) for non-existent
              // languages.
            }

            if (!isMounted) return;
          }

          // Check if the language is valid before attempting to highlight
          const validLanguage =
            mappedLanguage in bundledLanguages
              ? (mappedLanguage as BundledLanguage)
              : ("text" as BundledLanguage);

          let capturedPreStyle = "";

          const currentTheme =
            resolvedTheme === "dark" ? darkTheme : lightTheme;

          // Use actual code for highlighting (like original)
          const hast = highlighter.codeToHast(code, {
            lang: validLanguage,
            theme: currentTheme,
            transformers: [
              {
                pre: (node: { properties?: { style?: string } }) => {
                  if (node.properties?.style) {
                    capturedPreStyle = node.properties?.style as string;
                  }
                },
              },
            ],
          });

          if (!isMounted) return;

          // Create React element from highlighted hast
          const highlighted = toJsxRuntime(hast, {
            Fragment,
            jsx,
            jsxs,
          }) as JSX.Element;

          // Cache the result for future use
          highlightCache.set(cacheKey, {
            content: highlighted,
            preStyle: capturedPreStyle,
          });

          setHighlightedContent(highlighted);
          setPreStyle(capturedPreStyle);
        } catch (error) {
          if (!isMounted) return;

          console.warn(
            `Failed to highlight code with language "${mappedLanguage}":`,
            error
          );

          // Use fallback content on error
          const fallback = createFallback();
          highlightCache.set(cacheKey, {
            content: fallback,
            preStyle: "",
          });

          setHighlightedContent(fallback);
          setPreStyle("");
        }
      };

      highlightCode();

      return () => {
        isMounted = false;
      };
    }, [
      cacheKey,
      mappedLanguage,
      createFallback,
      lightTheme,
      darkTheme,
      resolvedTheme,
      code,
      language,
    ]);

    // Memoize the style object to prevent unnecessary re-renders
    const memoizedStyle = useMemo(
      () => cssStringToObject(preStyle),
      [preStyle]
    );

    // Show fallback while highlighting is in progress (like original)
    const contentToRender = highlightedContent || createFallback();

    if (!mounted) {
      return null;
    }

    // Always render the container to prevent layout shift
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "shiki font-mono overflow-hidden max-h-96 border border-current/10 rounded-md text-sm my-4",
              "leading-normal [counter-increment:a_0] [&_.line]:before:[counter-increment:a] [&_.line]:before:content-[counter(a)]",
              "[&_.line]:before:mr-6 [&_.line]:before:ml-3 [&_.line]:before:inline-block [&_.line]:before:text-right",
              "[&_.line]:before:text-black/40 dark:[&_.line]:before:text-white/40 [&_.line]:before:min-w-8",
              "max-w-full min-w-0 overflow-x-auto"
            )}
            style={memoizedStyle}
          >
            <div className="overflow-auto max-h-96 p-2 [&_pre]:focus-visible:outline-none [&_pre]:whitespace-pre [&_pre]:leading-normal">
              {contentToRender}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem
            onClick={() => navigator.clipboard.writeText(code)}
            className="flex items-center gap-2"
          >
            <Copy />
            Copy code
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

CodeBlock.displayName = "CodeBlock";

export default CodeBlock;

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Code } from "@/components/ui/code";
import CodeBlock from "@/components/CodeBlock";
import { openUrl } from "@tauri-apps/plugin-opener";

// Helper function to determine if a URL is external
function isExternalUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Helper function to handle link clicks
async function handleLinkClick(href: string, event: React.MouseEvent) {
  if (isExternalUrl(href)) {
    event.preventDefault();
    try {
      await openUrl(href);
    } catch (error) {
      console.error("Failed to open URL with Tauri opener:", error);
      // Fallback to default behavior if Tauri opener fails
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }
}

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose prose-stone prose-sm max-w-none dark:prose-invert text-sm break-words overflow-wrap-anywhere">
      <ReactMarkdown
        components={{
          // Headers
          h1: (props) => (
            <h1
              className="text-3xl font-bold mt-6 mb-4 text-foreground"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="text-2xl font-bold mt-5 mb-3 text-foreground"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="text-xl font-bold mt-4 mb-2 text-foreground"
              {...props}
            />
          ),
          h4: (props) => (
            <h4
              className="text-lg font-bold mt-3 mb-2 text-foreground"
              {...props}
            />
          ),
          h5: (props) => (
            <h5
              className="text-base font-bold mt-2 mb-1 text-foreground"
              {...props}
            />
          ),
          h6: (props) => (
            <h6
              className="text-sm font-bold mt-2 mb-1 text-foreground"
              {...props}
            />
          ),
          // Lists
          ul: (props) => (
            <ul
              className="list-disc list-outside pl-6 my-4 space-y-1 text-foreground"
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="list-decimal list-outside pl-6 my-4 space-y-1 text-foreground"
              {...props}
            />
          ),
          li: (props) => <li className="text-foreground" {...props} />,
          // Blockquotes
          blockquote: (props) => (
            <blockquote
              className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/50 rounded-r text-muted-foreground italic"
              {...props}
            />
          ),
          // Horizontal rule
          hr: (props) => <hr className="my-6 border-border" {...props} />,
          // Paragraphs
          p: (props) => (
            <p className="my-3 text-foreground leading-relaxed" {...props} />
          ),
          code: ({ children, className }) => {
            const content = (children as string) || "";

            // Detect if this should be a code block:
            // 1. Has a language class (className starts with "language-")
            // 2. Contains newlines (multiline content is typically a code block)
            const hasLanguageClass = className?.startsWith("language-");
            const hasNewlines = content.includes("\n");
            const isCodeBlock = hasLanguageClass || hasNewlines;

            if (isCodeBlock) {
              // Extract language from className, defaulting to empty string for code blocks without language
              const language = className?.replace("language-", "") || "";

              return <CodeBlock code={content.trim()} language={language} />;
            } else {
              // Render as inline code
              return <Code>{children}</Code>;
            }
          },
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              onClick={(e) => href && handleLinkClick(href, e)}
              className="text-primary hover:text-primary/80 underline underline-offset-2"
              {...props}
            >
              {children}
            </a>
          ),
          table: (props) => (
            <div className="rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-800 max-w-full">
              <div className="overflow-x-auto w-full">
                <table className="not-prose w-full text-sm" {...props} />
              </div>
            </div>
          ),
          thead: (props) => <thead {...props} />,
          tbody: (props) => <tbody {...props} />,
          tr: (props) => <tr {...props} />,
          th: (props) => (
            <th
              className="border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-4 py-3 text-left font-medium text-gray-900 dark:text-neutral-100"
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="border-b border-gray-200 dark:border-neutral-700 px-4 py-3 text-gray-700 dark:text-neutral-300 align-top text-wrap break-words"
              {...props}
            />
          ),
          pre: (props) => <pre {...props} className="not-prose" />,
        }}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

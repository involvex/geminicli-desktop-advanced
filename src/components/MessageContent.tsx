import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface MessageContentProps {
  content: string;
  sender: 'user' | 'assistant';
}

export function MessageContent({ content, sender: _ }: MessageContentProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === 'dark';

  // Always render markdown, but with error boundaries to handle incomplete markdown gracefully
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert text-sm break-words overflow-wrap-anywhere">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block styling with react-syntax-highlighter
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const inline = !className;
            
            if (!inline) {
              const codeString = String(children).replace(/\n$/, '');
              
              return (
                <div className="my-4 rounded-lg border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <div className="bg-gray-50 dark:bg-slate-800 px-4 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <span>{language || 'code'}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(codeString)}
                      className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <SyntaxHighlighter
                      style={isDark ? oneDark : oneLight}
                      language={language || 'text'}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        wordWrap: 'break-word',
                        overflowWrap: 'anywhere',
                        whiteSpace: 'pre-wrap',
                      }}
                      codeTagProps={{
                        style: {
                          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
                        }
                      }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            }
            
            return (
              <code className="bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          // Custom blockquote styling
          blockquote({ children }) {
            return (
              <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-4 my-4 rounded-r text-sm">
                <div className="text-blue-800 dark:text-blue-200">{children}</div>
              </div>
            );
          },
          // Custom table styling
          table({ children }) {
            return (
              <div className="overflow-hidden my-4 border border-gray-200 dark:border-slate-700 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {children}
                  </table>
                </div>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-left font-medium text-gray-900 dark:text-slate-100">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-gray-200 dark:border-slate-700 px-4 py-3 text-gray-700 dark:text-slate-300">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
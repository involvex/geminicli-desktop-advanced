export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  result?: any;
  status?: 'pending' | 'running' | 'completed' | 'error';
}

export interface ParsedContent {
  text: string;
  toolCalls: ToolCall[];
}

export class ToolCallParser {
  private static toolCallCounter = 0;

  static parseGeminiOutput(output: string): ParsedContent {
    const toolCalls: ToolCall[] = [];
    let cleanedText = output;

    // Pattern to match tool calls in Gemini CLI output
    // This might look like: "Calling tool: search_web with parameters: {"query": "..."}"
    // Or: "Tool call: get_weather(location=San Francisco)"
    // Or JSON-like tool call formats
    
    const patterns = [
      // Pattern 1: "Calling tool: toolName with parameters: {...}"
      /Calling tool: (\w+) with parameters: ({.*?})/g,
      
      // Pattern 2: "Tool call: toolName({...})" 
      /Tool call: (\w+)\(([^)]*)\)/g,
      
      // Pattern 3: Function call format "toolName({...})"
      /^(\w+)\(({.*?})\)$/gm,
      
      // Pattern 4: JSON-like tool calls
      /"tool_calls":\s*\[\s*{[^}]*"name":\s*"(\w+)"[^}]*"parameters":\s*({[^}]*})/g,
      
      // Pattern 5: MCP-style tool calls
      /\[TOOL_CALL\]\s*(\w+):\s*({.*?})\s*\[\/TOOL_CALL\]/g,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        try {
          const toolName = match[1];
          const parametersStr = match[2];
          
          let parameters: Record<string, any> = {};
          
          // Try to parse parameters as JSON
          try {
            parameters = JSON.parse(parametersStr);
          } catch {
            // If JSON parsing fails, try to parse as key=value pairs
            if (parametersStr.includes('=')) {
              const pairs = parametersStr.split(',');
              pairs.forEach(pair => {
                const [key, value] = pair.split('=').map(s => s.trim());
                if (key && value) {
                  // Remove quotes if present
                  parameters[key] = value.replace(/^["']|["']$/g, '');
                }
              });
            }
          }

          const toolCall: ToolCall = {
            id: `tool_${++this.toolCallCounter}_${Date.now()}`,
            name: toolName,
            parameters,
            status: 'pending'
          };

          toolCalls.push(toolCall);
          
          // Remove the tool call text from the main content
          cleanedText = cleanedText.replace(match[0], '');
          
        } catch (error) {
          console.warn('Failed to parse tool call:', match[0], error);
        }
      }
    });

    // Look for tool results
    this.parseToolResults(output, toolCalls);

    return {
      text: cleanedText.trim(),
      toolCalls
    };
  }

  private static parseToolResults(output: string, toolCalls: ToolCall[]) {
    // Pattern to match tool results
    const resultPatterns = [
      // Pattern 1: "Tool result: {...}"
      /Tool result: ({.*?})/g,
      
      // Pattern 2: "Result from toolName: {...}"
      /Result from (\w+): ({.*?})/g,
      
      // Pattern 3: MCP-style results
      /\[TOOL_RESULT\]\s*({.*?})\s*\[\/TOOL_RESULT\]/g,
      
      // Pattern 4: Simple success/error messages
      /(Tool executed successfully|Tool execution failed|Error executing tool)/g,
    ];

    resultPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(output)) !== null) {
        try {
          // Find the most recent tool call to attach this result to
          const latestToolCall = toolCalls[toolCalls.length - 1];
          if (latestToolCall && !latestToolCall.result) {
            if (match[1] && match[1].startsWith('{')) {
              // JSON result
              latestToolCall.result = JSON.parse(match[1]);
            } else {
              // Text result
              latestToolCall.result = { message: match[0] };
            }
            latestToolCall.status = 'completed';
          }
        } catch (error) {
          console.warn('Failed to parse tool result:', match[0], error);
        }
      }
    });
  }

  static detectStreamingToolCall(chunk: string): { isToolCall: boolean; toolName?: string; isComplete: boolean } {
    // Detect if the current chunk is part of a tool call
    const toolCallStart = /Calling tool:|Tool call:|^\w+\(/;
    const toolCallEnd = /\)$|}\s*$/;
    
    return {
      isToolCall: toolCallStart.test(chunk),
      toolName: chunk.match(/(?:Calling tool:|Tool call:)\s*(\w+)/)?.[1],
      isComplete: toolCallEnd.test(chunk)
    };
  }
}

export default ToolCallParser;
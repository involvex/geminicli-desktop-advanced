import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Search, Play, Info, ExternalLink } from "lucide-react";

interface Tool {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  examples: string[];
}

interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

const AVAILABLE_TOOLS: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    category: "File System",
    parameters: [
      { name: "path", type: "string", required: true, description: "Path to the file to read" }
    ],
    examples: ["Read package.json", "Read configuration file"]
  },
  {
    name: "write_file",
    description: "Write content to a file",
    category: "File System",
    parameters: [
      { name: "path", type: "string", required: true, description: "Path to the file to write" },
      { name: "content", type: "string", required: true, description: "Content to write to the file" }
    ],
    examples: ["Create new file", "Update existing file"]
  },
  {
    name: "list_directory",
    description: "List contents of a directory",
    category: "File System",
    parameters: [
      { name: "path", type: "string", required: true, description: "Path to the directory to list" }
    ],
    examples: ["List project files", "Browse directory structure"]
  },
  {
    name: "execute_command",
    description: "Execute a shell command",
    category: "System",
    parameters: [
      { name: "command", type: "string", required: true, description: "Command to execute" },
      { name: "working_directory", type: "string", required: false, description: "Working directory for the command" }
    ],
    examples: ["Run build script", "Check system status"]
  }
];

interface ToolsBrowserProps {
  onToolSelect?: (tool: Tool) => void;
}

export function ToolsBrowser({ onToolSelect }: ToolsBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = ["all", ...Array.from(new Set(AVAILABLE_TOOLS.map(t => t.category)))];
  
  const filteredTools = AVAILABLE_TOOLS.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTools.map((tool) => (
          <Card key={tool.name} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-mono">{tool.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {tool.description}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-2">
                  {tool.category}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Parameters:</h4>
                <div className="space-y-1">
                  {tool.parameters.map(param => (
                    <div key={param.name} className="text-xs">
                      <span className="font-mono">{param.name}</span>
                      <span className="text-muted-foreground"> ({param.type})</span>
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                      <div className="text-muted-foreground ml-2">{param.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Examples:</h4>
                <div className="flex flex-wrap gap-1">
                  {tool.examples.map((example, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-auto flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onToolSelect?.(tool)}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Use Tool
                </Button>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No tools found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
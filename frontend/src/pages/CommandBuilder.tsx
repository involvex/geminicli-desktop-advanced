import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Play, Copy, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: Parameter[];
}

interface Parameter {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  required: boolean;
  description: string;
  options?: string[];
  defaultValue?: string;
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  {
    id: "file-analysis",
    name: "File Analysis",
    description: "Analyze a file for patterns, issues, or insights",
    command: "gemini --model {model} --tools filesystem",
    parameters: [
      { name: "model", type: "select", required: true, description: "AI model to use", options: ["gemini-2.5-pro", "gemini-2.5-flash"], defaultValue: "gemini-2.5-flash" },
      { name: "file_path", type: "string", required: true, description: "Path to the file to analyze" },
      { name: "analysis_type", type: "select", required: false, description: "Type of analysis", options: ["security", "performance", "style", "general"], defaultValue: "general" }
    ]
  },
  {
    id: "web-research",
    name: "Web Research",
    description: "Research a topic using web search tools",
    command: "gemini --model {model} --tools web-search",
    parameters: [
      { name: "model", type: "select", required: true, description: "AI model to use", options: ["gemini-2.5-pro", "gemini-2.5-flash"], defaultValue: "gemini-2.5-pro" },
      { name: "topic", type: "string", required: true, description: "Research topic or question" },
      { name: "depth", type: "select", required: false, description: "Research depth", options: ["quick", "detailed", "comprehensive"], defaultValue: "detailed" }
    ]
  }
];

export default function CommandBuilderPage() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [customCommand, setCustomCommand] = useState("");
  const [builtCommand, setBuiltCommand] = useState("");

  const handleTemplateSelect = (template: CommandTemplate) => {
    setSelectedTemplate(template);
    const defaultValues: Record<string, string> = {};
    template.parameters.forEach(param => {
      if (param.defaultValue) {
        defaultValues[param.name] = param.defaultValue;
      }
    });
    setParameterValues(defaultValues);
    buildCommand(template, defaultValues);
  };

  const handleParameterChange = (paramName: string, value: string) => {
    const newValues = { ...parameterValues, [paramName]: value };
    setParameterValues(newValues);
    if (selectedTemplate) {
      buildCommand(selectedTemplate, newValues);
    }
  };

  const buildCommand = (template: CommandTemplate, values: Record<string, string>) => {
    let command = template.command;
    
    // Replace parameter placeholders
    template.parameters.forEach(param => {
      const value = values[param.name] || param.defaultValue || "";
      command = command.replace(`{${param.name}}`, value);
    });
    
    // Add custom prompt if provided
    if (customCommand.trim()) {
      command += ` "${customCommand.trim()}"`;
    }
    
    setBuiltCommand(command);
  };

  const handleCustomCommandChange = (value: string) => {
    setCustomCommand(value);
    if (selectedTemplate) {
      buildCommand(selectedTemplate, parameterValues);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(builtCommand);
  };

  const executeCommand = () => {
    // This would integrate with the conversation system
    console.log("Executing command:", builtCommand);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to Home</span>
          </button>

          <div className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Command Builder</h1>
            <p className="mt-2 text-muted-foreground">
              Build and customize Gemini CLI commands with templates and parameters
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Selection */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Command Templates</h2>
              
              {COMMAND_TEMPLATES.map((template) => (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id ? "ring-2 ring-blue-500" : "hover:shadow-md"
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {template.parameters.map(param => (
                        <Badge key={param.name} variant="outline" className="text-xs">
                          {param.name}
                          {param.required && <span className="text-red-500 ml-1">*</span>}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Parameter Configuration */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Configuration</h2>
              
              {selectedTemplate ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedTemplate.name}</CardTitle>
                    <CardDescription>Configure parameters for this command</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedTemplate.parameters.map((param) => (
                      <div key={param.name} className="space-y-2">
                        <Label htmlFor={param.name}>
                          {param.name}
                          {param.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        
                        {param.type === "select" && param.options ? (
                          <Select
                            value={parameterValues[param.name] || param.defaultValue || ""}
                            onValueChange={(value) => handleParameterChange(param.name, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${param.name}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {param.options.map(option => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={param.name}
                            type={param.type === "number" ? "number" : "text"}
                            value={parameterValues[param.name] || ""}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            placeholder={param.description}
                          />
                        )}
                        
                        <p className="text-xs text-muted-foreground">{param.description}</p>
                      </div>
                    ))}
                    
                    <div className="space-y-2">
                      <Label htmlFor="custom-prompt">Custom Prompt</Label>
                      <Textarea
                        id="custom-prompt"
                        value={customCommand}
                        onChange={(e) => handleCustomCommandChange(e.target.value)}
                        placeholder="Enter your custom prompt or question..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Select a template to configure parameters</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Generated Command */}
          {builtCommand && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Generated Command</CardTitle>
                <CardDescription>Review and execute your built command</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md font-mono text-sm mb-4">
                  {builtCommand}
                </div>
                <div className="flex gap-2">
                  <Button onClick={executeCommand}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute
                  </Button>
                  <Button variant="outline" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
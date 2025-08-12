import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Lightbulb, Folder, MessageSquare, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavigationMenu } from "../components/navigation/NavigationMenu";

interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  tech: string[];
  complexity: "simple" | "medium" | "complex";
  estimatedTime: string;
}

interface ProjectConfig {
  name: string;
  description: string;
  type: string;
  path: string;
  tech: string[];
}

const PROJECT_TEMPLATES = [
  "web-app", "cli-tool", "api-service", "desktop-app", "mobile-app", 
  "data-analysis", "ml-project", "game", "library", "automation"
];



export default function ProjectBuilderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"ideas" | "config" | "overview">("ideas");
  const [userPrompt, setUserPrompt] = useState("");
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<ProjectIdea | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({
    name: "", description: "", type: "", path: "", tech: []
  });
  const [loading, setLoading] = useState(false);

  const generateIdeas = async () => {
    setLoading(true);
    // Simulate AI idea generation
    setTimeout(() => {
      const mockIdeas: ProjectIdea[] = [
        {
          id: "1",
          title: "Task Management CLI",
          description: "A command-line task manager with AI-powered prioritization and time tracking",
          tech: ["Rust", "SQLite", "AI Integration"],
          complexity: "medium",
          estimatedTime: "2-3 weeks"
        },
        {
          id: "2", 
          title: "Code Review Assistant",
          description: "Web app that analyzes code quality and suggests improvements using AI",
          tech: ["React", "TypeScript", "Python", "FastAPI"],
          complexity: "complex",
          estimatedTime: "4-6 weeks"
        },
        {
          id: "3",
          title: "Personal Finance Tracker",
          description: "Desktop app for tracking expenses with automated categorization",
          tech: ["Tauri", "React", "SQLite"],
          complexity: "simple",
          estimatedTime: "1-2 weeks"
        }
      ];
      setIdeas(mockIdeas);
      setLoading(false);
    }, 2000);
  };

  const selectIdea = (idea: ProjectIdea) => {
    setSelectedIdea(idea);
    setProjectConfig({
      name: idea.title.toLowerCase().replace(/\s+/g, '-'),
      description: idea.description,
      type: "custom",
      path: "",
      tech: idea.tech
    });
    setStep("config");
  };

  const createProject = async () => {
    setLoading(true);
    // Simulate project creation
    setTimeout(() => {
      setStep("overview");
      setLoading(false);
    }, 3000);
  };

  const startDevelopment = () => {
    navigate(`/chat?project=${encodeURIComponent(projectConfig.name)}&path=${encodeURIComponent(projectConfig.path)}`);
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

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <NavigationMenu />
              <h1 className="text-3xl font-semibold tracking-tight">Project Builder</h1>
            </div>
            <div className="flex gap-2">
              <Badge variant={step === "ideas" ? "default" : "outline"}>Ideas</Badge>
              <Badge variant={step === "config" ? "default" : "outline"}>Config</Badge>
              <Badge variant={step === "overview" ? "default" : "outline"}>Overview</Badge>
            </div>
          </div>

          {step === "ideas" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Project Ideas
                  </CardTitle>
                  <CardDescription>
                    Describe what you want to build and get AI-generated project ideas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="I want to build a tool that helps developers..."
                    rows={3}
                  />
                  <Button onClick={generateIdeas} disabled={loading || !userPrompt.trim()}>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    {loading ? "Generating Ideas..." : "Generate Ideas"}
                  </Button>
                </CardContent>
              </Card>

              {ideas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ideas.map((idea) => (
                    <Card key={idea.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{idea.title}</CardTitle>
                        <CardDescription>{idea.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-1">
                            {idea.tech.map(tech => (
                              <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
                            ))}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className={`capitalize ${
                              idea.complexity === "simple" ? "text-green-600" :
                              idea.complexity === "medium" ? "text-yellow-600" : "text-red-600"
                            }`}>
                              {idea.complexity}
                            </span>
                            <span className="text-muted-foreground">{idea.estimatedTime}</span>
                          </div>
                          <Button onClick={() => selectIdea(idea)} className="w-full">
                            Select This Idea
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "config" && selectedIdea && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Configuration</CardTitle>
                  <CardDescription>Configure your project settings and structure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Project Name</label>
                      <Input
                        value={projectConfig.name}
                        onChange={(e) => setProjectConfig(prev => ({...prev, name: e.target.value}))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Project Type</label>
                      <Select value={projectConfig.type} onValueChange={(value) => setProjectConfig(prev => ({...prev, type: value}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_TEMPLATES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Project Path</label>
                    <Input
                      value={projectConfig.path}
                      onChange={(e) => setProjectConfig(prev => ({...prev, path: e.target.value}))}
                      placeholder="/path/to/project"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      value={projectConfig.description}
                      onChange={(e) => setProjectConfig(prev => ({...prev, description: e.target.value}))}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("ideas")}>Back</Button>
                    <Button onClick={createProject} disabled={loading}>
                      <Folder className="h-4 w-4 mr-2" />
                      {loading ? "Creating Project..." : "Create Project"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === "overview" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Folder className="h-5 w-5" />
                    Project Overview
                  </CardTitle>
                  <CardDescription>Your project has been created successfully</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Project Name</h4>
                      <p className="text-muted-foreground">{projectConfig.name}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Type</h4>
                      <p className="text-muted-foreground">{projectConfig.type}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium">Description</h4>
                    <p className="text-muted-foreground">{projectConfig.description}</p>
                  </div>

                  <div>
                    <h4 className="font-medium">Technologies</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {projectConfig.tech.map(tech => (
                        <Badge key={tech} variant="secondary">{tech}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium">Project Structure Created</h4>
                    <div className="bg-muted p-3 rounded font-mono text-sm mt-1">
                      <div>📁 {projectConfig.name}/</div>
                      <div>├── 📄 README.md</div>
                      <div>├── 📄 .gitignore</div>
                      <div>├── 📁 src/</div>
                      <div>├── 📁 tests/</div>
                      <div>└── 📄 package.json</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={startDevelopment}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Start Development Chat
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/files")}>
                      <Folder className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
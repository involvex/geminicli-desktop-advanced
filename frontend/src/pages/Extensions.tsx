import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Search, Download, Settings, ExternalLink, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ToolsBrowser } from "../components/tools/ToolsBrowser";

interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  installed: boolean;
  enabled: boolean;
  tools: string[];
}

const MOCK_EXTENSIONS: Extension[] = [
  {
    id: "filesystem",
    name: "File System Tools",
    description: "Read, write, and manage files and directories",
    version: "1.0.0",
    author: "Gemini CLI",
    category: "System",
    installed: true,
    enabled: true,
    tools: ["read_file", "write_file", "list_directory", "create_directory"]
  },
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the web and retrieve information",
    version: "2.1.0",
    author: "Community",
    category: "Web",
    installed: false,
    enabled: false,
    tools: ["search_web", "get_webpage", "extract_content"]
  },
  {
    id: "code-analysis",
    name: "Code Analysis",
    description: "Analyze code structure and quality",
    version: "1.5.2",
    author: "DevTools",
    category: "Development",
    installed: true,
    enabled: false,
    tools: ["analyze_code", "find_bugs", "suggest_improvements"]
  }
];

export default function ExtensionsPage() {
  const navigate = useNavigate();
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"extensions" | "tools">("extensions");

  const categories = ["all", ...Array.from(new Set(extensions.map(e => e.category)))];
  
  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ext.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || ext.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleToggleExtension = (id: string) => {
    setExtensions(prev => prev.map(ext => 
      ext.id === id ? { ...ext, enabled: !ext.enabled } : ext
    ));
  };

  const handleInstallExtension = (id: string) => {
    setExtensions(prev => prev.map(ext => 
      ext.id === id ? { ...ext, installed: true } : ext
    ));
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
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Extensions & Tools</h1>
              <p className="mt-2 text-muted-foreground">
                Discover and manage extensions that add new capabilities to Gemini CLI
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === "extensions" ? "default" : "outline"}
              onClick={() => setActiveTab("extensions")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Extensions
            </Button>
            <Button
              variant={activeTab === "tools" ? "default" : "outline"}
              onClick={() => setActiveTab("tools")}
              className="flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" />
              Available Tools
            </Button>
          </div>

          {/* Content based on active tab */}
          {activeTab === "extensions" ? (
            <>
              {/* Search and Filters */}
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search extensions..."
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

              {/* Extensions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExtensions.map((extension) => (
                  <Card key={extension.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{extension.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {extension.description}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {extension.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>v{extension.version}</span>
                        <span>•</span>
                        <span>by {extension.author}</span>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Available Tools:</h4>
                        <div className="flex flex-wrap gap-1">
                          {extension.tools.map(tool => (
                            <Badge key={tool} variant="secondary" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mt-auto flex gap-2">
                        {extension.installed ? (
                          <>
                            <Button
                              variant={extension.enabled ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleExtension(extension.id)}
                              className="flex-1"
                            >
                              {extension.enabled ? "Enabled" : "Enable"}
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => handleInstallExtension(extension.id)}
                            size="sm"
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Install
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredExtensions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No extensions found matching your criteria.</p>
                </div>
              )}
            </>
          ) : (
            <ToolsBrowser onToolSelect={(tool) => console.log("Selected tool:", tool)} />
          )}
        </div>
      </div>
    </div>
  );
}
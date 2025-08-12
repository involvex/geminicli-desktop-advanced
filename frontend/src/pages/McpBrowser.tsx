import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Search, Star, ExternalLink, Copy, GitBranch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { McpServer } from "../lib/webApi";

export default function McpBrowserPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [popularServers, setPopularServers] = useState<McpServer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("browse");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [serverList, popularList, categoryList] = await Promise.all([
          api.invoke<McpServer[]>("search_mcp_servers", { query: searchQuery }),
          api.invoke<McpServer[]>("get_popular_mcp_servers", { limit: 6 }),
          api.invoke<string[]>("get_mcp_categories")
        ]);
        setServers(serverList);
        setPopularServers(popularList);
        setCategories(categoryList);
      } catch (err) {
        console.error("Failed to fetch MCP data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchQuery]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      filesystem: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      development: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      database: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      search: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      ai: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      productivity: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      communication: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      media: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  const filteredServers = servers.filter(server => 
    selectedCategory === "all" || server.category === selectedCategory
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderServerCard = (server: McpServer) => (
    <Card key={server.name} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {server.name}
              {server.language && (
                <Badge variant="outline" className="text-xs">
                  {server.language}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">{server.description}</CardDescription>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-3 w-3" />
            {server.stars}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge className={getCategoryColor(server.category)}>
              {server.category}
            </Badge>
            <div className="flex gap-1">
              {server.repository && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(server.repository, "_blank")}
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  Repo
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(server.url, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            </div>
          </div>
          
          {server.tags && server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {server.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {server.install_command && (
            <div className="bg-muted p-2 rounded text-sm font-mono">
              <div className="flex items-center justify-between">
                <span className="truncate">{server.install_command}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(server.install_command!)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
              <h1 className="text-3xl font-semibold tracking-tight">MCP Server Browser</h1>
              <p className="text-muted-foreground">Discover and explore Model Context Protocol servers</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse">Browse Servers</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
            </TabsList>
            
            <TabsContent value="browse" className="space-y-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search MCP servers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <p>Loading MCP servers...</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredServers.map(renderServerCard)}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="popular" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Most Popular MCP Servers</h3>
                {loading ? (
                  <p>Loading popular servers...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {popularServers.map(renderServerCard)}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
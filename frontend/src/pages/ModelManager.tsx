import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Search, RefreshCw, Download, CheckCircle, XCircle, Cpu, Zap, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ModelInfo, ModelSource } from "../lib/webApi";

export default function ModelManagerPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<Record<string, ModelInfo[]>>({});
  const [sources, setSources] = useState<ModelSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [modelData, sourceData] = await Promise.all([
        api.invoke<Record<string, ModelInfo[]>>("auto_discover_models"),
        api.invoke<ModelSource[]>("get_model_sources")
      ]);
      setModels(modelData);
      setSources(sourceData);
    } catch (err) {
      console.error("Failed to fetch model data:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshModels = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return <Globe className="h-4 w-4" />;
      case 'ollama':
        return <Cpu className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getCapabilityColor = (capability: string) => {
    const colors: Record<string, string> = {
      text: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      vision: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      code: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      audio: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[capability] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  const filteredModels = Object.entries(models).reduce((acc, [provider, modelList]) => {
    const filtered = modelList.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[provider] = filtered;
    }
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const renderModelCard = (model: ModelInfo) => (
    <Card key={model.name} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getProviderIcon(model.provider)}
              {model.name}
              {model.is_available ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </CardTitle>
            <CardDescription className="mt-1">{model.description}</CardDescription>
          </div>
          <Badge variant={model.is_available ? "default" : "secondary"}>
            {model.provider}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {model.context_length && (
            <div className="text-sm text-muted-foreground">
              Context Length: {model.context_length.toLocaleString()} tokens
            </div>
          )}
          
          <div className="flex flex-wrap gap-1">
            {model.capabilities.map(capability => (
              <Badge key={capability} className={getCapabilityColor(capability)} variant="secondary">
                {capability}
              </Badge>
            ))}
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Status: {model.is_available ? "Available" : "Not Available"}
            </span>
            {!model.is_available && (
              <Button variant="outline" size="sm">
                <Download className="h-3 w-3 mr-1" />
                Install
              </Button>
            )}
          </div>
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
              <h1 className="text-3xl font-semibold tracking-tight">Model Manager</h1>
              <p className="text-muted-foreground">Discover and manage AI models from various sources</p>
            </div>
            <Button onClick={refreshModels} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Tabs defaultValue="models" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="models">Available Models</TabsTrigger>
              <TabsTrigger value="sources">Model Sources</TabsTrigger>
            </TabsList>
            
            <TabsContent value="models" className="space-y-6">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <p>Loading models...</p>
              ) : (
                <div className="space-y-8">
                  {Object.entries(filteredModels).map(([provider, modelList]) => (
                    <div key={provider}>
                      <h3 className="text-xl font-semibold mb-4 capitalize flex items-center gap-2">
                        {getProviderIcon(provider)}
                        {provider} Models ({modelList.length})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {modelList.map(renderModelCard)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="sources" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Model Sources & Providers</h3>
                {loading ? (
                  <p>Loading sources...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sources.map((source) => (
                      <Card key={source.name} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {getProviderIcon(source.name)}
                            {source.name}
                          </CardTitle>
                          <CardDescription>
                            {source.api_key_required ? "API Key Required" : "No API Key Required"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center">
                            <Badge variant={source.api_key_required ? "destructive" : "default"}>
                              {source.api_key_required ? "Paid" : "Free"}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(source.url, "_blank")}
                            >
                              Visit Site
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
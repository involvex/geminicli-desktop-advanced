import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ArrowLeft, Folder, File, Home, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface FileEntry {
  name: string;
  is_directory: boolean;
  full_path: string;
  size?: number;
  modified?: number;
}

export default function FileBrowserPage() {
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const entries = await api.invoke<FileEntry[]>("list_directory_contents", { path });
      setFiles(entries);
      setCurrentPath(path);
    } catch (error) {
      console.error("Failed to load directory:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadHome = useCallback(async () => {
    try {
      const homePath = await api.invoke<string>("get_home_directory");
      loadDirectory(homePath);
    } catch (error) {
      console.error("Failed to get home directory:", error);
    }
  }, []);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const navigateToPath = (path: string) => {
    setPathHistory(prev => [...prev, currentPath]);
    loadDirectory(path);
  };

  const navigateBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      loadDirectory(previousPath);
    }
  };

  const navigateUp = async () => {
    try {
      const parentPath = await api.invoke<string | null>("get_parent_directory", { path: currentPath });
      if (parentPath) {
        navigateToPath(parentPath);
      }
    } catch (error) {
      console.error("Failed to get parent directory:", error);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "";
    return new Date(timestamp * 1000).toLocaleDateString();
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
            <h1 className="text-3xl font-semibold tracking-tight">File Browser</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={navigateBack} disabled={pathHistory.length === 0}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateUp}>
                Up
              </Button>
              <Button variant="outline" size="sm" onClick={loadHome}>
                <Home className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Path Breadcrumb */}
          <div className="mb-4">
            <Input value={currentPath} onChange={(e) => setCurrentPath(e.target.value)} className="font-mono text-sm" />
          </div>

          {/* File List */}
          <Card>
            <CardHeader>
              <CardTitle>Contents</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.full_path}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => file.is_directory && navigateToPath(file.full_path)}
                    >
                      {file.is_directory ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="flex-1 font-mono text-sm">{file.name}</span>
                      {!file.is_directory && (
                        <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(file.modified)}</span>
                      {file.is_directory && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  ))}
                  {files.length === 0 && !loading && (
                    <p className="text-muted-foreground text-center py-8">Directory is empty</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
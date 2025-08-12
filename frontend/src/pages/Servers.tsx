import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Plus, Server as ServerIcon, Trash2, Pencil } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { ServerStatusIndicator } from "../components/servers/ServerStatusIndicator";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Server } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function ServersPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newServer, setNewServer] = useState({
    name: "",
    port: 8080,
    model: "gemini-2.5-flash",
    working_directory: "",
  });
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [startingServerId, setStartingServerId] = useState<string | null>(null);
  const [stoppingServerId, setStoppingServerId] = useState<string | null>(null);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const serverList = await api.invoke<Server[]>("list_servers");
        setServers(serverList);
      } catch (err) {
        setError("Failed to load servers.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchServers();
  }, []);

  const handleAddServer = async () => {
    try {
      const updatedServers = await api.invoke<Server[]>("add_server", {
        ...newServer,
      });
      setServers(updatedServers);
      setIsAddDialogOpen(false);
      setNewServer({
        name: "",
        port: 8080,
        model: "gemini-2.5-flash",
        working_directory: "",
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to add server: ${errorMessage}`);
      console.error("Error adding server:", err);
    }
  };

  const handleEditClick = (server: Server) => {
    setEditingServer({ ...server });
    setIsAddDialogOpen(true);
  };

  const handleEditServer = async () => {
    if (!editingServer) return;
    try {
      const updatedServers = await api.invoke<Server[]>("edit_server", {
        ...editingServer,
      });
      setServers(updatedServers);
      setEditingServer(null);
      setIsAddDialogOpen(false);
    } catch (err) {
      setError("Failed to update server.");
      console.error(err);
    }
  };

  const handleDeleteServer = async () => {
    if (!deletingServerId) return;
    try {
      const updatedServers = await api.invoke<Server[]>("delete_server", {
        id: deletingServerId,
      });
      setServers(updatedServers);
      setDeletingServerId(null);
    } catch (err) {
      setError("Failed to delete server.");
      console.error(err);
    }
  };

  const handleStartServer = async (id: string) => {
    setStartingServerId(id);
    try {
      const updatedServers = await api.invoke<Server[]>("start_server", { id });
      setServers(updatedServers);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to start server: ${errorMessage}`);
      console.error(err);
    } finally {
      setStartingServerId(null);
    }
  };

  const handleStopServer = async (id: string) => {
    setStoppingServerId(id);
    try {
      const updatedServers = await api.invoke<Server[]>("stop_server", { id });
      setServers(updatedServers);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to stop server: ${errorMessage}`);
      console.error(err);
    } finally {
      setStoppingServerId(null);
    }
  };

  const handleRestartServer = async (id: string) => {
    await handleStopServer(id);
    setTimeout(() => handleStartServer(id), 1000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
            aria-label="Back to Home"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            <span>Back to Home</span>
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight">
              ACP Servers
            </h1>
            <Dialog
              open={isAddDialogOpen || !!editingServer}
              onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) setEditingServer(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingServer ? "Edit ACP Server" : "Add New ACP Server"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingServer
                      ? "Edit the details for this server configuration."
                      : "Enter the details for the new server configuration."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={
                        editingServer ? editingServer.name : newServer.name
                      }
                      onChange={(e) => {
                        if (editingServer) {
                          setEditingServer({
                            ...editingServer,
                            name: e.target.value,
                          });
                        } else {
                          setNewServer({ ...newServer, name: e.target.value });
                        }
                      }}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="port" className="text-right">
                      Port
                    </Label>
                    <Input
                      id="port"
                      type="number"
                      value={
                        editingServer ? editingServer.port : newServer.port
                      }
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (editingServer) {
                          setEditingServer({ ...editingServer, port: value });
                        } else {
                          setNewServer({ ...newServer, port: value });
                        }
                      }}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="model" className="text-right">
                      Model
                    </Label>
                    <Input
                      id="model"
                      value={
                        editingServer ? editingServer.model : newServer.model
                      }
                      onChange={(e) => {
                        if (editingServer) {
                          setEditingServer({
                            ...editingServer,
                            model: e.target.value,
                          });
                        } else {
                          setNewServer({ ...newServer, model: e.target.value });
                        }
                      }}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="working_directory" className="text-right">
                      Working Directory
                    </Label>
                    <Input
                      id="working_directory"
                      value={
                        editingServer
                          ? editingServer.working_directory
                          : newServer.working_directory
                      }
                      onChange={(e) => {
                        if (editingServer) {
                          setEditingServer({
                            ...editingServer,
                            working_directory: e.target.value,
                          });
                        } else {
                          setNewServer({
                            ...newServer,
                            working_directory: e.target.value,
                          });
                        }
                      }}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={editingServer ? handleEditServer : handleAddServer}
                  >
                    {editingServer ? "Save Changes" : "Add Server"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
              open={!!deletingServerId}
              onOpenChange={(open) => {
                if (!open) setDeletingServerId(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Deletion</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this server configuration?
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeletingServerId(null)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteServer}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="mt-2 text-muted-foreground">
            Manage your Agent Communication Protocol (ACP) server
            configurations.
          </p>

          <div className="mt-6">
            {loading ? (
              <p>Loading servers...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : servers.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No Servers Found</CardTitle>
                  <CardDescription>
                    You have not configured any ACP servers yet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first server
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {servers.map((server) => (
                  <Card key={server.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ServerIcon className="h-6 w-6 text-muted-foreground" />
                          <div>
                            <CardTitle>{server.name}</CardTitle>
                            <CardDescription>
                              {server.working_directory} - Port: {server.port}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ServerStatusIndicator
                            server={server}
                            onStart={handleStartServer}
                            onStop={handleStopServer}
                            onRestart={handleRestartServer}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(server)}
                            disabled={startingServerId === server.id || stoppingServerId === server.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Dialog
                            open={deletingServerId === server.id}
                            onOpenChange={(open) => {
                              if (!open) setDeletingServerId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingServerId(server.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Confirm Deletion</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to delete server "
                                  {server.name}"? This action cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setDeletingServerId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleDeleteServer}
                                >
                                  Delete
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

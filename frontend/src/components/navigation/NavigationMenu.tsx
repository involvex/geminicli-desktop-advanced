import { useState } from "react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Menu, Home, MessageSquare, Server, Puzzle, Terminal, Settings, Folder, FolderPlus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const menuItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/chat", icon: MessageSquare, label: "CLI Chat" },
  { path: "/servers", icon: Server, label: "ACP Servers" },
  { path: "/extensions", icon: Puzzle, label: "Extensions" },
  { path: "/command-builder", icon: Terminal, label: "Command Builder" },
  { path: "/project-builder", icon: FolderPlus, label: "Project Builder" },
  { path: "/files", icon: Folder, label: "File Browser" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function NavigationMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <div className="flex flex-col gap-2 mt-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "default" : "ghost"}
                className="justify-start"
                onClick={() => handleNavigate(item.path)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
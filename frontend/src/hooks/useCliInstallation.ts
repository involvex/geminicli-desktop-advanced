import { useState, useEffect } from "react";
import { api } from "../lib/api";

export const useCliInstallation = () => {
  const [isCliInstalled, setIsCliInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const checkCliInstallation = async () => {
      try {
        const installed = await api.invoke<boolean>("check_cli_installed");
        setIsCliInstalled(installed);
      } catch (error) {
        console.error("Failed to check CLI installation:", error);
        setIsCliInstalled(false);
      }
    };

    checkCliInstallation();
  }, []);

  return isCliInstalled;
};

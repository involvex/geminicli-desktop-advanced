import React from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircleIcon, AlertTriangle } from "lucide-react";

interface CliWarningsProps {
  selectedModel: string;
  isCliInstalled: boolean | null;
}

export const CliWarnings: React.FC<CliWarningsProps> = ({
  selectedModel,
  isCliInstalled,
}) => {
  return (
    <>
      {selectedModel === "gemini-2.5-flash-lite" && (
        <div className="p-4">
          <Alert className="bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700">
            <AlertTriangle className="!text-yellow-500 dark:!text-yellow-300" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-300">
              Model unavailable
            </AlertTitle>
            <AlertDescription className="text-yellow-800 dark:text-yellow-300">
              <p>
                Unfortunately, Gemini 2.5 Flash-Lite isn't usable, due to
                thinking issues. See here for more details:{" "}
                <a
                  href="https://github.com/google-gemini/gemini-cli/issues/1953"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #1953
                </a>{" "}
                and{" "}
                <a
                  href="https://github.com/google-gemini/gemini-cli/issues/4548"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #4548
                </a>
                . Waiting on PR{" "}
                <a
                  href="https://github.com/google-gemini/gemini-cli/pull/3033"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #3033
                </a>
                /
                <a
                  href="https://github.com/google-gemini/gemini-cli/pull/4652"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #4652
                </a>
                .
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isCliInstalled === false && (
        <div className="p-4">
          <Alert
            variant="destructive"
            className="bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700 text-red-300"
          >
            <AlertCircleIcon />
            <AlertTitle>Gemini CLI not found</AlertTitle>
            <AlertDescription className="dark:text-red-300">
              <p>
                <span>
                  Please install the Gemini CLI and make sure it's available in
                  your PATH. You can install it from{" "}
                </span>
                <a
                  href="https://github.com/google-gemini/gemini-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  the official repository
                </a>
                .
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};

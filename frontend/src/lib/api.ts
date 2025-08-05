import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { webApi, webListen } from "./webApi";

declare global {
  interface Window {
    pendingToolCallInput?: string;
  }
}

// Abstraction layer for API calls
export const api = {
  async invoke<T>(command: string, args?: any): Promise<T> {
    if (__WEB__) {
      switch (command) {
        case "check_cli_installed":
          return webApi.check_cli_installed() as Promise<T>;
        case "send_message":
          return webApi.send_message(args) as Promise<T>;
        case "get_process_statuses":
          return webApi.get_process_statuses() as Promise<T>;
        case "kill_process":
          return webApi.kill_process(args) as Promise<T>;
        case "send_tool_call_confirmation_response":
          return webApi.send_tool_call_confirmation_response(
            args
          ) as Promise<T>;
        case "execute_confirmed_command":
          return webApi.execute_confirmed_command(args) as Promise<T>;
        case "generate_conversation_title":
          return webApi.generate_conversation_title(args) as Promise<T>;
        case "validate_directory":
          return webApi.validate_directory(args) as Promise<T>;
        case "is_home_directory":
          return webApi.is_home_directory(args) as Promise<T>;
        case "list_projects":
          return webApi.list_projects(args) as Promise<T>;
        case "get_project_discussions":
          return webApi.get_project_discussions(args) as Promise<T>;
        case "list_enriched_projects":
          return webApi.list_projects_enriched() as Promise<T>;
        case "start_session":
          return webApi.start_session(args.sessionId, args.workingDirectory, args.model) as Promise<T>;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } else {
      return invoke<T>(command, args);
    }
  },

  async listen<T>(
    event: string,
    callback: (event: { payload: T }) => void
  ): Promise<() => void> {
    if (__WEB__) {
      return webListen<T>(event, callback);
    } else {
      return listen<T>(event, callback);
    }
  },
};
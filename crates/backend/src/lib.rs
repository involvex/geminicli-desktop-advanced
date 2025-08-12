// Module declarations
pub mod cli;
pub mod events;
pub mod filesystem;
pub mod projects;
pub mod rpc;
pub mod search;
pub mod security;
pub mod session;
pub mod types;

pub mod servers;

// Test utilities (only available in test builds)
#[cfg(test)]
pub mod test_utils;

// Re-exports
pub use cli::{
    AssistantChunk, CommandResult, MessageChunk, PushToolCallParams, PushToolCallResult,
    RequestToolCallConfirmationParams, RequestToolCallConfirmationResult, SendUserMessageParams,
    StreamAssistantMessageChunkParams, UpdateToolCallParams,
};
pub use events::{
    CliIoPayload, CliIoType, ErrorPayload, EventEmitter, GeminiOutputPayload, GeminiThoughtPayload,
    InternalEvent, ToolCallConfirmation, ToolCallConfirmationContent, ToolCallConfirmationRequest,
    ToolCallEvent, ToolCallLocation, ToolCallUpdate,
};
pub use filesystem::{DirEntry, VolumeType};
pub use projects::{
    EnrichedProject, ProjectListItem, ProjectMetadata, ProjectMetadataView, ProjectsResponse,
    TouchThrottle, ensure_project_metadata, list_enriched_projects, list_projects,
    make_enriched_project, maybe_touch_updated_at,
};
pub use rpc::{JsonRpcError, JsonRpcRequest, JsonRpcResponse, RpcLogger};
pub use search::{MessageMatch, RecentChat, SearchFilters, SearchResult};
pub use security::{execute_terminal_command, is_command_safe};
pub use servers::{
    Server, add_server, delete_server, edit_server, list_servers, start_server, stop_server,
};
pub use session::{PersistentSession, ProcessStatus, SessionManager, initialize_session};
pub use types::{BackendError, BackendResult};

// Standard library imports
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::process::Command;

/// Main backend interface for Gemini CLI functionality
pub struct GeminiBackend<E: EventEmitter> {
    emitter: E,
    session_manager: SessionManager,
    next_request_id: Arc<Mutex<u32>>,
    touch_throttle: TouchThrottle,
}

impl<E: EventEmitter + 'static> GeminiBackend<E> {
    /// Create a new GeminiBackend instance
    pub fn new(emitter: E) -> Self {
        Self {
            emitter,
            session_manager: SessionManager::new(),
            next_request_id: Arc::new(Mutex::new(1000)),
            touch_throttle: TouchThrottle::new(Duration::from_secs(60)),
        }
    }

    // =====================================
    // Event Helper Methods
    // =====================================

    /// Emit CLI I/O event
    pub fn emit_cli_io(
        &self,
        session_id: &str,
        io_type: CliIoType,
        data: &str,
    ) -> BackendResult<()> {
        let payload = CliIoPayload {
            io_type,
            data: data.to_string(),
        };
        self.emitter.emit(&format!("cli-io-{session_id}"), payload)
    }

    /// Emit Gemini output event
    pub fn emit_gemini_output(&self, session_id: &str, text: &str) -> BackendResult<()> {
        let payload = GeminiOutputPayload {
            text: text.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-output-{session_id}"), payload)
    }

    /// Emit Gemini thought event
    pub fn emit_gemini_thought(&self, session_id: &str, thought: &str) -> BackendResult<()> {
        let payload = GeminiThoughtPayload {
            thought: thought.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-thought-{session_id}"), payload)
    }

    /// Emit tool call event
    pub fn emit_tool_call(&self, session_id: &str, tool_call: &ToolCallEvent) -> BackendResult<()> {
        self.emitter
            .emit(&format!("gemini-tool-call-{session_id}"), tool_call.clone())
    }

    /// Emit tool call update event
    pub fn emit_tool_call_update(
        &self,
        session_id: &str,
        update: &ToolCallUpdate,
    ) -> BackendResult<()> {
        self.emitter.emit(
            &format!("gemini-tool-call-update-{session_id}"),
            update.clone(),
        )
    }

    /// Emit tool call confirmation event
    pub fn emit_tool_call_confirmation(
        &self,
        session_id: &str,
        confirmation: &ToolCallConfirmationRequest,
    ) -> BackendResult<()> {
        self.emitter.emit(
            &format!("gemini-tool-call-confirmation-{session_id}"),
            confirmation.clone(),
        )
    }

    /// Emit error event
    pub fn emit_error(&self, session_id: &str, error: &str) -> BackendResult<()> {
        let payload = ErrorPayload {
            error: error.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-error-{session_id}"), payload)
    }

    /// Emit command result event
    pub fn emit_command_result(&self, result: &CommandResult) -> BackendResult<()> {
        self.emitter.emit("command-result", result.clone())
    }

    /// Check if Gemini CLI is installed and available
    pub async fn check_cli_installed(&self) -> BackendResult<bool> {
        let result = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--version"])
                .output()
                .await
        } else {
            Command::new("sh")
                .args(["-c", "gemini --version"])
                .output()
                .await
        };

        match result {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    }

    /// Initialize a new Gemini CLI session
    pub async fn initialize_session(
        &self,
        session_id: String,
        working_directory: String,
        model: String,
    ) -> BackendResult<()> {
        {
            let processes = self.session_manager.get_processes();
            if let Ok(guard) = processes.lock()
                && let Some(existing) = guard.get(&session_id)
                && existing.is_alive
            {
                return Ok(());
            }
        }

        let (_message_tx, _rpc_logger) = initialize_session(
            session_id,
            working_directory,
            model,
            self.emitter.clone(),
            &self.session_manager,
        )
        .await?;
        Ok(())
    }

    /// Send a message to an existing session
    pub async fn send_message(
        &self,
        session_id: String,
        message: String,
        conversation_history: String,
    ) -> BackendResult<()> {
        println!("📤 Sending message to session: {session_id}");

        let message_sender = {
            let processes = self.session_manager.get_processes();
            let processes = processes.lock().map_err(|_| {
                BackendError::SessionInitFailed("Failed to lock processes".to_string())
            })?;
            processes
                .get(&session_id)
                .map_or_else(|| None, |session| session.message_sender.clone())
        };

        let message_sender = if let Some(sender) = message_sender {
            sender
        } else {
            return Err(BackendError::SessionNotFound(session_id));
        };

        let mut chunks = vec![MessageChunk::Text { text: message }];

        if !conversation_history.is_empty() {
            chunks.insert(
                0,
                MessageChunk::Text {
                    text: format!("Previous conversation context:\n{conversation_history}\n\n"),
                },
            );
        }
        let msg_params = SendUserMessageParams { chunks };

        let request_id = {
            let mut id_guard = self.next_request_id.lock().unwrap();
            let id = *id_guard;
            *id_guard += 1;
            id
        };

        let msg_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: request_id,
            method: "sendUserMessage".to_string(),
            params: serde_json::to_value(msg_params)
                .map_err(|e| BackendError::JsonError(e.to_string()))?,
        };

        let request_json = serde_json::to_string(&msg_request)
            .map_err(|e| BackendError::JsonError(e.to_string()))?;

        message_sender
            .send(request_json)
            .map_err(|_| BackendError::ChannelError)?;

        println!("✅ Message sent to persistent session: {session_id}");
        Ok(())
    }

    /// Handle tool call confirmation response
    pub async fn handle_tool_confirmation(
        &self,
        session_id: String,
        request_id: u32,
        tool_call_id: String,
        outcome: String,
    ) -> BackendResult<()> {
        println!(
            "📤 Sending tool call confirmation response: session={session_id}, request_id={request_id}, tool_call_id={tool_call_id}, outcome={outcome}"
        );

        let response_data = RequestToolCallConfirmationResult {
            id: tool_call_id.clone(),
            outcome,
        };

        session::send_response_to_cli(
            &session_id,
            request_id,
            Some(
                serde_json::to_value(response_data)
                    .map_err(|e| BackendError::JsonError(e.to_string()))?,
            ),
            None,
            self.session_manager.get_processes(),
        )
        .await;

        match tool_call_id.parse::<u32>() {
            Ok(tool_call_id_num) => {
                let update = ToolCallUpdate {
                    tool_call_id: tool_call_id_num,
                    status: "completed".to_string(),
                    content: Some(serde_json::json!({
                        "markdown": "Tool call completed after user confirmation"
                    })),
                };
                let _ = self.emit_tool_call_update(&session_id, &update);
            }
            Err(e) => {
                eprintln!("Failed to parse tool_call_id '{tool_call_id}' as u32: {e}");
            }
        }

        Ok(())
    }

    /// Execute a confirmed command
    pub async fn execute_confirmed_command(&self, command: String) -> BackendResult<String> {
        println!("🖥️ Executing confirmed command: {command}");

        match execute_terminal_command(&command).await {
            Ok(output) => {
                println!("✅ Command executed successfully");

                let _ = self.emit_command_result(&CommandResult {
                    command: command.clone(),
                    success: true,
                    output: Some(output.clone()),
                    error: None,
                });

                Ok(output)
            }
            Err(error) => {
                println!("❌ Command execution failed: {error}");

                let _ = self.emit_command_result(&CommandResult {
                    command: command.clone(),
                    success: false,
                    output: None,
                    error: Some(error.to_string()),
                });

                Err(error)
            }
        }
    }

    /// Generate a conversation title
    pub async fn generate_conversation_title(
        &self,
        message: String,
        model: Option<String>,
    ) -> BackendResult<String> {
        let prompt = format!(
            "Generate a short, concise title (3-6 words) for a conversation that starts with this user message: \"{}\". Only return the title, nothing else.",
            message.chars().take(200).collect::<String>()
        );

        let model_to_use = model.unwrap_or_else(|| "gemini-2.5-flash".to_string());

        let mut child = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| BackendError::CommandExecutionFailed(e.to_string()))?
        } else {
            Command::new("gemini")
                .args(["--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| BackendError::CommandExecutionFailed(e.to_string()))?
        };

        if let Some(stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let mut stdin = stdin;
            stdin
                .write_all(prompt.as_bytes())
                .await
                .map_err(BackendError::IoError)?;
            stdin.shutdown().await.map_err(BackendError::IoError)?;
        }

        let output = child
            .wait_with_output()
            .await
            .map_err(|e| BackendError::CommandExecutionFailed(e.to_string()))?;

        if !output.status.success() {
            let error_msg = format!(
                "Gemini CLI failed with exit code {:?}: {}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr)
            );
            return Err(BackendError::CommandExecutionFailed(error_msg));
        }

        let raw_output = String::from_utf8_lossy(&output.stdout);

        let title = raw_output
            .trim()
            .lines()
            .last()
            .unwrap_or("New Conversation")
            .trim_matches('"')
            .trim()
            .to_string();

        let final_title = if title.is_empty() || title.len() > 50 {
            message.chars().take(30).collect::<String>()
        } else {
            title
        };

        Ok(final_title)
    }

    /// Get all process statuses
    pub fn get_process_statuses(&self) -> BackendResult<Vec<ProcessStatus>> {
        self.session_manager.get_process_statuses()
    }

    /// Kill a process by conversation ID
    pub fn kill_process(&self, conversation_id: &str) -> BackendResult<()> {
        self.session_manager.kill_process(conversation_id)
    }

    /// Validate if a directory exists and is accessible
    pub async fn validate_directory(&self, path: String) -> BackendResult<bool> {
        filesystem::validate_directory(path).await
    }

    /// Check if the given path is the user's home directory
    pub async fn is_home_directory(&self, path: String) -> BackendResult<bool> {
        filesystem::is_home_directory(path).await
    }

    /// Get the user's home directory path
    pub async fn get_home_directory(&self) -> BackendResult<String> {
        filesystem::get_home_directory().await
    }

    /// Get the parent directory of the given path
    pub async fn get_parent_directory(&self, path: String) -> BackendResult<Option<String>> {
        filesystem::get_parent_directory(path).await
    }

    /// List available volumes/drives on the system
    pub async fn list_volumes(&self) -> BackendResult<Vec<DirEntry>> {
        filesystem::list_volumes().await
    }

    /// List the contents of a directory
    pub async fn list_directory_contents(&self, path: String) -> BackendResult<Vec<DirEntry>> {
        filesystem::list_directory_contents(path).await
    }

    /// Get recent chats
    pub async fn get_recent_chats(&self) -> BackendResult<Vec<RecentChat>> {
        search::get_recent_chats().await
    }

    /// Search across all chat logs
    pub async fn search_chats(
        &self,
        query: String,
        filters: Option<SearchFilters>,
    ) -> BackendResult<Vec<SearchResult>> {
        search::search_chats(query, filters).await
    }

    /// List projects
    pub async fn list_projects(&self, limit: u32, offset: u32) -> BackendResult<ProjectsResponse> {
        let lim = std::cmp::min(limit.max(1), 100);
        list_projects(lim, offset)
    }

    /// Return enriched projects
    pub async fn list_enriched_projects(&self) -> BackendResult<Vec<EnrichedProject>> {
        list_enriched_projects()
    }

    /// Get an enriched project for a given sha256
    pub async fn get_enriched_project(
        &self,
        sha256: String,
        external_root_path: String,
    ) -> BackendResult<EnrichedProject> {
        let external = Path::new(&external_root_path);
        ensure_project_metadata(&sha256, Some(external))?;
        let _ = maybe_touch_updated_at(&sha256, &self.touch_throttle);
        Ok(make_enriched_project(&sha256, Some(external), false))
    }

    /// Get discussions for a specific project
    pub async fn get_project_discussions(
        &self,
        project_id: &str,
    ) -> BackendResult<Vec<RecentChat>> {
        search::get_project_discussions(project_id).await
    }
}

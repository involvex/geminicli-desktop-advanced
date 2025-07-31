use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use thiserror::Error;
use tokio::process::{Command, ChildStdin, ChildStdout};
use tokio::sync::mpsc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use std::process::Stdio;

// =====================================
// Internal Event Communication System
// =====================================

/// Internal events that need to be forwarded to the frontend
#[derive(Debug, Clone)]
pub enum InternalEvent {
    CliIo { session_id: String, payload: CliIoPayload },
    GeminiOutput { session_id: String, payload: GeminiOutputPayload },
    GeminiThought { session_id: String, payload: GeminiThoughtPayload },
    ToolCall { session_id: String, payload: ToolCallEvent },
    ToolCallUpdate { session_id: String, payload: ToolCallUpdate },
    ToolCallConfirmation { session_id: String, payload: ToolCallConfirmationRequest },
    Error { session_id: String, payload: ErrorPayload },
    ResponseComplete { session_id: String, payload: ResponseCompletePayload },
}

// =====================================
// Generic Event System
// =====================================

/// Generic event emitter trait that abstracts away frontend-specific event systems
pub trait EventEmitter: Send + Sync + Clone {
    /// Emit a generic event with payload
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> BackendResult<()>;
}

/// CLI I/O event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliIoPayload {
    #[serde(rename = "type")]
    pub io_type: CliIoType,
    pub data: String,
}

/// CLI I/O event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CliIoType {
    Input,
    Output,
}

/// Gemini text output payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiOutputPayload {
    pub text: String,
}

/// Gemini thought payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiThoughtPayload {
    pub thought: String,
}

/// Error event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub error: String,
}

/// Response complete payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseCompletePayload {
    pub completed: bool,
}

/// Tool call event data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallEvent {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
    pub status: String,
}

/// Tool call update data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallUpdate {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: u32,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

/// Tool call confirmation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmationRequest {
    pub request_id: u32,
    pub session_id: String,
    pub label: String,
    pub icon: String,
    pub content: Option<ToolCallConfirmationContent>,
    pub confirmation: ToolCallConfirmation,
    pub locations: Vec<ToolCallLocation>,
}

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub command: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

// =====================================
// JSON-RPC Protocol Types
// =====================================

/// JSON-RPC 2.0 request structure  
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u32,
    pub method: String,
    pub params: serde_json::Value,
}

/// JSON-RPC 2.0 response structure
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u32,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC 2.0 error structure
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

// =====================================
// Gemini CLI Protocol Types  
// =====================================

/// Parameters for sending user message to Gemini CLI
#[derive(Debug, Serialize, Deserialize)]
pub struct SendUserMessageParams {
    pub chunks: Vec<MessageChunk>,
}

/// Message chunk - can be text or file path
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageChunk {
    Text { text: String },
    Path { path: String },
}

/// Parameters for streaming assistant message chunks
#[derive(Debug, Serialize, Deserialize)]
pub struct StreamAssistantMessageChunkParams {
    pub chunk: AssistantChunk,
}

/// Assistant response chunk containing thought and/or text
#[derive(Debug, Serialize, Deserialize)]
pub struct AssistantChunk {
    pub thought: Option<String>,
    pub text: Option<String>,
}

/// Parameters for pushing tool call information
#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallParams {
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
}

/// Result returned when pushing a tool call
#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallResult {
    pub id: u32,
}

/// Parameters for updating tool call status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateToolCallParams {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: u32,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

/// Parameters for requesting tool call confirmation
#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationParams {
    pub label: String,
    pub icon: String,
    pub content: Option<ToolCallConfirmationContent>,
    pub confirmation: ToolCallConfirmation,
    pub locations: Vec<ToolCallLocation>,
}

/// Result returned from tool call confirmation
#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationResult {
    pub id: String,
    pub outcome: String,
}

// =====================================
// Core Types (extracted from Tauri app)
// =====================================

/// Tool call location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallLocation {
    pub path: String,
}

/// Tool call confirmation content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmationContent {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(rename = "oldText", default)]
    pub old_text: Option<String>,
    #[serde(rename = "newText", default)]
    pub new_text: Option<String>,
}

/// Tool call confirmation details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmation {
    #[serde(rename = "type")]
    pub confirmation_type: String,
    #[serde(rename = "rootCommand", default)]
    pub root_command: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
}

// =====================================
// Security Functions
// =====================================

/// Check if a command is safe to execute by validating against dangerous patterns
/// and ensuring it starts with a known safe command
#[allow(clippy::too_many_lines)]
pub fn is_command_safe(command: &str) -> bool {
    let dangerous_patterns = [
        "rm ",
        "del ",
        "format",
        "mkfs",
        "dd if=",
        "sudo rm",
        "sudo del",
        "> /dev/",
        "curl ",
        "wget ",
        "powershell",
        "cmd /c del",
        "cmd /c rd",
        "shutdown",
        "reboot",
        "halt",
        "init 0",
        "systemctl",
        "service ",
        "apt-get remove",
        "yum remove",
        "dnf remove",
        "brew uninstall",
        "npm uninstall -g",
        "pip uninstall",
        "cargo uninstall",
        "chmod 777",
        "chown ",
        "passwd",
        "su ",
        "sudo su",
        "export PATH=",
        "set PATH=",
        "alias rm=",
        "alias del=",
        "eval ",
        "exec ",
        "`",
        "$(",
        "${",
        "||",
        "&&",
        "; rm",
        "; del",
        "; sudo",
        "; curl",
        "; wget",
        "| rm",
        "| del",
        "| sudo",
        "| curl",
        "| wget",
    ];

    let command_lower = command.to_lowercase();
    for pattern in &dangerous_patterns {
        if command_lower.contains(pattern) {
            return false;
        }
    }

    // Allow common safe commands
    let safe_commands = [
        "echo",
        "cat",
        "ls",
        "dir",
        "pwd",
        "whoami",
        "date",
        "time",
        "python",
        "node",
        "npm",
        "cargo",
        "git",
        "rustc",
        "gcc",
        "clang",
        "java",
        "javac",
        "go",
        "php",
        "ruby",
        "perl",
        "make",
        "cmake",
        "grep",
        "find",
        "sort",
        "head",
        "tail",
        "wc",
        "awk",
        "sed",
        "ping",
        "nslookup",
        "dig",
        "ps",
        "top",
        "htop",
        "df",
        "du",
        "uname",
        "which",
        "where",
        "type",
        "help",
        "man",
        "--help",
        "--version",
    ];

    let first_word = command_lower.split_whitespace().next().unwrap_or("");
    safe_commands
        .iter()
        .any(|&safe_cmd| first_word.starts_with(safe_cmd))
}

/// Execute a terminal command safely after validation
pub async fn execute_terminal_command(command: &str) -> BackendResult<String> {
    if !is_command_safe(command) {
        return Err(BackendError::CommandNotAllowed);
    }

    println!("🖥️ Executing terminal command: {command}");

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", command]).output().await
    } else {
        Command::new("sh").args(["-c", command]).output().await
    };

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);

            if result.status.success() {
                Ok(format!(
                    "Exit code: {}\nOutput:\n{}",
                    result.status.code().unwrap_or(0),
                    stdout
                ))
            } else {
                Err(BackendError::CommandExecutionFailed(format!(
                    "Exit code: {}\nError:\n{}\nOutput:\n{}",
                    result.status.code().unwrap_or(-1),
                    stderr,
                    stdout
                )))
            }
        }
        Err(e) => Err(BackendError::CommandExecutionFailed(format!(
            "Failed to execute command: {e}"
        ))),
    }
}

// =====================================
// Session Management
// =====================================

/// Persistent CLI session state
pub struct PersistentSession {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
    pub stdin: Option<ChildStdin>,
    pub message_sender: Option<mpsc::UnboundedSender<String>>,
}

/// Public process status (serializable for external use)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessStatus {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
}

impl From<&PersistentSession> for ProcessStatus {
    fn from(session: &PersistentSession) -> Self {
        Self {
            conversation_id: session.conversation_id.clone(),
            pid: session.pid,
            created_at: session.created_at,
            is_alive: session.is_alive,
        }
    }
}

/// Type alias for the process map
pub type ProcessMap = Arc<Mutex<HashMap<String, PersistentSession>>>;

/// Session manager that handles all active CLI sessions
pub struct SessionManager {
    processes: ProcessMap,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get all process statuses
    pub fn get_process_statuses(&self) -> BackendResult<Vec<ProcessStatus>> {
        let processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;
        
        let statuses = processes
            .values()
            .map(ProcessStatus::from)
            .collect();
        
        Ok(statuses)
    }

    /// Kill a process by conversation ID
    pub fn kill_process(&self, conversation_id: &str) -> BackendResult<()> {
        let mut processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        if let Some(session) = processes.get_mut(conversation_id) {
            if let Some(pid) = session.pid {
                // Kill the process
                #[cfg(windows)]
                {
                    use std::process::Command as StdCommand;
                    let output = StdCommand::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/F"])
                        .output()
                        .map_err(|e| BackendError::CommandExecutionFailed(format!("Failed to kill process: {e}")))?;

                    if !output.status.success() {
                        return Err(BackendError::CommandExecutionFailed(format!(
                            "Failed to kill process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        )));
                    }
                }

                #[cfg(not(windows))]
                {
                    use std::process::Command as StdCommand;
                    let output = StdCommand::new("kill")
                        .args(["-9", &pid.to_string()])
                        .output()
                        .map_err(|e| BackendError::CommandExecutionFailed(format!("Failed to kill process: {e}")))?;

                    if !output.status.success() {
                        return Err(BackendError::CommandExecutionFailed(format!(
                            "Failed to kill process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        )));
                    }
                }
            }

            // Clean up session
            session.is_alive = false;
            session.pid = None;
            session.stdin = None;
            session.message_sender = None;
        }

        Ok(())
    }

    /// Get the process map (for internal use)
    pub(crate) fn get_processes(&self) -> &ProcessMap {
        &self.processes
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

// =====================================
// CLI Process Management & I/O Handling
// =====================================

/// Initialize a new persistent session with the Gemini CLI
pub async fn initialize_session<E: EventEmitter + 'static>(
    session_id: String,
    working_directory: Option<String>,
    model: String,
    emitter: E,
    session_manager: &SessionManager,
) -> BackendResult<mpsc::UnboundedSender<String>> {
    println!("🚀 Initializing persistent Gemini session for: {session_id}");

    // Create message channel for sending messages to this session
    let (message_tx, message_rx) = mpsc::unbounded_channel::<String>();

    // Spawn CLI process
    let mut child = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "gemini", "--model", &model, "--experimental-acp"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set working directory if provided
        if let Some(ref wd) = working_directory {
            println!("🗂️ Setting working directory to: {wd}");
            cmd.current_dir(wd);
        }

        cmd.spawn()
            .map_err(|e| BackendError::SessionInitFailed(format!("Failed to run gemini command via cmd: {e}")))?
    } else {
        let mut cmd = Command::new("sh");
        let gemini_command = format!("gemini --model {model} --experimental-acp");
        cmd.args(["-c", &gemini_command])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set working directory if provided
        if let Some(ref wd) = working_directory {
            println!("🗂️ Setting working directory to: {wd}");
            cmd.current_dir(wd);
        }

        cmd.spawn()
            .map_err(|e| BackendError::SessionInitFailed(format!("Failed to run gemini command via shell: {e}")))?
    };

    let pid = child.id();
    let mut stdin = child.stdin.take().ok_or(BackendError::SessionInitFailed("Failed to get stdin".to_string()))?;
    let stdout = child.stdout.take().ok_or(BackendError::SessionInitFailed("Failed to get stdout".to_string()))?;

    // Initialize the CLI session
    let init_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "initialize".to_string(),
        params: serde_json::json!({
            "protocolVersion": "0.0.9"
        }),
    };

    let request_json = serde_json::to_string(&init_request)
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to serialize init request: {e}")))?;

    // Send initialization
    stdin
        .write_all(request_json.as_bytes())
        .await
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to write init request: {e}")))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to write newline: {e}")))?;
    stdin
        .flush()
        .await
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to flush: {e}")))?;

    // Emit CLI input event
    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Input,
            data: request_json.clone(),
        },
    );

    // Read initialization response
    let mut reader = AsyncBufReader::new(stdout);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .await
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to read init response: {e}")))?;

    // Emit CLI output event
    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Output,
            data: line.trim().to_string(),
        },
    );

    // Parse initialization response
    match serde_json::from_str::<JsonRpcResponse>(&line) {
        Ok(response) => {
            if let Some(error) = &response.error {
                return Err(BackendError::SessionInitFailed(format!("Gemini CLI Error: {error:?}")));
            }
            println!("✅ Session initialized successfully for: {session_id}");
        }
        Err(e) => {
            return Err(BackendError::SessionInitFailed(format!("Failed to parse init response: {e}")));
        }
    }

    // Store the session
    {
        let processes = session_manager.get_processes();
        let mut processes = processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;
        processes.insert(
            session_id.clone(),
            PersistentSession {
                conversation_id: session_id.clone(),
                pid,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                is_alive: true,
                stdin: Some(stdin),
                message_sender: Some(message_tx.clone()),
            },
        );
    }

    // Create event channel for internal communication
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<InternalEvent>();

    // Spawn task to handle event forwarding to frontend
    let session_id_for_events = session_id.clone();
    tokio::spawn(async move {
        while let Some(internal_event) = event_rx.recv().await {
            match internal_event {
                InternalEvent::CliIo { session_id, payload } => {
                    let _ = emitter.emit(&format!("cli-io-{session_id}"), payload);
                }
                InternalEvent::GeminiOutput { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-output-{session_id}"), payload.text);
                }
                InternalEvent::GeminiThought { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-thought-{session_id}"), payload.thought);
                }
                InternalEvent::ToolCall { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-tool-call-{session_id}"), payload);
                }
                InternalEvent::ToolCallUpdate { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-tool-call-update-{session_id}"), payload);
                }
                InternalEvent::ToolCallConfirmation { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-tool-call-confirmation-{session_id}"), payload);
                }
                InternalEvent::Error { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-error-{session_id}"), payload.error);
                }
                InternalEvent::ResponseComplete { session_id, payload } => {
                    let _ = emitter.emit(&format!("gemini-response-complete-{session_id}"), payload.completed);
                }
            }
        }
        println!("🔄 Event forwarding task finished for session: {session_id_for_events}");
    });

    // Spawn task to handle this session's I/O
    let session_id_clone = session_id.clone();
    let processes_clone = session_manager.get_processes().clone();

    tokio::spawn(async move {
        handle_session_io_internal(
            session_id_clone,
            reader,
            message_rx,
            processes_clone,
            event_tx,
        )
        .await;
    });

    Ok(message_tx)
}

/// Internal I/O handler with event communication channel
async fn handle_session_io_internal(
    session_id: String,
    mut reader: AsyncBufReader<ChildStdout>,
    mut message_rx: mpsc::UnboundedReceiver<String>,
    processes: ProcessMap,
    event_tx: mpsc::UnboundedSender<InternalEvent>,
) {
    let mut tool_call_id = 1001u32;

    loop {
        tokio::select! {
            // Handle incoming messages to send to CLI
            message = message_rx.recv() => {
                if let Some(message_json) = message {
                    // Get stdin from the session
                    let stdin_opt = {
                        let mut processes_guard = processes.lock().unwrap();
                        if let Some(session) = processes_guard.get_mut(&session_id) {
                            session.stdin.take()
                        } else {
                            None
                        }
                    };

                    if let Some(mut stdin) = stdin_opt {
                        // Emit CLI input event for EVERY message sent to CLI
                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Input,
                                data: message_json.clone(),
                            },
                        });

                        // Send the message
                        if let Err(e) = stdin.write_all(message_json.as_bytes()).await {
                            println!("❌ Failed to write message: {e}");
                            break;
                        }
                        if let Err(e) = stdin.write_all(b"\n").await {
                            println!("❌ Failed to write newline: {e}");
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            println!("❌ Failed to flush: {e}");
                            break;
                        }

                        // Put stdin back
                        {
                            let mut processes_guard = processes.lock().unwrap();
                            if let Some(session) = processes_guard.get_mut(&session_id) {
                                session.stdin = Some(stdin);
                            }
                        }
                    } else {
                        println!("❌ No stdin available for session: {session_id}");
                        break;
                    }
                } else {
                    // Channel closed
                    println!("📄 Message channel closed for session: {session_id}");
                    break;
                }
            }

            // Handle CLI output
            line_result = async {
                let mut line = String::new();
                let result = reader.read_line(&mut line).await;
                (result, line)
            } => {
                match line_result {
                    (Ok(0), _) => {
                        println!("📄 CLI stdout closed for session: {session_id}");
                        break;
                    }
                    (Ok(_), line) => {
                        let line = line.trim();
                        if line.is_empty() || !line.starts_with('{') {
                            if !line.is_empty() {
                                println!("⏭️ Skipping non-JSON: {line}");
                            }
                            continue;
                        }

                        // Emit CLI output event for EVERY message received from CLI
                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Output,
                                data: line.to_string(),
                            },
                        });

                        println!("📥 Session {session_id} received: {line}");

                        // Handle JSON-RPC requests from CLI
                        if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(line) {
                            handle_cli_request_internal(request, &session_id, &processes, &mut tool_call_id, &event_tx).await;
                        }
                        // Handle JSON-RPC responses
                        else if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(line) {
                            if let Some(error) = &response.error {
                                println!("❌ CLI Error: {error:?}");
                            }
                            // Check if this is a completion response (result: null)
                            else if let Some(result) = &response.result {
                                if result.is_null() {
                                    println!("🏁 CLI response completed for session: {session_id}");
                                }
                            }
                        }
                    }
                    (Err(e), _) => {
                        println!("❌ Error reading from CLI: {e}");
                        break;
                    }
                }
            }
        }
    }

    // Cleanup
    {
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(&session_id) {
            session.is_alive = false;
            session.stdin = None;
            session.message_sender = None;
        }
    }

    println!("✅ Session I/O handler finished for: {session_id}");
}

/// Internal CLI request handler with event communication channel
async fn handle_cli_request_internal(
    request: JsonRpcRequest,
    session_id: &str,
    processes: &ProcessMap,
    tool_call_id: &mut u32,
    event_tx: &mpsc::UnboundedSender<InternalEvent>,
) {
    match request.method.as_str() {
        "streamAssistantMessageChunk" => {
            if let Ok(params) =
                serde_json::from_value::<StreamAssistantMessageChunkParams>(request.params.clone())
            {
                if let Some(thought) = params.chunk.thought {
                    println!("💭 Received thought chunk: {thought}");
                    let _ = event_tx.send(InternalEvent::GeminiThought {
                        session_id: session_id.to_string(),
                        payload: GeminiThoughtPayload { thought },
                    });
                }
                if let Some(text) = params.chunk.text {
                    println!("📝 Received text chunk: {text}");
                    let _ = event_tx.send(InternalEvent::GeminiOutput {
                        session_id: session_id.to_string(),
                        payload: GeminiOutputPayload { text },
                    });
                }
            } else {
                println!(
                    "❌ Failed to parse streamAssistantMessageChunk params: {:?}",
                    request.params
                );
            }
        }
        "pushToolCall" => {
            if let Ok(params) = serde_json::from_value::<PushToolCallParams>(request.params) {
                let tool_name = match params.icon.as_str() {
                    "folder" => "list_directory",
                    "fileSearch" => "read_file",
                    "search" => "search_files",
                    "terminal" => "execute_command",
                    "code" => "write_file",
                    _ => &params.icon,
                };

                *tool_call_id += 1;
                let tool_id = *tool_call_id;

                // Send response back to CLI
                send_response_to_cli_internal(
                    session_id,
                    request.id,
                    Some(serde_json::to_value(PushToolCallResult { id: tool_id }).unwrap()),
                    None,
                    processes,
                    event_tx,
                )
                .await;

                // Emit tool call event to frontend
                let tool_call_event = ToolCallEvent {
                    id: tool_id,
                    name: tool_name.to_string(),
                    icon: params.icon.clone(),
                    label: params.label.clone(),
                    locations: params.locations.clone(),
                    status: "running".to_string(),
                };
                let _ = event_tx.send(InternalEvent::ToolCall {
                    session_id: session_id.to_string(),
                    payload: tool_call_event,
                });
                println!("📋 Tool call: {tool_name} (ID: {tool_id})");
            }
        }
        "updateToolCall" => {
            let params = serde_json::from_value::<UpdateToolCallParams>(request.params).unwrap();
            // Send null response
            send_response_to_cli_internal(
                session_id,
                request.id,
                Some(serde_json::Value::Null),
                None,
                processes,
                event_tx,
            )
            .await;

            // Emit tool call update event to frontend
            let tool_call_update = ToolCallUpdate {
                tool_call_id: params.tool_call_id,
                status: params.status.clone(),
                content: params.content.clone(),
            };
            let _ = event_tx.send(InternalEvent::ToolCallUpdate {
                session_id: session_id.to_string(),
                payload: tool_call_update,
            });
            println!("updateToolCall: tool_call_id={}, status={}", params.tool_call_id, params.status);
        }
        "requestToolCallConfirmation" => {
            if let Ok(params) =
                serde_json::from_value::<RequestToolCallConfirmationParams>(request.params)
            {
                println!("🔍 Tool call confirmation request: {}", params.label);
                // Emit tool call confirmation request to frontend
                let confirmation_request = ToolCallConfirmationRequest {
                    request_id: request.id,
                    session_id: session_id.to_string(),
                    label: params.label.clone(),
                    icon: params.icon.clone(),
                    content: params.content.clone(),
                    confirmation: params.confirmation.clone(),
                    locations: params.locations.clone(),
                };
                let _ = event_tx.send(InternalEvent::ToolCallConfirmation {
                    session_id: session_id.to_string(),
                    payload: confirmation_request,
                });
            }
        }
        _ => {
            println!("❓ Unknown CLI method: {}", request.method);
        }
    }
}

/// Send a JSON-RPC response back to the CLI (internal version)
async fn send_response_to_cli_internal(
    session_id: &str,
    request_id: u32,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
    processes: &ProcessMap,
    event_tx: &mpsc::UnboundedSender<InternalEvent>,
) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: request_id,
        result,
        error,
    };

    let response_json = serde_json::to_string(&response).unwrap();

    // Emit CLI input event for response we're sending back to CLI
    let _ = event_tx.send(InternalEvent::CliIo {
        session_id: session_id.to_string(),
        payload: CliIoPayload {
            io_type: CliIoType::Input,
            data: response_json.clone(),
        },
    });

    // Get stdin and send response
    let stdin_opt = {
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(session_id) {
            session.stdin.take()
        } else {
            None
        }
    };

    if let Some(mut stdin) = stdin_opt {
        let _ = stdin.write_all(response_json.as_bytes()).await;
        let _ = stdin.write_all(b"\n").await;
        let _ = stdin.flush().await;

        // Put stdin back
        {
            let mut processes_guard = processes.lock().unwrap();
            if let Some(session) = processes_guard.get_mut(session_id) {
                session.stdin = Some(stdin);
            }
        }
    }
}

// =====================================
// Error Types
// =====================================

#[derive(Error, Debug)]
pub enum BackendError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    
    #[error("Command not allowed for security reasons")]
    CommandNotAllowed,
    
    #[error("Failed to execute command: {0}")]
    CommandExecutionFailed(String),
    
    #[error("Failed to serialize/deserialize: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Session initialization failed: {0}")]
    SessionInitFailed(String),
    
    #[error("Channel communication failed")]
    ChannelError,
}

pub type BackendResult<T> = Result<T, BackendError>;

// =====================================
// Public API (to be implemented)
// =====================================

/// Main backend interface for Gemini CLI functionality
pub struct GeminiBackend<E: EventEmitter> {
    emitter: E,
    session_manager: SessionManager,
}

impl<E: EventEmitter + 'static> GeminiBackend<E> {
    /// Create a new GeminiBackend instance
    pub fn new(emitter: E) -> Self {
        Self { 
            emitter,
            session_manager: SessionManager::new(),
        }
    }
    
    // =====================================
    // Event Helper Methods
    // =====================================
    
    /// Emit CLI I/O event
    pub fn emit_cli_io(&self, session_id: &str, io_type: CliIoType, data: &str) -> BackendResult<()> {
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
        self.emitter.emit(&format!("gemini-output-{session_id}"), payload)
    }
    
    /// Emit Gemini thought event
    pub fn emit_gemini_thought(&self, session_id: &str, thought: &str) -> BackendResult<()> {
        let payload = GeminiThoughtPayload {
            thought: thought.to_string(),
        };
        self.emitter.emit(&format!("gemini-thought-{session_id}"), payload)
    }
    
    /// Emit tool call event
    pub fn emit_tool_call(&self, session_id: &str, tool_call: &ToolCallEvent) -> BackendResult<()> {
        self.emitter.emit(&format!("gemini-tool-call-{session_id}"), tool_call.clone())
    }
    
    /// Emit tool call update event
    pub fn emit_tool_call_update(&self, session_id: &str, update: &ToolCallUpdate) -> BackendResult<()> {
        self.emitter.emit(&format!("gemini-tool-call-update-{session_id}"), update.clone())
    }
    
    /// Emit tool call confirmation event
    pub fn emit_tool_call_confirmation(&self, session_id: &str, confirmation: &ToolCallConfirmationRequest) -> BackendResult<()> {
        self.emitter.emit(&format!("gemini-tool-call-confirmation-{session_id}"), confirmation.clone())
    }
    
    /// Emit error event
    pub fn emit_error(&self, session_id: &str, error: &str) -> BackendResult<()> {
        let payload = ErrorPayload {
            error: error.to_string(),
        };
        self.emitter.emit(&format!("gemini-error-{session_id}"), payload)
    }
    
    /// Emit response complete event
    pub fn emit_response_complete(&self, session_id: &str) -> BackendResult<()> {
        let payload = ResponseCompletePayload {
            completed: true,
        };
        self.emitter.emit(&format!("gemini-response-complete-{session_id}"), payload)
    }
    
    /// Emit command result event
    pub fn emit_command_result(&self, result: &CommandResult) -> BackendResult<()> {
        self.emitter.emit("command-result", result.clone())
    }
    
    /// Check if Gemini CLI is installed and available
    pub async fn check_cli_installed(&self) -> BackendResult<bool> {
        // Test if gemini command is available via shell
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
        working_directory: Option<String>,
        model: String,
    ) -> BackendResult<()> {
        initialize_session(session_id, working_directory, model, self.emitter.clone(), &self.session_manager).await?;
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

        // Check if session exists, if not initialize it
        let message_sender = {
            let processes = self.session_manager.get_processes();
            let processes = processes
                .lock()
                .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;
            processes.get(&session_id).map_or_else(|| None, |session| session.message_sender.clone())
        };

        let message_sender = if let Some(sender) = message_sender {
            sender
        } else {
            // Initialize new session
            println!("🚀 No existing session, initializing new one for: {session_id}");
            let model_to_use = "gemini-2.5-flash".to_string();
            initialize_session(
                session_id.clone(),
                None,
                model_to_use,
                self.emitter.clone(),
                &self.session_manager,
            )
            .await?
        };

        // Build message chunks
        let mut chunks = vec![MessageChunk::Text { text: message }];

        // Add conversation history as context if present
        if !conversation_history.is_empty() {
            chunks.insert(
                0,
                MessageChunk::Text {
                    text: format!("Previous conversation context:\n{conversation_history}\n\n"),
                },
            );
        }
        let msg_params = SendUserMessageParams { chunks };

        let msg_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 2, // TODO: Use proper request ID tracking
            method: "sendUserMessage".to_string(),
            params: serde_json::to_value(msg_params)?,
        };

        let request_json = serde_json::to_string(&msg_request)
            .map_err(|e| BackendError::SessionInitFailed(format!("Failed to serialize message request: {e}")))?
;

        // Send the message through the channel
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
        println!("📤 Sending tool call confirmation response: session={session_id}, request_id={request_id}, tool_call_id={tool_call_id}, outcome={outcome}");

        let response_data = RequestToolCallConfirmationResult {
            id: tool_call_id,
            outcome,
        };

        // NOTE: This function doesn't have access to event_tx, so CLI I/O won't be emitted here
        // This is called from the public API, not from the internal session handler
        // Send response back to CLI using ACP protocol format
        // TODO: Consider restructuring to emit CLI I/O events here too
        let dummy_event_tx = {
            let (tx, _rx) = mpsc::unbounded_channel();
            tx
        };
        send_response_to_cli_internal(
            &session_id,
            request_id,
            Some(serde_json::to_value(response_data)?),
            None,
            self.session_manager.get_processes(),
            &dummy_event_tx,
        )
        .await;

        Ok(())
    }
    
    /// Execute a confirmed command
    pub async fn execute_confirmed_command(&self, command: String) -> BackendResult<String> {
        println!("🖥️ Executing confirmed command: {command}");

        match execute_terminal_command(&command).await {
            Ok(output) => {
                println!("✅ Command executed successfully");

                // Emit command result event
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

                // Emit command result event
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

        // Run gemini with specified model using simple direct execution
        let model_to_use = model.unwrap_or_else(|| "gemini-2.5-flash".to_string());

        let mut child = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| BackendError::SessionInitFailed(format!("Failed to spawn gemini for title generation: {e}")))?  
        } else {
            Command::new("gemini")
                .args(["--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| BackendError::SessionInitFailed(format!("Failed to spawn gemini for title generation: {e}")))?  
        };

        // Write prompt to stdin
        if let Some(stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let mut stdin = stdin;
            stdin
                .write_all(prompt.as_bytes())
                .await
                .map_err(|e| BackendError::IoError(e))?;
            stdin
                .shutdown()
                .await
                .map_err(|e| BackendError::IoError(e))?;
        }

        // Wait for completion and get output
        let output = child
            .wait_with_output()
            .await
            .map_err(|e| BackendError::SessionInitFailed(format!("Failed to run gemini for title generation: {e}")))?;

        if !output.status.success() {
            let error_msg = format!(
                "Gemini CLI failed with exit code {:?}: {}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr)
            );
            return Err(BackendError::SessionInitFailed(error_msg));
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

        // Fallback if title is too long or empty
        let final_title = if title.is_empty() || title.len() > 50 {
            let fallback = message.chars().take(30).collect::<String>();
            fallback
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
        use std::path::Path;
        let path_obj = Path::new(&path);
        Ok(path_obj.exists() && path_obj.is_dir())
    }
    
    /// Check if the given path is the user's home directory
    pub async fn is_home_directory(&self, path: String) -> BackendResult<bool> {
        use std::path::Path;

        let home = std::env::var("HOME").unwrap_or_else(|_| {
            std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string())
        });

        if home.is_empty() {
            return Ok(false);
        }

        let path_obj = Path::new(&path);
        let home_obj = Path::new(&home);

        // Canonicalize both paths to handle symbolic links and relative paths
        match (path_obj.canonicalize(), home_obj.canonicalize()) {
            (Ok(canonical_path), Ok(canonical_home)) => {
                Ok(canonical_path == canonical_home)
            }
            _ => {
                // Fallback to string comparison if canonicalization fails
                Ok(path_obj == home_obj)
            }
        }
    }
}

// Placeholder for testing - will be removed
pub fn add(left: u64, right: u64) -> u64 {
    left + right
}
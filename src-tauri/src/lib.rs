use std::process::Stdio;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::process::{Command, ChildStdin, ChildStdout};
use tokio::sync::mpsc;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
struct SessionInfo {
    id: String,
    active: bool,
}

// Persistent process session
struct PersistentSession {
    conversation_id: String,
    pid: Option<u32>,
    created_at: u64,
    is_alive: bool,
    stdin: Option<ChildStdin>,
    message_sender: Option<mpsc::UnboundedSender<String>>, // For sending messages to the session task
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProcessStatus {
    conversation_id: String,
    pid: Option<u32>,
    created_at: u64,
    is_alive: bool,
}

type ProcessMap = Arc<Mutex<HashMap<String, PersistentSession>>>;

struct AppState {
    processes: ProcessMap,
}

// Security: Check if a command is safe to execute
fn is_command_safe(command: &str) -> bool {
    let dangerous_patterns = [
        "rm ", "del ", "format", "mkfs", "dd if=", "sudo rm", "sudo del",
        "> /dev/", "curl ", "wget ", "powershell", "cmd /c del", "cmd /c rd",
        "shutdown", "reboot", "halt", "init 0", "systemctl", "service ",
        "apt-get remove", "yum remove", "dnf remove", "brew uninstall",
        "npm uninstall -g", "pip uninstall", "cargo uninstall",
        "chmod 777", "chown ", "passwd", "su ", "sudo su",
        "export PATH=", "set PATH=", "alias rm=", "alias del=",
        "eval ", "exec ", "`", "$(", "${", "||", "&&",
        "; rm", "; del", "; sudo", "; curl", "; wget",
        "| rm", "| del", "| sudo", "| curl", "| wget"
    ];
    
    let command_lower = command.to_lowercase();
    for pattern in &dangerous_patterns {
        if command_lower.contains(pattern) {
            return false;
        }
    }
    
    // Allow common safe commands
    let safe_commands = [
        "echo", "cat", "ls", "dir", "pwd", "whoami", "date", "time",
        "python", "node", "npm", "cargo", "git", "rustc", "gcc", "clang",
        "java", "javac", "go", "php", "ruby", "perl", "make", "cmake",
        "grep", "find", "sort", "head", "tail", "wc", "awk", "sed",
        "ping", "nslookup", "dig", "ps", "top", "htop", "df", "du",
        "uname", "which", "where", "type", "help", "man", "--help", "--version"
    ];
    
    let first_word = command_lower.split_whitespace().next().unwrap_or("");
    safe_commands.iter().any(|&safe_cmd| first_word.starts_with(safe_cmd))
}

// Execute a terminal command safely
async fn execute_terminal_command(command: &str) -> Result<String, String> {
    if !is_command_safe(command) {
        return Err("Command not allowed for security reasons".to_string());
    }
    
    println!("🖥️ Executing terminal command: {}", command);
    
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(&["/C", command])
            .output()
            .await
    } else {
        Command::new("sh")
            .args(&["-c", command])
            .output()
            .await
    };
    
    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);
            
            if result.status.success() {
                Ok(format!("Exit code: {}\nOutput:\n{}", 
                    result.status.code().unwrap_or(0), stdout))
            } else {
                Err(format!("Exit code: {}\nError:\n{}\nOutput:\n{}", 
                    result.status.code().unwrap_or(-1), stderr, stdout))
            }
        }
        Err(e) => Err(format!("Failed to execute command: {}", e))
    }
}

// JSON-RPC types
#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u32,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u32,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

// Gemini CLI specific types
#[derive(Debug, Serialize, Deserialize)]
struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    protocol_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    protocol_version: String,
    #[serde(rename = "isAuthenticated")]
    is_authenticated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct SendUserMessageParams {
    chunks: Vec<MessageChunk>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum MessageChunk {
    Text { text: String },
    Path { path: String },
}

#[derive(Debug, Serialize, Deserialize)]
struct StreamAssistantMessageChunkParams {
    chunk: AssistantChunk,
}

#[derive(Debug, Serialize, Deserialize)]
struct AssistantChunk {
    thought: Option<String>,
    text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PushToolCallParams {
    icon: String,
    label: String,
    locations: Vec<ToolCallLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ToolCallLocation {
    path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PushToolCallResult {
    id: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpdateToolCallParams {
    #[serde(rename = "toolCallId")]
    tool_call_id: u32,
    status: String,
    content: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RequestToolCallConfirmationParams {
    label: String,
    icon: String,
    content: Option<ToolCallConfirmationContent>,
    confirmation: ToolCallConfirmation,
    locations: Vec<ToolCallLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ToolCallConfirmationContent {
    #[serde(rename = "type")]
    content_type: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(rename = "oldText", default)]
    old_text: Option<String>,
    #[serde(rename = "newText", default)]
    new_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ToolCallConfirmation {
    #[serde(rename = "type")]
    confirmation_type: String,
    #[serde(rename = "rootCommand", default)]
    root_command: Option<String>,
    #[serde(default)]
    command: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RequestToolCallConfirmationResult {
    id: String,
    outcome: String,
}




#[tauri::command]
async fn check_cli_installed() -> Result<bool, String> {
    // Test if gemini command is available via shell
    let result = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(&["/C", "gemini", "--version"])
            .output()
            .await
    } else {
        Command::new("sh")
            .args(&["-c", "gemini --version"])
            .output()
            .await
    };
    
    match result {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false)
    }
}

#[tauri::command]
async fn start_session(
    _session_id: String,
) -> Result<(), String> {
    // Test if gemini is available via shell
    let test_result = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(&["/C", "gemini", "--version"])
            .output()
            .await
    } else {
        Command::new("sh")
            .args(&["-c", "gemini --version"])
            .output()
            .await
    };
    
    match test_result {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => Err(format!("Gemini CLI test failed: {}", String::from_utf8_lossy(&output.stderr))),
        Err(e) => Err(format!("Failed to test gemini CLI: {}", e))
    }
}

// Initialize a new persistent session
async fn initialize_session(
    session_id: String,
    working_directory: Option<String>,
    model: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<mpsc::UnboundedSender<String>, String> {
    println!("🚀 Initializing persistent Gemini session for: {}", session_id);
    
    // Create message channel for sending messages to this session
    let (message_tx, message_rx) = mpsc::unbounded_channel::<String>();
    
    // Spawn CLI process
    let mut child = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", "gemini", "--model", &model, "--experimental-acp"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        // Set working directory if provided
        if let Some(ref wd) = working_directory {
            println!("🗂️ Setting working directory to: {}", wd);
            cmd.current_dir(wd);
        }
        
        cmd.spawn()
            .map_err(|e| format!("Failed to run gemini command via cmd: {}", e))?
    } else {
        let mut cmd = Command::new("sh");
        let gemini_command = format!("gemini --model {} --experimental-acp", model);
        cmd.args(&["-c", &gemini_command])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        // Set working directory if provided
        if let Some(ref wd) = working_directory {
            println!("🗂️ Setting working directory to: {}", wd);
            cmd.current_dir(wd);
        }
        
        cmd.spawn()
            .map_err(|e| format!("Failed to run gemini command via shell: {}", e))?
    };
    
    let pid = child.id();
    let mut stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    
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
        .map_err(|e| format!("Failed to serialize init request: {}", e))?;
    
    // Send initialization
    stdin.write_all(request_json.as_bytes()).await
        .map_err(|e| format!("Failed to write init request: {}", e))?;
    stdin.write_all(b"\n").await
        .map_err(|e| format!("Failed to write newline: {}", e))?;
    stdin.flush().await
        .map_err(|e| format!("Failed to flush: {}", e))?;
    
    // Emit CLI input event
    let _ = app_handle.emit(&format!("cli-io-{}", session_id), &serde_json::json!({
        "type": "input",
        "data": request_json
    }));
    
    // Read initialization response
    let mut reader = AsyncBufReader::new(stdout);
    let mut line = String::new();
    reader.read_line(&mut line).await
        .map_err(|e| format!("Failed to read init response: {}", e))?;
    
    // Emit CLI output event
    let _ = app_handle.emit(&format!("cli-io-{}", session_id), &serde_json::json!({
        "type": "output",
        "data": line.trim()
    }));
    
    // Parse initialization response
    match serde_json::from_str::<JsonRpcResponse>(&line) {
        Ok(response) => {
            if let Some(error) = &response.error {
                return Err(format!("Gemini CLI Error: {:?}", error));
            }
            println!("✅ Session initialized successfully for: {}", session_id);
        }
        Err(e) => {
            return Err(format!("Failed to parse init response: {}", e));
        }
    }
    
    // Store the session
    {
        let mut processes = state.processes.lock().map_err(|_| "Failed to lock processes")?;
        processes.insert(session_id.clone(), PersistentSession {
            conversation_id: session_id.clone(),
            pid,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            is_alive: true,
            stdin: Some(stdin),
            message_sender: Some(message_tx.clone()),
        });
    }
    
    // Spawn task to handle this session's I/O
    let session_id_clone = session_id.clone();
    let app_handle_clone = app_handle.clone();
    let state_clone = state.processes.clone();
    
    tokio::spawn(async move {
        handle_session_io(session_id_clone, reader, message_rx, app_handle_clone, state_clone).await;
    });
    
    Ok(message_tx)
}

// Handle I/O for a persistent session
async fn handle_session_io(
    session_id: String,
    mut reader: AsyncBufReader<ChildStdout>,
    mut message_rx: mpsc::UnboundedReceiver<String>,
    app_handle: AppHandle,
    state: Arc<Mutex<HashMap<String, PersistentSession>>>,
) {
    let _request_id = 2u32; // Start at 2 since init was 1
    let mut tool_call_id = 1001u32;
    
    loop {
        tokio::select! {
            // Handle incoming messages to send to CLI
            message = message_rx.recv() => {
                if let Some(message_json) = message {
                    // Get stdin from the session
                    let stdin_opt = {
                        let mut processes = state.lock().unwrap();
                        if let Some(session) = processes.get_mut(&session_id) {
                            session.stdin.take()
                        } else {
                            None
                        }
                    };
                    
                    if let Some(mut stdin) = stdin_opt {
                        // Send the message
                        if let Err(e) = stdin.write_all(message_json.as_bytes()).await {
                            println!("❌ Failed to write message: {}", e);
                            break;
                        }
                        if let Err(e) = stdin.write_all(b"\n").await {
                            println!("❌ Failed to write newline: {}", e);
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            println!("❌ Failed to flush: {}", e);
                            break;
                        }
                        
                        // Emit CLI input event
                        let _ = app_handle.emit(&format!("cli-io-{}", session_id), &serde_json::json!({
                            "type": "input",
                            "data": message_json
                        }));
                        
                        // Put stdin back
                        {
                            let mut processes = state.lock().unwrap();
                            if let Some(session) = processes.get_mut(&session_id) {
                                session.stdin = Some(stdin);
                            }
                        }
                    } else {
                        println!("❌ No stdin available for session: {}", session_id);
                        break;
                    }
                } else {
                    // Channel closed
                    println!("📄 Message channel closed for session: {}", session_id);
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
                        println!("📄 CLI stdout closed for session: {}", session_id);
                        break;
                    }
                    (Ok(_), line) => {
                        let line = line.trim();
                        if line.is_empty() || !line.starts_with('{') {
                            if !line.is_empty() {
                                println!("⏭️ Skipping non-JSON: {}", line);
                            }
                            continue;
                        }
                        
                        println!("📥 Session {} received: {}", session_id, line);
                        
                        // Emit CLI output event
                        let _ = app_handle.emit(&format!("cli-io-{}", session_id), &serde_json::json!({
                            "type": "output",
                            "data": line
                        }));
                        
                        // Handle JSON-RPC requests from CLI
                        if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(&line) {
                            handle_cli_request(request, &session_id, &app_handle, &state, &mut tool_call_id).await;
                        }
                        // Handle JSON-RPC responses
                        else if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&line) {
                            if let Some(error) = &response.error {
                                println!("❌ CLI Error: {:?}", error);
                                let _ = app_handle.emit(&format!("gemini-error-{}", session_id), &format!("Gemini CLI Error: {:?}", error));
                            }
                        }
                    }
                    (Err(e), _) => {
                        println!("❌ Error reading from CLI: {}", e);
                        break;
                    }
                }
            }
        }
    }
    
    // Cleanup
    {
        let mut processes = state.lock().unwrap();
        if let Some(session) = processes.get_mut(&session_id) {
            session.is_alive = false;
            session.stdin = None;
            session.message_sender = None;
        }
    }
    
    println!("✅ Session I/O handler finished for: {}", session_id);
}

// Handle CLI JSON-RPC requests (tool calls, streaming, etc.)
async fn handle_cli_request(
    request: JsonRpcRequest,
    session_id: &str,
    app_handle: &AppHandle,
    state: &Arc<Mutex<HashMap<String, PersistentSession>>>,
    tool_call_id: &mut u32,
) {
    match request.method.as_str() {
        "streamAssistantMessageChunk" => {
            if let Ok(params) = serde_json::from_value::<StreamAssistantMessageChunkParams>(request.params.clone()) {
                if let Some(thought) = params.chunk.thought {
                    println!("💭 Emitting thought chunk: {}", thought);
                    let _ = app_handle.emit(&format!("gemini-thought-{}", session_id), &thought);
                }
                if let Some(text) = params.chunk.text {
                    println!("📝 Emitting text chunk: {}", text);
                    let _ = app_handle.emit(&format!("gemini-output-{}", session_id), &text);
                }
            } else {
                println!("❌ Failed to parse streamAssistantMessageChunk params: {:?}", request.params);
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
                    _ => &params.icon
                };
                
                *tool_call_id += 1;
                let tool_id = *tool_call_id;
                
                // Send response back to CLI
                send_response_to_cli(
                    session_id, 
                    request.id, 
                    Some(serde_json::to_value(PushToolCallResult { id: tool_id }).unwrap()),
                    None,
                    app_handle,
                    state
                ).await;
                
                // Emit tool call to frontend
                let tool_call_data = serde_json::json!({
                    "id": tool_id,
                    "name": tool_name,
                    "icon": params.icon,
                    "label": params.label,
                    "locations": params.locations,
                    "status": "pending"
                });
                let _ = app_handle.emit(&format!("gemini-tool-call-{}", session_id), &tool_call_data);
            }
        }
        "updateToolCall" => {
            let params = serde_json::from_value::<UpdateToolCallParams>(request.params).unwrap();
            // Send null response
            send_response_to_cli(
                session_id,
                request.id,
                Some(serde_json::Value::Null),
                None,
                app_handle,
                state
            ).await;
            
            // Emit update to frontend
            let update_data = serde_json::json!({
                "toolCallId": params.tool_call_id,
                "status": params.status,
                "content": params.content
            });
            println!("updateToolCall: {:?}", update_data);

            let _ = app_handle.emit(&format!("gemini-tool-call-update-{}", session_id), &update_data);
        }
        "requestToolCallConfirmation" => {
            if let Ok(params) = serde_json::from_value::<RequestToolCallConfirmationParams>(request.params) {
                println!("🔍 Tool call confirmation request: {}", params.label);
                
                // Emit confirmation request to frontend
                let confirmation_data = serde_json::json!({
                    "requestId": request.id,
                    "sessionId": session_id,
                    "label": params.label,
                    "icon": params.icon,
                    "content": params.content.as_ref().map(|content| serde_json::json!({
                        "type": content.content_type,
                        "path": content.path,
                        "oldText": content.old_text,
                        "newText": content.new_text
                    })),
                    "confirmation": {
                        "type": params.confirmation.confirmation_type,
                        "rootCommand": params.confirmation.root_command,
                        "command": params.confirmation.command
                    },
                    "locations": params.locations
                });
                
                let _ = app_handle.emit(&format!("gemini-tool-call-confirmation-{}", session_id), &confirmation_data);
                
                // Note: The response will be sent when the user confirms/denies via frontend
                // Don't send response here - it will be handled by a separate command
            }
        }
        _ => {
            println!("❓ Unknown CLI method: {}", request.method);
        }
    }
}

// Send a JSON-RPC response back to the CLI
async fn send_response_to_cli(
    session_id: &str,
    request_id: u32,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
    app_handle: &AppHandle,
    state: &Arc<Mutex<HashMap<String, PersistentSession>>>,
) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: request_id,
        result,
        error,
    };
    
    let response_json = serde_json::to_string(&response).unwrap();
    
    // Get stdin and send response
    let stdin_opt = {
        let mut processes = state.lock().unwrap();
        if let Some(session) = processes.get_mut(session_id) {
            session.stdin.take()
        } else {
            None
        }
    };
    
    if let Some(mut stdin) = stdin_opt {
        let _ = stdin.write_all(response_json.as_bytes()).await;
        let _ = stdin.write_all(b"\n").await;
        let _ = stdin.flush().await;
        
        // Emit CLI input event
        let _ = app_handle.emit(&format!("cli-io-{}", session_id), &serde_json::json!({
            "type": "input",
            "data": response_json
        }));
        
        // Put stdin back
        {
            let mut processes = state.lock().unwrap();
            if let Some(session) = processes.get_mut(session_id) {
                session.stdin = Some(stdin);
            }
        }
    }
}

// New send_message function that uses persistent sessions
#[tauri::command]
async fn send_message(
    session_id: String,
    message: String,
    conversation_history: String,
    working_directory: Option<String>,
    model: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!("📤 Sending message to session: {}", session_id);
    
    // Check if session exists, if not initialize it
    let message_sender = {
        let processes = state.processes.lock().map_err(|_| "Failed to lock processes")?;
        if let Some(session) = processes.get(&session_id) {
            session.message_sender.clone()
        } else {
            None
        }
    };
    
    let message_sender = if let Some(sender) = message_sender {
        sender
    } else {
        // Initialize new session
        println!("🚀 No existing session, initializing new one for: {}", session_id);
        let model_to_use = model.unwrap_or_else(|| "gemini-2.5-flash".to_string());
        initialize_session(session_id.clone(), working_directory.clone(), model_to_use, app_handle.clone(), state.clone()).await?
    };
    
    // Build message chunks
    let mut chunks = vec![MessageChunk::Text { text: message }];
    
    // Add conversation history as context if present
    if !conversation_history.is_empty() {
        chunks.insert(0, MessageChunk::Text { 
            text: format!("Previous conversation context:\n{}\n\n", conversation_history) 
        });
    }
    let msg_params = SendUserMessageParams { chunks };
    
    let msg_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 2, // TODO: Use proper request ID tracking
        method: "sendUserMessage".to_string(),
        params: serde_json::to_value(msg_params).unwrap(),
    };
    
    let request_json = serde_json::to_string(&msg_request)
        .map_err(|e| format!("Failed to serialize message request: {}", e))?;
    
    // Send the message through the channel
    message_sender.send(request_json)
        .map_err(|_| "Failed to send message to session")?;
    
    println!("✅ Message sent to persistent session: {}", session_id);
    Ok(())
}

#[tauri::command]
async fn test_gemini_command() -> Result<String, String> {
    // Test running gemini with --help using shell
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(&["/C", "gemini", "--help"])
            .output()
            .await
            .map_err(|e| format!("Failed to run gemini --help via cmd: {}", e))?
    } else {
        Command::new("sh")
            .args(&["-c", "gemini --help"])
            .output()
            .await
            .map_err(|e| format!("Failed to run gemini --help via shell: {}", e))?
    };
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    Ok(format!(
        "Running 'gemini --help' via shell\nExit code: {}\nSTDOUT:\n{}\nSTDERR:\n{}",
        output.status.code().unwrap_or(-1),
        stdout,
        stderr
    ))
}

#[tauri::command]
async fn get_process_statuses(state: State<'_, AppState>) -> Result<Vec<ProcessStatus>, String> {
    let processes = state.processes.lock().map_err(|_| "Failed to lock processes")?;
    let statuses: Vec<ProcessStatus> = processes.values().map(|session| ProcessStatus {
        conversation_id: session.conversation_id.clone(),
        pid: session.pid,
        created_at: session.created_at,
        is_alive: session.is_alive,
    }).collect();
    Ok(statuses)
}

#[tauri::command]
async fn kill_process(conversation_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut processes = state.processes.lock().map_err(|_| "Failed to lock processes")?;
    
    if let Some(session) = processes.get_mut(&conversation_id) {
        if let Some(pid) = session.pid {
            // Try to kill the process
            #[cfg(windows)]
            {
                let output = std::process::Command::new("taskkill")
                    .args(&["/PID", &pid.to_string(), "/F"])
                    .output()
                    .map_err(|e| format!("Failed to kill process: {}", e))?;
                
                if !output.status.success() {
                    return Err(format!("Failed to kill process {}: {}", pid, String::from_utf8_lossy(&output.stderr)));
                }
            }
            
            #[cfg(not(windows))]
            {
                let output = std::process::Command::new("kill")
                    .args(&["-9", &pid.to_string()])
                    .output()
                    .map_err(|e| format!("Failed to kill process: {}", e))?;
                
                if !output.status.success() {
                    return Err(format!("Failed to kill process {}: {}", pid, String::from_utf8_lossy(&output.stderr)));
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

#[tauri::command]
async fn send_tool_call_confirmation_response(
    session_id: String,
    request_id: u32,
    tool_call_id: String,
    outcome: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!("📤 Sending tool call confirmation response: session={}, request_id={}, tool_call_id={}, outcome={}", session_id, request_id, tool_call_id, outcome);
    
    let response_data = RequestToolCallConfirmationResult { 
        id: tool_call_id,
        outcome 
    };
    println!("📤 Response data: {:?}", response_data);
    
    // Send response back to CLI using ACP protocol format
    send_response_to_cli(
        &session_id,
        request_id,
        Some(serde_json::to_value(response_data).unwrap()),
        None,
        &app_handle,
        &state.processes
    ).await;
    
    Ok(())
}

// New command to execute terminal commands after confirmation
#[tauri::command]
async fn execute_confirmed_command(
    command: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    println!("🖥️ Executing confirmed command: {}", command);
    
    match execute_terminal_command(&command).await {
        Ok(output) => {
            println!("✅ Command executed successfully");
            
            // Emit command result event
            let _ = app_handle.emit("command-result", &serde_json::json!({
                "command": command,
                "success": true,
                "output": output
            }));
            
            Ok(output)
        }
        Err(error) => {
            println!("❌ Command execution failed: {}", error);
            
            // Emit command result event
            let _ = app_handle.emit("command-result", &serde_json::json!({
                "command": command,
                "success": false,
                "error": error
            }));
            
            Err(error)
        }
    }
}

#[tauri::command]
async fn generate_conversation_title(message: String, model: Option<String>) -> Result<String, String> {
    
    let prompt = format!(
        "Generate a short, concise title (3-6 words) for a conversation that starts with this user message: \"{}\". Only return the title, nothing else.",
        message.chars().take(200).collect::<String>()
    );
    
    // Run gemini with specified model using simple direct execution
    let model_to_use = model.unwrap_or_else(|| "gemini-2.5-flash".to_string());
    
    let mut child = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(&["/C", "gemini", "--model", &model_to_use])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn gemini for title generation: {}", e))?
    } else {
        Command::new("gemini")
            .args(&["--model", &model_to_use])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn gemini for title generation: {}", e))?
    };

    // Write prompt to stdin
    if let Some(stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let mut stdin = tokio::process::ChildStdin::from(stdin);
        stdin.write_all(prompt.as_bytes()).await.map_err(|e| {
            format!("Failed to write prompt to gemini stdin: {}", e)
        })?;
        stdin.shutdown().await.map_err(|e| {
            format!("Failed to close gemini stdin: {}", e)
        })?;
    }

    // Wait for completion and get output
    let output = child.wait_with_output().await.map_err(|e| {
        format!("Failed to run gemini for title generation: {}", e)
    })?;
    
    if !output.status.success() {
        let error_msg = format!("Gemini CLI failed with exit code {:?}: {}", output.status.code(), String::from_utf8_lossy(&output.stderr));
        return Err(error_msg);
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

#[tauri::command]
async fn validate_directory(path: String) -> Result<bool, String> {
    use std::path::Path;
    
    let path_obj = Path::new(&path);
    Ok(path_obj.exists() && path_obj.is_dir())
}

#[tauri::command]
async fn debug_environment() -> Result<String, String> {
    let path = std::env::var("PATH").unwrap_or_else(|_| "PATH not found".to_string());
    let home = std::env::var("HOME").unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "HOME not found".to_string()));
    
    // Test if gemini is available via shell
    let gemini_result = if cfg!(target_os = "windows") {
        match Command::new("cmd").args(&["/C", "gemini", "--version"]).output().await {
            Ok(output) if output.status.success() => {
                format!("Available via shell: {}", String::from_utf8_lossy(&output.stdout).trim())
            },
            Ok(output) => {
                format!("Shell test failed: {}", String::from_utf8_lossy(&output.stderr))
            },
            Err(e) => format!("Shell execution failed: {}", e),
        }
    } else {
        match Command::new("sh").args(&["-c", "gemini --version"]).output().await {
            Ok(output) if output.status.success() => {
                format!("Available via shell: {}", String::from_utf8_lossy(&output.stdout).trim())
            },
            Ok(output) => {
                format!("Shell test failed: {}", String::from_utf8_lossy(&output.stderr))
            },
            Err(e) => format!("Shell execution failed: {}", e),
        }
    };
    
    // Get the actual system PATH using cmd
    let system_path = if cfg!(windows) {
        match Command::new("cmd").args(&["/c", "echo %PATH%"]).output().await {
            Ok(output) => String::from_utf8_lossy(&output.stdout).to_string(),
            Err(e) => format!("Failed to get system PATH: {}", e),
        }
    } else {
        "Not Windows".to_string()
    };
    
    Ok(format!(
        "Current PATH (from Tauri app):\n{}\n\nSystem PATH (from cmd):\n{}\n\nHOME: {}\n\nGemini CLI test result:\n{}",
        path.replace(";", ";\n").replace(":", ":\n"),
        system_path.replace(";", ";\n").replace(":", ":\n"),
        home,
        gemini_result
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        processes: Arc::new(Mutex::new(HashMap::new())),
    };
    
    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_cli_installed,
            start_session,
            send_message,
            get_process_statuses,
            kill_process,
            test_gemini_command,
            send_tool_call_confirmation_response,
            execute_confirmed_command,
            generate_conversation_title,
            validate_directory,
            debug_environment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

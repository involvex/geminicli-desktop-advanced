use include_dir::{Dir, include_dir};
use rocket::{
    get,
    http::{ContentType, Status},
    post, routes,
    serde::json::Json,
    State,
};
use rocket_ws::{WebSocket, Stream, Message};
use std::path::PathBuf;
use std::sync::{Arc, atomic::{AtomicU64, Ordering}};
use tokio::sync::{Mutex, mpsc};
use serde::{Deserialize, Serialize};

// Import backend functionality
use backend::{
    EventEmitter, GeminiBackend,
    ProcessStatus
};

static FRONTEND_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../../frontend/dist");

// =====================================
// WebSocket Connection Management
// =====================================

/// Manages active WebSocket connections for event broadcasting
#[derive(Clone)]
pub struct WebSocketManager {
    connections: Arc<Mutex<Vec<mpsc::UnboundedSender<String>>>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Register a new WebSocket connection
    pub async fn add_connection(&self, sender: mpsc::UnboundedSender<String>) {
        let mut connections = self.connections.lock().await;
        connections.push(sender);
        println!("📡 WebSocket connection added. Total connections: {}", connections.len());
    }

    /// Broadcast an event message to all connected clients
    pub async fn broadcast(&self, message: String) -> backend::BackendResult<()> {
        let mut connections = self.connections.lock().await;
        let mut failed_indices = Vec::new();

        // Send to all connections, tracking failures
        for (i, sender) in connections.iter().enumerate() {
            if sender.send(message.clone()).is_err() {
                failed_indices.push(i);
            }
        }

        // Remove failed connections (iterate backwards to maintain indices)
        for &i in failed_indices.iter().rev() {
            connections.remove(i);
        }

        if !failed_indices.is_empty() {
            println!("📡 Removed {} dead WebSocket connections. Active: {}", failed_indices.len(), connections.len());
        }

        Ok(())
    }

    /// Get the number of active connections
    pub async fn connection_count(&self) -> usize {
        self.connections.lock().await.len()
    }
}

/// WebSocket event message format with sequence number for ordering
#[derive(Serialize)]
struct WebSocketEvent<T> {
    event: String,
    payload: T,
    sequence: u64,
}

// =====================================
// WebSockets EventEmitter Implementation
// =====================================

/// WebSocket-based event emitter that implements EventEmitter
#[derive(Clone)]
pub struct WebSocketsEventEmitter {
    ws_manager: WebSocketManager,
    sequence_counter: Arc<AtomicU64>,
}

impl WebSocketsEventEmitter {
    pub fn new(ws_manager: WebSocketManager) -> Self {
        Self { 
            ws_manager,
            sequence_counter: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl EventEmitter for WebSocketsEventEmitter {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> backend::BackendResult<()> {
        // Get next sequence number for ordering
        let sequence = self.sequence_counter.fetch_add(1, Ordering::SeqCst);
        
        // Create WebSocket event message with sequence number for ordering
        let ws_event = WebSocketEvent {
            event: event.to_string(),
            payload,
            sequence,
        };
        
        // Serialize to JSON
        let message = serde_json::to_string(&ws_event)
            .map_err(|e| backend::BackendError::SerializationError(e))?;
            
        // Broadcast asynchronously (frontend can sort by sequence number if needed)
        let ws_manager = self.ws_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = ws_manager.broadcast(message).await {
                eprintln!("❌ Failed to broadcast WebSocket event: {}", e);
            }
        });
        
        Ok(())
    }
}

// =====================================
// Application State
// =====================================

struct AppState {
    backend: Arc<Mutex<GeminiBackend<WebSocketsEventEmitter>>>,
    ws_manager: WebSocketManager,
}

// =====================================
// Request/Response Types
// =====================================

#[derive(Serialize, Deserialize)]
struct StartSessionRequest {
    session_id: String,
}

#[derive(Serialize, Deserialize)]
struct SendMessageRequest {
    session_id: String,
    message: String,
    conversation_history: String,
    working_directory: Option<String>,
    model: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct KillProcessRequest {
    conversation_id: String,
}

#[derive(Serialize, Deserialize)]
struct ToolConfirmationRequest {
    session_id: String,
    request_id: u32,
    tool_call_id: String,
    outcome: String,
}

#[derive(Serialize, Deserialize)]
struct ExecuteCommandRequest {
    command: String,
}

#[derive(Serialize, Deserialize)]
struct GenerateTitleRequest {
    message: String,
    model: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ValidateDirectoryRequest {
    path: String,
}

#[derive(Serialize, Deserialize)]
struct IsHomeDirectoryRequest {
    path: String,
}

/// Serves the frontend for Gemini Desktop from the embedded built files.
#[get("/<path..>")]
fn index(path: PathBuf) -> Result<(ContentType, &'static [u8]), Status> {
    let mut path = path.to_str().unwrap().trim();
    if path.is_empty() {
        path = "index.html";
    }

    let file = FRONTEND_DIR.get_file(path).ok_or(Status::NotFound)?;

    Ok((
        ContentType::from_extension(path.split('.').last().unwrap()).unwrap(),
        file.contents(),
    ))
}

// =====================================
// Backend API Routes
// =====================================

#[get("/check-cli-installed")]
async fn check_cli_installed(state: &State<AppState>) -> Json<Result<bool, String>> {
    let backend = state.backend.lock().await;
    match backend.check_cli_installed().await {
        Ok(result) => Json(Ok(result)),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/start-session", data = "<request>")]
async fn start_session(request: Json<StartSessionRequest>, state: &State<AppState>) -> Json<Result<(), String>> {
    let _request = request; // Use the parameter to avoid warning
    // For compatibility with existing frontend, just check if CLI is installed
    let backend = state.backend.lock().await;
    match backend.check_cli_installed().await {
        Ok(available) => {
            if available {
                Json(Ok(()))
            } else {
                Json(Err("Gemini CLI not available".to_string()))
            }
        },
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/send-message", data = "<request>")]
async fn send_message(request: Json<SendMessageRequest>, state: &State<AppState>) -> Json<Result<(), String>> {
    let req = request.into_inner();
    
    // Initialize session if working directory or model are provided
    if let (Some(_wd), Some(model_name)) = (req.working_directory, req.model) {
        let backend = state.backend.lock().await;
        match backend.initialize_session(req.session_id.clone(), None, model_name).await {
            Ok(_) => {},
            Err(e) => return Json(Err(e.to_string())),
        }
    }

    let backend = state.backend.lock().await;
    match backend.send_message(req.session_id, req.message, req.conversation_history).await {
        Ok(_) => Json(Ok(())),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[get("/process-statuses")]
async fn get_process_statuses(state: &State<AppState>) -> Json<Result<Vec<ProcessStatus>, String>> {
    let backend = state.backend.lock().await;
    match backend.get_process_statuses() {
        Ok(statuses) => Json(Ok(statuses)),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/kill-process", data = "<request>")]
async fn kill_process(request: Json<KillProcessRequest>, state: &State<AppState>) -> Json<Result<(), String>> {
    let backend = state.backend.lock().await;
    match backend.kill_process(&request.conversation_id) {
        Ok(_) => Json(Ok(())),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/tool-confirmation", data = "<request>")]
async fn send_tool_call_confirmation_response(request: Json<ToolConfirmationRequest>, state: &State<AppState>) -> Json<Result<(), String>> {
    let req = request.into_inner();
    let backend = state.backend.lock().await;
    match backend.handle_tool_confirmation(req.session_id, req.request_id, req.tool_call_id, req.outcome).await {
        Ok(_) => Json(Ok(())),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/execute-command", data = "<request>")]
async fn execute_confirmed_command(request: Json<ExecuteCommandRequest>, state: &State<AppState>) -> Json<Result<String, String>> {
    let backend = state.backend.lock().await;
    match backend.execute_confirmed_command(request.command.clone()).await {
        Ok(output) => Json(Ok(output)),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/generate-title", data = "<request>")]
async fn generate_conversation_title(request: Json<GenerateTitleRequest>, state: &State<AppState>) -> Json<Result<String, String>> {
    let req = request.into_inner();
    let backend = state.backend.lock().await;
    match backend.generate_conversation_title(req.message, req.model).await {
        Ok(title) => Json(Ok(title)),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/validate-directory", data = "<request>")]
async fn validate_directory(request: Json<ValidateDirectoryRequest>, state: &State<AppState>) -> Json<Result<bool, String>> {
    let backend = state.backend.lock().await;
    match backend.validate_directory(request.path.clone()).await {
        Ok(valid) => Json(Ok(valid)),
        Err(e) => Json(Err(e.to_string())),
    }
}

#[post("/is-home-directory", data = "<request>")]
async fn is_home_directory(request: Json<IsHomeDirectoryRequest>, state: &State<AppState>) -> Json<Result<bool, String>> {
    let backend = state.backend.lock().await;
    match backend.is_home_directory(request.path.clone()).await {
        Ok(is_home) => Json(Ok(is_home)),
        Err(e) => Json(Err(e.to_string())),
    }
}

// =====================================
// WebSocket Route Handler
// =====================================

#[get("/ws")]
fn websocket_handler(ws: WebSocket, state: &State<AppState>) -> Stream!['static] {
    let ws_manager = state.ws_manager.clone();
    
    Stream! { ws =>
        // Create a channel for this WebSocket connection to receive backend events
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        
        // Register this connection with the manager  
        ws_manager.add_connection(tx).await;
        println!("📡 New WebSocket connection established");
        
        // Simple event forwarding loop - just handle outgoing backend events for now
        while let Some(backend_msg) = rx.recv().await {
            yield Message::text(backend_msg);
        }
        
        println!("📡 WebSocket connection terminated");
    }
}

#[rocket::launch]
fn rocket() -> _ {
    // Create WebSocket manager and backend with WebSockets event emitter
    let ws_manager = WebSocketManager::new();
    let emitter = WebSocketsEventEmitter::new(ws_manager.clone());
    let backend = GeminiBackend::new(emitter);
    
    // Store in app state
    let app_state = AppState {
        backend: Arc::new(Mutex::new(backend)),
        ws_manager,
    };
    
    rocket::custom(
        rocket::Config::figment()
            .merge(("port", 1858))
            .merge(("address", "0.0.0.0")),
    )
    .manage(app_state)
    .mount("/", routes![index, websocket_handler])
    .mount("/api", routes![
        check_cli_installed,
        start_session,
        send_message,
        get_process_statuses,
        kill_process,
        send_tool_call_confirmation_response,
        execute_confirmed_command,
        generate_conversation_title,
        validate_directory,
        is_home_directory
    ])
}

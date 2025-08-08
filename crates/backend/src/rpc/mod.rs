use crate::types::{BackendError, BackendResult};
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::sync::{Arc, Mutex};

pub fn deserialize_string_or_number<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNumber {
        String(String),
        Number(u32),
    }

    match StringOrNumber::deserialize(deserializer)? {
        StringOrNumber::String(s) => s
            .parse::<u32>()
            .map_err(|_| serde::de::Error::custom(format!("invalid u32 string: {s}"))),
        StringOrNumber::Number(n) => Ok(n),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u32,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u32,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

pub trait RpcLogger: Send + Sync {
    fn log_rpc(&self, message: &str) -> Result<(), std::io::Error>;
}

pub struct ProjectHasher;

impl ProjectHasher {
    pub fn hash_path(path: &str) -> BackendResult<String> {
        let canonical_path = std::path::Path::new(path)
            .canonicalize()
            .map_err(BackendError::IoError)?;

        let mut hasher = Sha256::new();
        hasher.update(canonical_path.to_string_lossy().as_bytes());
        let hash = format!("{:x}", hasher.finalize());
        Ok(hash)
    }
}

pub struct FileRpcLogger {
    writer: Arc<Mutex<BufWriter<File>>>,
    file_path: std::path::PathBuf,
}

impl FileRpcLogger {
    pub fn new(working_directory: Option<&str>) -> BackendResult<Self> {
        let project_dir = working_directory.map(|s| s.to_string()).unwrap_or_else(|| {
            std::env::current_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .to_string_lossy()
                .to_string()
        });

        let project_hash = ProjectHasher::hash_path(&project_dir)?;

        let home_dir = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

        let log_dir = std::path::Path::new(&home_dir)
            .join(".gemini-desktop")
            .join("projects")
            .join(&project_hash);

        fs::create_dir_all(&log_dir).map_err(BackendError::IoError)?;

        // Note: ensure_project_metadata will be called from projects module
        let _ = crate::projects::ensure_project_metadata(
            &project_hash,
            Some(std::path::Path::new(&project_dir)),
        );

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        let log_filename = format!("rpc-log-{timestamp}.log");
        let file_path = log_dir.join(log_filename);

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(BackendError::IoError)?;

        let writer = Arc::new(Mutex::new(BufWriter::new(file)));

        Ok(Self { writer, file_path })
    }

    pub fn cleanup_old_logs(&self) -> Result<(), std::io::Error> {
        let parent_dir = self.file_path.parent().unwrap();
        let cutoff_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            - (30 * 24 * 60 * 60);

        if let Ok(entries) = fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
                if let Some(filename) = entry.file_name().to_str()
                    && filename.starts_with("rpc-log-")
                    && filename.ends_with(".log")
                    && let Ok(metadata) = entry.metadata()
                    && let Ok(modified) = metadata.modified()
                    && let Ok(modified_secs) = modified.duration_since(std::time::UNIX_EPOCH)
                    && modified_secs.as_secs() < cutoff_time
                {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }

        Ok(())
    }
}

impl RpcLogger for FileRpcLogger {
    fn log_rpc(&self, message: &str) -> Result<(), std::io::Error> {
        let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let log_line = format!("[{timestamp}] {message}\n");

        if let Ok(mut writer) = self.writer.lock() {
            writer.write_all(log_line.as_bytes())?;
            writer.flush()?;
        }

        Ok(())
    }
}

pub struct NoOpRpcLogger;

impl RpcLogger for NoOpRpcLogger {
    fn log_rpc(&self, _message: &str) -> Result<(), std::io::Error> {
        Ok(())
    }
}

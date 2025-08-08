use thiserror::Error;

pub type BackendResult<T> = Result<T, BackendError>;

#[derive(Error, Debug)]
pub enum BackendError {
    #[error("Session initialization failed: {0}")]
    SessionInitFailed(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Process not found")]
    ProcessNotFound,

    #[error("Command not allowed for security reasons")]
    CommandNotAllowed,

    #[error("Command execution failed: {0}")]
    CommandExecutionFailed(String),

    #[error("JSON serialization error: {0}")]
    JsonError(String),

    #[error("Channel communication error")]
    ChannelError,

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Path error: {0}")]
    PathError(String),

    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

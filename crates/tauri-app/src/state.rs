use std::sync::Arc;
use backend::GeminiBackend;
use crate::event_emitter::TauriEventEmitter;

pub struct AppState {
    pub backend: Arc<GeminiBackend<TauriEventEmitter>>,
}
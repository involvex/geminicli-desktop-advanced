use crate::types::BackendResult;
use crate::{models, mcp_registry, themes};
use std::collections::HashMap;

/// Extension methods for GeminiBackend
impl<E: crate::EventEmitter + 'static> crate::GeminiBackend<E> {
    /// Auto-discover available models from all sources
    pub async fn auto_discover_models(&self) -> BackendResult<HashMap<String, Vec<models::ModelInfo>>> {
        models::auto_discover_models().await
    }

    /// Get available model sources
    pub async fn get_model_sources(&self) -> BackendResult<Vec<models::ModelSource>> {
        models::get_model_sources().await
    }

    /// Search MCP servers
    pub async fn search_mcp_servers(&self, query: Option<String>) -> BackendResult<Vec<mcp_registry::McpServerInfo>> {
        mcp_registry::search_mcp_servers(query).await
    }

    /// Get popular MCP servers
    pub async fn get_popular_mcp_servers(&self, limit: usize) -> BackendResult<Vec<mcp_registry::McpServerInfo>> {
        mcp_registry::get_popular_mcp_servers(limit).await
    }

    /// Get MCP categories
    pub fn get_mcp_categories(&self) -> Vec<String> {
        mcp_registry::get_mcp_categories()
    }

    /// Save a custom theme
    pub async fn save_theme(&self, theme: themes::CustomTheme) -> BackendResult<()> {
        themes::save_theme(theme).await
    }

    /// Load a custom theme
    pub async fn load_theme(&self, name: &str) -> BackendResult<themes::CustomTheme> {
        themes::load_theme(name).await
    }

    /// List all custom themes
    pub async fn list_themes(&self) -> BackendResult<Vec<String>> {
        themes::list_themes().await
    }

    /// Delete a custom theme
    pub async fn delete_theme(&self, name: &str) -> BackendResult<()> {
        themes::delete_theme(name).await
    }

    /// Get theme presets
    pub fn get_theme_presets(&self) -> Vec<themes::ThemePreset> {
        themes::get_theme_presets()
    }

    /// Export theme as CSS
    pub async fn export_theme_css(&self, theme: &themes::CustomTheme, output_path: &str) -> BackendResult<()> {
        themes::export_theme_css(theme, output_path).await
    }
}
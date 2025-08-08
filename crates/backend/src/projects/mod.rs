use crate::types::{BackendError, BackendResult};
use chrono::{DateTime, FixedOffset, Local};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectListItem {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastActivityAt")]
    pub last_activity_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "logCount")]
    pub log_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectsResponse {
    pub items: Vec<ProjectListItem>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMetadata {
    pub path: PathBuf,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub friendly_name: Option<String>,
    #[serde(default)]
    pub first_used: Option<DateTime<FixedOffset>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<FixedOffset>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadataView {
    pub path: String,
    pub sha256: String,
    pub friendly_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedProject {
    pub sha256: String,
    pub root_path: PathBuf,
    pub metadata: ProjectMetadataView,
}

#[derive(Default, Clone)]
pub struct TouchThrottle {
    inner: Arc<Mutex<HashMap<PathBuf, Instant>>>,
    min_interval: Duration,
}

impl TouchThrottle {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            min_interval,
        }
    }
}

fn home_projects_root() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));
    if home.is_empty() {
        return None;
    }
    Some(Path::new(&home).join(".gemini-desktop").join("projects"))
}

fn projects_root_dir() -> Option<PathBuf> {
    home_projects_root()
}

fn project_json_path(sha256: &str) -> Option<PathBuf> {
    projects_root_dir().map(|root| root.join(sha256).join("project.json"))
}

fn now_fixed_offset() -> DateTime<FixedOffset> {
    let now = Local::now();
    now.with_timezone(now.offset())
}

fn derive_friendly_name_from_path(path: &Path) -> String {
    let s = path.display().to_string();
    #[cfg(windows)]
    {
        let replaced = s.replace('\\', "-").replace(':', "");
        replaced
            .split('-')
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("-")
    }
    #[cfg(not(windows))]
    {
        let replaced = s.replace('/', "-");
        replaced
            .split('-')
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("-")
    }
}

fn parse_millis_from_log_name(name: &str) -> Option<u64> {
    if !name.starts_with("rpc-log-") {
        return None;
    }
    let rest = name.strip_prefix("rpc-log-")?;
    let ts_part = rest
        .strip_suffix(".log")
        .or_else(|| rest.strip_suffix(".json"))?;
    ts_part.parse::<u64>().ok()
}

fn read_project_metadata(root_sha: &str) -> BackendResult<ProjectMetadata> {
    let Some(path) = project_json_path(root_sha) else {
        return Err(BackendError::ProjectNotFound(
            "projects root not found".to_string(),
        ));
    };
    if !path.exists() {
        return Err(BackendError::ProjectNotFound(
            "project.json not found".to_string(),
        ));
    }
    let content = std::fs::read_to_string(&path).map_err(BackendError::IoError)?;
    serde_json::from_str::<ProjectMetadata>(&content)
        .map_err(|e| BackendError::JsonError(e.to_string()))
}

fn write_project_metadata(sha256: &str, meta: &ProjectMetadata) -> BackendResult<()> {
    let Some(json_path) = project_json_path(sha256) else {
        return Err(BackendError::ProjectNotFound(
            "projects root not found".to_string(),
        ));
    };
    if let Some(dir) = json_path.parent() {
        std::fs::create_dir_all(dir).map_err(BackendError::IoError)?;
    }
    let tmp_path = json_path.with_extension("json.tmp");
    let content =
        serde_json::to_string_pretty(meta).map_err(|e| BackendError::JsonError(e.to_string()))?;
    std::fs::write(&tmp_path, content.as_bytes()).map_err(BackendError::IoError)?;
    std::fs::rename(&tmp_path, &json_path).map_err(BackendError::IoError)?;
    Ok(())
}

fn to_view(meta: &ProjectMetadata, canonical_root: &Path, sha256: &str) -> ProjectMetadataView {
    let friendly = meta
        .friendly_name
        .clone()
        .unwrap_or_else(|| derive_friendly_name_from_path(canonical_root));
    let first_used = meta.first_used.as_ref().map(|d| d.to_rfc3339());
    let updated_at = meta.updated_at.as_ref().map(|d| d.to_rfc3339());
    ProjectMetadataView {
        path: meta.path.display().to_string(),
        sha256: meta.sha256.clone().unwrap_or_else(|| sha256.to_string()),
        friendly_name: friendly,
        first_used,
        updated_at,
    }
}

pub fn ensure_project_metadata(
    sha256: &str,
    external_root_canonical: Option<&Path>,
) -> BackendResult<ProjectMetadata> {
    match read_project_metadata(sha256) {
        Ok(meta) => Ok(meta),
        Err(e) => {
            if let Some(ext) = external_root_canonical {
                let now = now_fixed_offset();
                let meta = ProjectMetadata {
                    path: ext.to_path_buf(),
                    sha256: Some(sha256.to_string()),
                    friendly_name: Some(derive_friendly_name_from_path(ext)),
                    first_used: Some(now),
                    updated_at: Some(now),
                };
                write_project_metadata(sha256, &meta)?;
                eprintln!("info: created project.json for {sha256}");
                Ok(meta)
            } else {
                Err(e)
            }
        }
    }
}

pub fn maybe_touch_updated_at(sha256: &str, throttle: &TouchThrottle) -> BackendResult<()> {
    let mut meta = match read_project_metadata(sha256) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };

    let root = meta.path.clone();
    let mut guard = throttle.inner.lock().unwrap();
    let last = guard.get(&root).copied();
    let now_inst = Instant::now();
    if let Some(last_instant) = last
        && now_inst.duration_since(last_instant) < throttle.min_interval
    {
        return Ok(());
    }
    guard.insert(root, now_inst);
    drop(guard);

    meta.updated_at = Some(now_fixed_offset());
    write_project_metadata(sha256, &meta)?;
    eprintln!("debug: touched updated_at for {sha256}");
    Ok(())
}

pub fn make_enriched_project(
    sha256: &str,
    external_root: Option<&Path>,
    should_create_if_missing: bool,
) -> EnrichedProject {
    let meta_opt = read_project_metadata(sha256).ok();

    let display_root = if let Some(ref meta) = meta_opt {
        meta.path.clone()
    } else if let Some(er) = external_root {
        er.to_path_buf()
    } else {
        projects_root_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(sha256)
    };

    let meta = if let Some(meta) = meta_opt {
        meta
    } else if should_create_if_missing {
        ensure_project_metadata(sha256, external_root).unwrap_or_else(|_| ProjectMetadata {
            path: display_root.clone(),
            sha256: Some(sha256.to_string()),
            friendly_name: Some(derive_friendly_name_from_path(&display_root)),
            first_used: None,
            updated_at: None,
        })
    } else {
        ProjectMetadata {
            path: display_root.clone(),
            sha256: Some(sha256.to_string()),
            friendly_name: Some(derive_friendly_name_from_path(&display_root)),
            first_used: None,
            updated_at: None,
        }
    };

    EnrichedProject {
        sha256: sha256.to_string(),
        root_path: display_root.clone(),
        metadata: to_view(&meta, &display_root, sha256),
    }
}

pub fn list_projects(limit: u32, offset: u32) -> BackendResult<ProjectsResponse> {
    let Some(root) = home_projects_root() else {
        return Ok(ProjectsResponse {
            items: vec![],
            total: 0,
            limit,
            offset,
        });
    };
    if !root.exists() || !root.is_dir() {
        return Ok(ProjectsResponse {
            items: vec![],
            total: 0,
            limit,
            offset,
        });
    }

    let mut all_ids: Vec<String> = Vec::new();
    for entry in fs::read_dir(&root).map_err(BackendError::IoError)? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str())
            && name.len() == 64
            && name.chars().all(|c| c.is_ascii_hexdigit())
        {
            all_ids.push(name.to_string());
        }
    }
    all_ids.sort();

    let total = all_ids.len() as u32;
    let start = std::cmp::min(offset as usize, all_ids.len());
    let end = std::cmp::min(start + limit as usize, all_ids.len());
    let page_ids = &all_ids[start..end];

    let mut items: Vec<ProjectListItem> = Vec::new();
    for id in page_ids {
        let proj_path = root.join(id);

        let mut log_count: u32 = 0;
        let mut earliest_ts_millis: Option<u64> = None;
        let mut latest_ts_millis: Option<u64> = None;
        let mut latest_mtime_secs: Option<u64> = None;

        if let Ok(rd) = fs::read_dir(&proj_path) {
            for e in rd.flatten() {
                let p = e.path();
                let fname_opt = p.file_name().and_then(|s| s.to_str());
                if let Some(fname) = fname_opt
                    && fname.starts_with("rpc-log-")
                    && (fname.ends_with(".log") || fname.ends_with(".json"))
                {
                    log_count = log_count.saturating_add(1);

                    if let Some(millis) = parse_millis_from_log_name(fname) {
                        earliest_ts_millis = match earliest_ts_millis {
                            Some(cur) => Some(cur.min(millis)),
                            None => Some(millis),
                        };
                        latest_ts_millis = match latest_ts_millis {
                            Some(cur) => Some(cur.max(millis)),
                            None => Some(millis),
                        };
                    }

                    if let Ok(md) = e.metadata()
                        && let Ok(modified) = md.modified()
                        && let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH)
                    {
                        let secs = dur.as_secs();
                        latest_mtime_secs =
                            Some(latest_mtime_secs.map_or(secs, |cur| cur.max(secs)));
                    }
                }
            }
        }

        let created_at_iso: Option<String> = earliest_ts_millis.map(|ms| {
            let secs = ms / 1000;
            chrono::DateTime::<chrono::Utc>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let updated_at_iso_from_name: Option<String> = latest_ts_millis.map(|ms| {
            let secs = ms / 1000;
            chrono::DateTime::<chrono::Utc>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let last_activity_iso_from_mtime: Option<String> = latest_mtime_secs.map(|secs| {
            chrono::DateTime::<chrono::Utc>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let updated_at_iso = updated_at_iso_from_name
            .clone()
            .or_else(|| last_activity_iso_from_mtime.clone());
        let last_activity_iso = updated_at_iso_from_name.or(last_activity_iso_from_mtime);

        let title: Option<String> = None;

        let status = if log_count > 0 {
            "active".to_string()
        } else {
            "unknown".to_string()
        };

        items.push(ProjectListItem {
            id: id.clone(),
            title,
            status: Some(status),
            created_at: created_at_iso,
            updated_at: updated_at_iso.clone(),
            last_activity_at: last_activity_iso,
            log_count: Some(log_count),
        });
    }

    Ok(ProjectsResponse {
        items,
        total,
        limit,
        offset,
    })
}

pub fn list_enriched_projects() -> BackendResult<Vec<EnrichedProject>> {
    let Some(root) = home_projects_root() else {
        return Ok(vec![]);
    };
    if !root.exists() || !root.is_dir() {
        return Ok(vec![]);
    }
    let mut all_ids: Vec<String> = Vec::new();
    for entry in fs::read_dir(&root).map_err(BackendError::IoError)? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str())
            && name.len() == 64
            && name.chars().all(|c| c.is_ascii_hexdigit())
        {
            all_ids.push(name.to_string());
        }
    }
    all_ids.sort();

    let mut results = Vec::new();
    for sha256 in all_ids {
        results.push(make_enriched_project(&sha256, None, false));
    }
    Ok(results)
}

pub async fn get_enriched_project(
    sha256: String,
    external_root_path: String,
) -> BackendResult<EnrichedProject> {
    let external_root = Path::new(&external_root_path);
    Ok(make_enriched_project(&sha256, Some(external_root), true))
}

use crate::types::BackendResult;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VolumeType {
    LocalDisk,
    RemovableDisk,
    NetworkDrive,
    CdDrive,
    RamDisk,
    FileSystem,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
    pub full_path: String,
    pub size: Option<u64>,
    pub modified: Option<u64>,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub volume_type: Option<VolumeType>,
}

pub async fn validate_directory(path: String) -> BackendResult<bool> {
    let path = Path::new(&path);
    Ok(path.exists() && path.is_dir())
}

pub async fn is_home_directory(path: String) -> BackendResult<bool> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    let home_path = Path::new(&home);
    let check_path = Path::new(&path);

    Ok(home_path == check_path)
}

pub async fn get_home_directory() -> BackendResult<String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    Ok(home)
}

pub async fn get_parent_directory(path: String) -> BackendResult<Option<String>> {
    let path = Path::new(&path);
    Ok(path.parent().map(|p| p.to_string_lossy().to_string()))
}

pub async fn list_directory_contents(path: String) -> BackendResult<Vec<DirEntry>> {
    let mut entries = Vec::new();
    let dir_path = Path::new(&path);

    if !dir_path.exists() || !dir_path.is_dir() {
        return Ok(entries);
    }

    let read_dir = std::fs::read_dir(dir_path)?;

    for entry in read_dir {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let full_path = entry.path().to_string_lossy().to_string();

        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs());

        let size = if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        };

        let is_symlink = metadata.is_symlink();
        let symlink_target = if is_symlink {
            std::fs::read_link(entry.path())
                .ok()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        entries.push(DirEntry {
            name: file_name,
            is_directory: metadata.is_dir(),
            full_path,
            size,
            modified,
            is_symlink,
            symlink_target,
            volume_type: None,
        });
    }

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

pub async fn list_volumes() -> BackendResult<Vec<DirEntry>> {
    let mut volumes = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let output = Command::new("wmic")
            .args(["logicaldisk", "get", "name,volumename,drivetype,size"])
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                let drive_letter = parts[0];
                let drive_type = parts
                    .get(1)
                    .and_then(|s| s.parse::<u32>().ok())
                    .unwrap_or(0);

                let volume_type = match drive_type {
                    2 => VolumeType::RemovableDisk,
                    3 => VolumeType::LocalDisk,
                    4 => VolumeType::NetworkDrive,
                    5 => VolumeType::CdDrive,
                    6 => VolumeType::RamDisk,
                    _ => VolumeType::LocalDisk,
                };

                let volume_name = parts.get(2..).map(|p| p.join(" ")).unwrap_or_default();
                let display_name = if volume_name.is_empty() {
                    drive_letter.to_string()
                } else {
                    format!("{volume_name} ({drive_letter})")
                };

                volumes.push(DirEntry {
                    name: display_name,
                    is_directory: true,
                    full_path: format!("{drive_letter}\\"),
                    size: None,
                    modified: None,
                    is_symlink: false,
                    symlink_target: None,
                    volume_type: Some(volume_type),
                });
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        volumes.push(DirEntry {
            name: "Root (/)".to_string(),
            is_directory: true,
            full_path: "/".to_string(),
            size: None,
            modified: None,
            is_symlink: false,
            symlink_target: None,
            volume_type: Some(VolumeType::FileSystem),
        });

        if let Ok(home) = std::env::var("HOME") {
            volumes.push(DirEntry {
                name: "Home".to_string(),
                is_directory: true,
                full_path: home,
                size: None,
                modified: None,
                is_symlink: false,
                symlink_target: None,
                volume_type: Some(VolumeType::FileSystem),
            });
        }
    }

    Ok(volumes)
}

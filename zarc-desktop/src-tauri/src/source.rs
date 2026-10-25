use super::*;

pub(super) fn selected_sources(
    paths: &[String],
    fallback: &str,
    state: Option<&AppState>,
) -> Result<Vec<PathBuf>> {
    let fallback = [fallback.to_string()];
    let paths = if paths.is_empty() {
        &fallback[..]
    } else {
        paths
    };
    let mut selected: Vec<(PathBuf, PathBuf)> = Vec::new();
    let mut seen = HashSet::new();
    let mut directories: Vec<PathBuf> = Vec::new();
    for path in paths {
        check_abort(state)?;
        let path = PathBuf::from(path.trim());
        if path.as_os_str().is_empty() {
            continue;
        }
        let access = fs_access_path(&path)?;
        let metadata = fs::metadata(&access)
            .with_context(|| format!("源路径不存在或无法访问: {}", path.display()))?;
        let canonical = fs::canonicalize(&access)?;
        if !seen.insert(canonical.clone())
            || directories
                .iter()
                .any(|directory| canonical.starts_with(directory))
        {
            continue;
        }
        if metadata.is_dir() {
            selected.retain(|(_, existing)| !existing.starts_with(&canonical));
            directories.retain(|directory| !directory.starts_with(&canonical));
            directories.push(canonical.clone());
        }
        selected.push((path, canonical));
    }
    if selected.is_empty() {
        bail!("请选择待压缩的文件或目录");
    }
    Ok(selected.into_iter().map(|(path, _)| path).collect())
}

pub(super) struct CollectionSource {
    pub path: PathBuf,
    pub name: PathBuf,
    pub directory: Option<DirectoryPlan>,
}

pub(super) struct CollectionPlan {
    pub sources: Vec<CollectionSource>,
    pub source_bytes: u64,
}

impl CollectionPlan {
    pub fn read(paths: &[PathBuf], state: Option<&AppState>) -> Result<Self> {
        let mut names = HashSet::new();
        let mut sources = Vec::new();
        let mut source_bytes = 0u64;
        for path in paths {
            check_abort(state)?;
            let metadata = fs::metadata(fs_access_path(path)?)?;
            let original = PathBuf::from(
                path.file_name()
                    .unwrap_or_else(|| std::ffi::OsStr::new("root")),
            );
            let mut name = original.clone();
            let mut number = 2;
            while !names.insert(name.to_string_lossy().to_lowercase()) {
                let mut renamed = if metadata.is_dir() {
                    original.as_os_str().to_os_string()
                } else {
                    original
                        .file_stem()
                        .unwrap_or(original.as_os_str())
                        .to_os_string()
                };
                renamed.push(format!(" ({number})"));
                if !metadata.is_dir() {
                    if let Some(extension) = original.extension() {
                        renamed.push(".");
                        renamed.push(extension);
                    }
                }
                name = PathBuf::from(renamed);
                number += 1;
            }
            let directory = if metadata.is_dir() {
                Some(DirectoryPlan::read(path, state)?)
            } else {
                None
            };
            source_bytes = source_bytes.saturating_add(
                directory
                    .as_ref()
                    .map_or(metadata.len(), |plan| plan.source_bytes),
            );
            sources.push(CollectionSource {
                path: path.clone(),
                name,
                directory,
            });
        }
        Ok(Self {
            sources,
            source_bytes,
        })
    }
}

pub(super) struct SourceEntry {
    pub relative: PathBuf,
    pub file_type: fs::FileType,
    pub size: u64,
}

/// 单次任务共用有序清单，统计与打包无需重复遍历。 / Share one ordered scan between sizing and packing.
pub(super) struct DirectoryPlan {
    pub root: PathBuf,
    pub entries: Vec<SourceEntry>,
    pub source_bytes: u64,
}

impl DirectoryPlan {
    pub fn read(source: &Path, state: Option<&AppState>) -> Result<Self> {
        let root = fs_access_path(source)?;
        let mut entries = Vec::new();
        let mut source_bytes = 0u64;
        for entry in WalkDir::new(&root).min_depth(1).sort_by_file_name() {
            check_abort(state)?;
            let entry = entry.context("遍历待压缩目录失败，归档已中止")?;
            let file_type = entry.file_type();
            let size = if file_type.is_file() {
                entry.metadata()?.len()
            } else {
                0
            };
            source_bytes = source_bytes.saturating_add(size);
            entries.push(SourceEntry {
                relative: entry.path().strip_prefix(&root)?.to_path_buf(),
                file_type,
                size,
            });
        }
        check_abort(state)?;
        Ok(Self {
            root,
            entries,
            source_bytes,
        })
    }
}

use super::*;

/// 手动运行：cargo test --lib performance_fixture -- --ignored --nocapture --test-threads=1
/// Run manually with the command above; fixtures and output live in a temp directory.
#[test]
#[ignore]
fn performance_fixture() {
    let temp = tempfile::tempdir().unwrap();
    let fixtures = std::env::var_os("ZARC_PERF_FIXTURE")
        .map(PathBuf::from)
        .unwrap_or_else(|| temp.path().to_path_buf());
    fs::create_dir_all(&fixtures).unwrap();
    let small = fixtures.join("small");
    if !small.exists() {
        fs::create_dir(&small).unwrap();
        for index in 0..4000 {
            fs::write(
                small.join(format!("file-{index:05}.txt")),
                format!(
                    "{index}: archive performance fixture; repeated text and structured records.\n"
                )
                .repeat(20),
            )
            .unwrap();
        }
    }
    let large = fixtures.join("large.bin");
    if !large.exists() {
        let block: Vec<u8> = (0..64 * 1024)
            .map(|i| ((i * 31 + i / 4096) % 251) as u8)
            .collect();
        let mut file = File::create(&large).unwrap();
        for _ in 0..512 {
            file.write_all(&block).unwrap();
        }
        drop(file);
    }
    for (name, source) in [("small", &small), ("large", &large)] {
        for round in 0..7 {
            let output = temp.path().join(format!(
                "{name}-{round}{}",
                if source.is_dir() { ".tar.zst" } else { ".zst" }
            ));
            let started = Instant::now();
            let compressed = compress_archive_sync(
                CompressRequest {
                    source_paths: Vec::new(),
                    archive_name: None,
                    output_directory: None,
                    source_path: path_to_string(source),
                    output_path: Some(path_to_string(&output)),
                    output_kind: Some(OutputKind::Archive),
                    level: Some(3),
                    include_root_dir: Some(false),
                    password: None,
                    split_size_mib: None,
                    enable_logging: Some(false),
                    delete_source_after: Some(false),
                    threads: None,
                },
                None,
                None,
            )
            .unwrap();
            let compress_ms = started.elapsed().as_secs_f64() * 1000.0;
            let started = Instant::now();
            let restored = decompress_archive_sync(
                DecompressRequest {
                    archive_path: compressed.output_path,
                    output_path: Some(path_to_string(
                        &temp.path().join(format!("restored-{name}-{round}")),
                    )),
                    password: None,
                },
                None,
                None,
            )
            .unwrap();
            let decompress_ms = started.elapsed().as_secs_f64() * 1000.0;
            assert_eq!(restored.output_bytes, compressed.source_bytes);
            if round > 0 {
                println!("PERF {name} round={round} compress_ms={compress_ms:.3} decompress_ms={decompress_ms:.3} source_bytes={} archive_bytes={}", compressed.source_bytes, compressed.output_bytes);
            }
        }
    }
}

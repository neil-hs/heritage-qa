CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filepath TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  file_type TEXT NOT NULL, -- TIFF, RAW, JPEG, PNG
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exif_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  tag_name TEXT NOT NULL,
  tag_value TEXT,
  FOREIGN KEY (image_id) REFERENCES images(id),
  UNIQUE(image_id, tag_name)
);

CREATE TABLE validation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL,
  validation_run INTEGER NOT NULL,
  check_type TEXT NOT NULL, -- jhove, exif, dimension, color, naming
  status TEXT NOT NULL, -- pass, fail, warning, skip
  severity TEXT, -- critical, fixable, warning
  message TEXT,
  details TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id)
);

CREATE TABLE validation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL,
  config_hash TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  total_images INTEGER,
  passed INTEGER,
  failed INTEGER
);

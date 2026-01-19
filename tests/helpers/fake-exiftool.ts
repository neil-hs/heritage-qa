import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRIPT = `#!/bin/sh
require_tag() {
  if [ -z "$FAKE_EXIFTOOL_REQUIRE_TAG" ]; then
    return 0
  fi
  for arg in "$@"; do
    if [ "$arg" = "$FAKE_EXIFTOOL_REQUIRE_TAG" ]; then
      return 0
    fi
  done
  echo "Missing tag" 1>&2
  exit 2
}

for arg in "$@"; do
  if [ "$arg" = "-ver" ]; then
    echo "\${FAKE_EXIFTOOL_VERSION:-12.70}"
    exit 0
  fi
done

require_tag "$@"

files=""
next_is_argfile=0
for arg in "$@"; do
  if [ "$next_is_argfile" -eq 1 ]; then
    files=$(cat "$arg")
    next_is_argfile=0
    continue
  fi
  if [ "$arg" = "-@" ]; then
    next_is_argfile=1
  fi
done

if [ -z "$files" ]; then
  last=""
  for arg in "$@"; do
    last="$arg"
  done
  files="$last"
fi

printf "["
first=1
IFS="
"
for f in $files; do
  if [ $first -eq 0 ]; then printf ","; fi
  printf '{"SourceFile":"%s","EXIF:ImageWidth":100}' "$f"
  first=0
done
printf "]"

if [ -n "$FAKE_EXIFTOOL_STDERR" ]; then
  printf "%s" "$FAKE_EXIFTOOL_STDERR" 1>&2
fi
exit \${FAKE_EXIFTOOL_EXIT_CODE:-0}
`;

export function createFakeExifTool(): { binDir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "fake-exiftool-"));
  const binPath = join(dir, "exiftool");
  writeFileSync(binPath, SCRIPT, "utf8");
  chmodSync(binPath, 0o755);
  return {
    binDir: dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

export function prependPath(dir: string): () => void {
  const original = process.env.PATH ?? "";
  process.env.PATH = `${dir}:${original}`;
  return () => {
    process.env.PATH = original;
  };
}

export function setFakeExifToolEnv(options: {
  requireTag?: string;
  exitCode?: number;
  stderr?: string;
  version?: string;
}): void {
  if (options.requireTag !== undefined) {
    process.env.FAKE_EXIFTOOL_REQUIRE_TAG = options.requireTag;
  }
  if (options.exitCode !== undefined) {
    process.env.FAKE_EXIFTOOL_EXIT_CODE = String(options.exitCode);
  }
  if (options.stderr !== undefined) {
    process.env.FAKE_EXIFTOOL_STDERR = options.stderr;
  }
  if (options.version !== undefined) {
    process.env.FAKE_EXIFTOOL_VERSION = options.version;
  }
}

export function clearFakeExifToolEnv(): void {
  delete process.env.FAKE_EXIFTOOL_REQUIRE_TAG;
  delete process.env.FAKE_EXIFTOOL_EXIT_CODE;
  delete process.env.FAKE_EXIFTOOL_STDERR;
  delete process.env.FAKE_EXIFTOOL_VERSION;
}

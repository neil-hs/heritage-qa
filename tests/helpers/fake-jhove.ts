import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRIPT = "#!/bin/sh\n" +
"\n" +
"# If checking version (no arguments or explicit check)\n" +
"# But standard JHOVE usage in wrapper is just running it or checking help.\n" +
"# Our wrapper runs 'jhove' with args.\n" +
"\n" +
"# Check for empty args (version check simulation)\n" +
"if [ $# -eq 0 ]; then\n" +
"  echo \"JHOVE ${FAKE_JHOVE_VERSION:-1.28.0}\"\n" +
"  exit 0\n" +
"fi\n" +
"\n" +
"# Generate XML\n" +
"printf '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
"<jhove xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" name=\"JHOVE\" release=\"1.28.0\" date=\"2024-01-01\">\n" +
" <date>2024-01-01T12:00:00</date>\n" +
"'" +
"\n" +
"# Iterate through arguments to find files\n" +
"# We ignore flags like -h xml -m TIFF-hul\n" +
"for arg in \"$@\"; do\n" +
"  case \"$arg\" in\n" +
"    -*) ;; # Ignore flags\n" +
"    *) \n" +
"      # Assume it is a file\n" +
"      STATUS=\"${FAKE_JHOVE_STATUS:-Well-Formed and valid}\"\n" +
"      FORMAT=\"${FAKE_JHOVE_FORMAT:-TIFF-hul}\"\n" +
"      VERSION=\"${FAKE_JHOVE_FORMAT_VERSION:-1.0}\"\n" +
"      \n" +
"      printf '  <repInfo uri=\"%s\">\n" +
"   <status>%s</status>\n" +
"   <format>%s</format>\n" +
"   <version>%s</version>\n" +
"   <sigMatches>\n" +
"   </sigMatches>\n" +
"   <messages>\n" +
"' \"$arg\" \"$STATUS\" \"$FORMAT\" \"$VERSION\"\n" +
"\n" +
"      if [ -n \"$FAKE_JHOVE_ERROR\" ]; then\n" +
"        printf '    <message severity=\"error\">%s</message>\\n' \"$FAKE_JHOVE_ERROR\"\n" +
"      fi\n" +
"      if [ -n \"$FAKE_JHOVE_WARNING\" ]; then\n" +
"        printf '    <message severity=\"warning\">%s</message>\\n' \"$FAKE_JHOVE_WARNING\"\n" +
"      fi\n" +
"      \n" +
"      printf '   </messages>\n" +
"   <mimeType>image/tiff</mimeType>\n" +
"  </repInfo>\n" +
"'\n" +
"      ;; \n" +
"  esac\n" +
"done\n" +
"\n" +
"printf '</jhove>'\n" +
"\n" +
"if [ -n \"$FAKE_JHOVE_STDERR\" ]; then\n" +
"  printf \"%s\" \"$FAKE_JHOVE_STDERR\" 1>&2\n" +
"fi\n" +
"exit ${FAKE_JHOVE_EXIT_CODE:-0}\n";

export function createFakeJhove(): { binDir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "fake-jhove-"));
  const binPath = join(dir, "jhove");
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

export function setFakeJhoveEnv(options: {
  status?: string;
  format?: string;
  version?: string;
  error?: string;
  warning?: string;
  exitCode?: number;
  stderr?: string;
  jhoveVersion?: string;
}): void {
  if (options.status !== undefined) process.env.FAKE_JHOVE_STATUS = options.status;
  if (options.format !== undefined) process.env.FAKE_JHOVE_FORMAT = options.format;
  if (options.version !== undefined) process.env.FAKE_JHOVE_FORMAT_VERSION = options.version;
  if (options.error !== undefined) process.env.FAKE_JHOVE_ERROR = options.error;
  if (options.warning !== undefined) process.env.FAKE_JHOVE_WARNING = options.warning;
  if (options.exitCode !== undefined) process.env.FAKE_JHOVE_EXIT_CODE = String(options.exitCode);
  if (options.stderr !== undefined) process.env.FAKE_JHOVE_STDERR = options.stderr;
  if (options.jhoveVersion !== undefined) process.env.FAKE_JHOVE_VERSION = options.jhoveVersion;
}

export function clearFakeJhoveEnv(): void {
  delete process.env.FAKE_JHOVE_STATUS;
  delete process.env.FAKE_JHOVE_FORMAT;
  delete process.env.FAKE_JHOVE_FORMAT_VERSION;
  delete process.env.FAKE_JHOVE_ERROR;
  delete process.env.FAKE_JHOVE_WARNING;
  delete process.env.FAKE_JHOVE_EXIT_CODE;
  delete process.env.FAKE_JHOVE_STDERR;
  delete process.env.FAKE_JHOVE_VERSION;
}

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES=(core templates plugins cli)
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$ROOT"

node --input-type=module <<'NODE'
import fs from "node:fs";

const packages = ["core", "templates", "plugins", "cli"];
const expectedNames = {
  core: "@nodedesk/core",
  templates: "@nodedesk/templates",
  plugins: "@nodedesk/plugins",
  cli: "@nodedesk/cli"
};
const expectedInternalDependencies = {
  core: {},
  templates: { "@nodedesk/core": "0.1.0" },
  plugins: { "@nodedesk/core": "0.1.0" },
  cli: {
    "@nodedesk/core": "0.1.0",
    "@nodedesk/templates": "0.1.0"
  }
};
const required = [
  "name",
  "version",
  "description",
  "license",
  "repository",
  "homepage",
  "bugs",
  "keywords",
  "engines",
  "files",
  "exports"
];

for (const directory of packages) {
  const file = `packages/${directory}/package.json`;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  const missing = required.filter((key) => pkg[key] === undefined);
  if (directory === "cli" && pkg.bin === undefined) missing.push("bin");
  if (pkg.name !== expectedNames[directory]) missing.push("name");
  if (pkg.version !== "0.1.0") missing.push("version");
  if (pkg.private !== false) missing.push("private=false");
  if (JSON.stringify(pkg).includes("workspace:*")) missing.push("no workspace:*");
  const internalDependencies = Object.fromEntries(
    Object.entries(pkg.dependencies ?? {}).filter(([name]) => name.startsWith("@nodedesk/"))
  );
  if (JSON.stringify(internalDependencies) !== JSON.stringify(expectedInternalDependencies[directory])) {
    missing.push("internal publishable dependencies");
  }
  if (missing.length > 0) {
    throw new Error(`${file}: ${missing.join(", ")}`);
  }
}
NODE

for package in "${PACKAGES[@]}"; do
  (cd "packages/$package" && pnpm pack --pack-destination "$TMP_DIR" >/dev/null)
done

for package in "${PACKAGES[@]}"; do
  archive="$(find "$TMP_DIR" -maxdepth 1 -type f -name "*-${package}-0.1.0.tgz" -print -quit)"
  if [[ -z "$archive" ]]; then
    echo "Missing tarball for packages/$package" >&2
    exit 1
  fi

  extracted="$TMP_DIR/extracted/$package"
  mkdir -p "$extracted"
  tar -xzf "$archive" -C "$extracted"
  package_root="$extracted/package"

  for required_file in package.json README.md LICENSE; do
    [[ -f "$package_root/$required_file" ]] || {
      echo "Missing $required_file in $archive" >&2
      exit 1
    }
  done
  [[ -d "$package_root/dist" ]] || {
    echo "Missing dist in $archive" >&2
    exit 1
  }

  if find "$package_root" -type d \( -name src -o -name tests -o -name scripts -o -name node_modules \) -print -quit | grep -q .; then
    echo "Unexpected source, test, script, or node_modules directory in $archive" >&2
    exit 1
  fi
  if find "$package_root" -type f -name '*.tgz' -print -quit | grep -q .; then
    echo "Unexpected TGZ in $archive" >&2
    exit 1
  fi
  legacy_a='Node'
  legacy_b='Deck'
  legacy_c='@node'
  legacy_d='deck'
  legacy_e='Node'
  legacy_f='Sk'

  legacy_pattern="${legacy_a}${legacy_b}|${legacy_c}${legacy_d}|${legacy_b,,}${legacy_d}|${legacy_e}${legacy_f}|@${legacy_e,,}${legacy_f,,}|node[[:space:]-]*sk"

  if grep -RniE "$legacy_pattern" "$package_root" >/dev/null; then
    echo "Legacy NodeDesk naming found in $archive" >&2
    exit 1
  fi
  if grep -q 'workspace:\*' "$package_root/package.json"; then
    echo "workspace:* found in published package.json for $archive" >&2
    exit 1
  fi

done

echo "CI package check passed: ${#PACKAGES[@]} publishable tarballs verified."

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pnpm dev [-- [--plugins <config.yaml>]]

Start the OSAC proxy and frontend. Plugins are not loaded unless a YAML config
is passed with --plugins. HTTP plugin frontend and BFF URLs require
PLUGINS_INSECURE=1. Paths are resolved relative to osac-ui/.
EOF
}

plugins_config=""
if (($# > 0)) && [[ "$1" == "--" ]]; then
  shift
fi

while (($# > 0)); do
  case "$1" in
    --plugins)
      if [[ -n "$plugins_config" || $# -lt 2 || "$2" == --* ]]; then
        usage >&2
        exit 2
      fi
      plugins_config="$2"
      shift 2
      ;;
    --plugins=*)
      if [[ -n "$plugins_config" ]]; then
        usage >&2
        exit 2
      fi
      plugins_config="${1#*=}"
      if [[ -z "$plugins_config" ]]; then
        usage >&2
        exit 2
      fi
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown dev option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

proxy_command="pnpm dev:proxy"
if [[ -n "$plugins_config" ]]; then
  if [[ ! -f "$plugins_config" ]]; then
    printf 'Plugin config not found: %s\n' "$plugins_config" >&2
    exit 2
  fi
  if [[ "$plugins_config" != /* ]]; then
    plugins_config="$(cd "$(dirname "$plugins_config")" && pwd -P)/$(basename "$plugins_config")"
  fi
  printf -v escaped_plugins_config '%q' "$plugins_config"
  proxy_command+=" -- --plugin ${escaped_plugins_config}"
fi
exec pnpm exec concurrently "$proxy_command" "pnpm --filter @osac/app-frontend run dev"

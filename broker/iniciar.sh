#!/usr/bin/env bash
set -euo pipefail

mkdir -p /tmp/qawapmayu-mosquitto && exec mosquitto -c "$(dirname "$0")/mosquitto.conf" -v

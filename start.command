#!/bin/sh
cd "$(dirname "$0")" || exit 1
python3 offline_server.py --open

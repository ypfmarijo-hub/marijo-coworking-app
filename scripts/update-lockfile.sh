#!/bin/bash
# Update pnpm lockfile
cd /vercel/share/v0-project
pnpm install --frozen-lockfile=false

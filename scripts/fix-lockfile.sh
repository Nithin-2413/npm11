#!/bin/bash
cd /vercel/share/v0-project
rm -f package-lock.json
npm install --package-lock-only

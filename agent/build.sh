#!/bin/sh
# Собирает agent/friends-agent.jar без внешних зависимостей (только JDK).
set -e
cd "$(dirname "$0")"
rm -rf build && mkdir -p build
javac --release 25 -d build src/BeluvuFriendsAgent.java src/KeyHook.java
printf 'Premain-Class: BeluvuFriendsAgent\n' > build/MANIFEST.MF
jar cfm friends-agent.jar build/MANIFEST.MF -C build .
rm -rf build
echo "built friends-agent.jar"

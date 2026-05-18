#!/bin/bash
set -euo pipefail

echo "===================================================="
echo "   TDLib High-Performance Build Script for Debian"
echo "===================================================="

# Check if running on Debian/Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "OS Detected: $NAME ($VERSION)"
else
    echo "Warning: OS release file not found. Assuming Debian-like environment."
fi

# Ensure running with root privileges for package installation
if [ "$EUID" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        echo ">>> Re-running script with sudo for root privileges..."
        exec sudo "$0" "$@"
    else
        echo "Error: This script must be run as root or with sudo. Please run: sudo $0"
        exit 1
    fi
fi

# 1. Install dependencies non-interactively
echo ">>> Updating package lists and installing dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    make \
    git \
    zlib1g-dev \
    libssl-dev \
    gperf \
    php-cli \
    cmake \
    clang \
    libc++-dev \
    libc++abi-dev \
    build-essential

# 2. Get safe number of parallel build jobs
echo ">>> Determining optimal build configuration..."
CORES=$(nproc)
# Get total memory in megabytes
if [ -f /proc/meminfo ]; then
    TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    TOTAL_MEM_GB=$((TOTAL_MEM / 1024 / 1024))
else
    TOTAL_MEM_GB=4
fi

# TDLib compilation is heavy. Allocate ~2GB RAM per compilation job to prevent Out-Of-Memory crashes.
SAFE_JOBS=$((TOTAL_MEM_GB / 2))
if [ "$SAFE_JOBS" -lt 1 ]; then
    SAFE_JOBS=1
fi
if [ "$SAFE_JOBS" -gt "$CORES" ]; then
    SAFE_JOBS=$CORES
fi

echo "System Specs: $CORES Cores, ${TOTAL_MEM_GB}GB RAM"
echo "Build configuration: Using $SAFE_JOBS parallel job(s) for compilation."

# 3. Clone and build TDLib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_DIR"

if [ ! -d "td" ]; then
    echo ">>> Cloning TDLib repository..."
    git clone https://github.com/tdlib/td.git
fi

cd td
echo ">>> Cleaning up previous builds..."
rm -rf build tdlib
mkdir build
cd build

echo ">>> Running CMake configuration..."
CXXFLAGS="-stdlib=libc++" CC=/usr/bin/clang CXX=/usr/bin/clang++ cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX:PATH=../../tdlib \
    ..

echo ">>> Compiling TDLib (this may take 20-50 minutes depending on your CPU)..."
cmake --build . --target install -- -j "$SAFE_JOBS"

cd ../..

echo "===================================================="
echo "🎉 TDLib Build Complete!"
echo "===================================================="
if [ -d "tdlib" ]; then
    echo "Install directory contents:"
    ls -la tdlib
    echo ""
    echo "Compiled libtdjson.so path:"
    find "$(pwd)/tdlib" -name "libtdjson.so"
else
    echo "Error: tdlib installation folder not found!"
    exit 1
fi
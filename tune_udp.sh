# System quick fix for QUIC UDP buffer error
# Run as root to increase UDP buffer sizes
sysctl -w net.core.rmem_max=67108864
sysctl -w net.core.wmem_max=67108864
ulimit -n 1048576
echo "Tuned UDP buffers and file descriptors"
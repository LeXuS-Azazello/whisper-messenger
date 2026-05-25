FROM alpine:3.20
# Install tar (already present) and make sure permissions are sane
WORKDIR /models/whisper
COPY whisper/ .

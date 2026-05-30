FROM python:3.10-slim

WORKDIR /app

# Install modelscope
RUN pip install --no-cache-dir modelscope

# Create entrypoint script
RUN echo '#!/bin/bash\nexec "$@"' > /entrypoint.sh && \
    chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

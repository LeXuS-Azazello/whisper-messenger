import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "GET /health" not in record.getMessage()

logger = logging.getLogger("uvicorn.access")
logger.addFilter(EndpointFilter())
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
logger.addHandler(ch)

logger.info('%s:%d - "%s %s HTTP/%s" %d', '10.0.0.1', 1234, 'GET', '/health', '1.1', 200)
logger.info('%s:%d - "%s %s HTTP/%s" %d', '10.0.0.1', 1234, 'GET', '/api', '1.1', 200)

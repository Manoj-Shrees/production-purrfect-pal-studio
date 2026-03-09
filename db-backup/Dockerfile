FROM alpine:latest

RUN apk add --no-cache mysql-client dcron git bash

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
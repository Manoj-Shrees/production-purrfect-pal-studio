# Extends the official Certbot image with docker-cli so the deploy
# hook can run 'docker exec nginx-proxy nginx -s reload' after renewal.
FROM certbot/certbot:latest

RUN apk add --no-cache docker-cli

COPY deploy-hook.sh /deploy-hook.sh
RUN chmod +x /deploy-hook.sh
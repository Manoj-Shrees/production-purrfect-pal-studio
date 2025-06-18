# Use Node.js base image
FROM node:22-slim


# Base install (already in your Dockerfile)
RUN apt-get update && apt-get install -y git docker.io curl

# Add docker-compose (legacy Python binary)
RUN curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose \
  && chmod +x /usr/local/bin/docker-compose

# Set working directory
WORKDIR /app

# Copy the webhook script and package.json if any
COPY . .

# Expose webhook port
EXPOSE 3000

# Start the webhook server
CMD ["node", "deploy.js"]

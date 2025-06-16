
# Use Node.js base image
FROM node:22-slim


# Install git and docker CLI
RUN apt-get update && apt-get install -y git docker.io

# Set working directory
WORKDIR /app

# Copy the webhook script and package.json if any
COPY . .


# Expose webhook port
EXPOSE 3000

# Start the webhook server
CMD ["node", "index.js"]

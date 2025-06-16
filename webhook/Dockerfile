
# Use Node.js base image
FROM node:22-slim


# Install git
RUN apt-get update && apt-get install -y git

# Create app directory
WORKDIR /app

# Copy files (your webhook server script)
COPY . .

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]

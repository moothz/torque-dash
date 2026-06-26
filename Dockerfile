FROM node:22-alpine

# Install build dependencies if needed, though bcryptjs doesn't require them
RUN apk add --no-cache bash

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose the internal port (defaulting to 3000)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

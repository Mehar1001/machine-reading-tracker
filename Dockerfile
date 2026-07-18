FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules if needed
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the web port
EXPOSE 8081

# Start the dev server
CMD ["npm", "start", "--web"]

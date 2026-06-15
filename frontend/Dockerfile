FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the application files
COPY . .

EXPOSE 3000

ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "dev"]

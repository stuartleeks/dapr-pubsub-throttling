# Build typescript code in docker
FROM node:18-alpine

WORKDIR /app

RUN npm install -g typescript

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy code and run typescript compilation step
COPY . .
RUN tsc


EXPOSE 3000

CMD [ "node", "dist/index.js" ]
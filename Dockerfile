FROM ubuntu:24.04

# Set non-interactive mode for apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Install required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \ 
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set up Node.js environment variables
ENV NODE_VERSION=20.15.0 \
    NVM_VERSION=0.39.7 \
    NVM_DIR=/usr/local/nvm

# Install NVM, Node.js, and npm
RUN mkdir -p $NVM_DIR \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v$NVM_VERSION/install.sh | bash \
    && bash -c ". $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm alias default $NODE_VERSION && nvm use default" \
    && bash -c ". $NVM_DIR/nvm.sh && node -v && npm -v"

# Add Node.js and npm to PATH
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Verify installation
RUN node -v && npm -v

# Set working directory
WORKDIR /src

# Copy package.json and install dependencies
COPY package.json .
RUN npm install --production

# Add a non-root user
RUN useradd --create-home --shell /bin/bash --uid 1001 node

# Copy application code and adjust permissions
COPY --chown=node:node . .



# Switch to non-root user
USER node

# Default command
CMD ["node", "index.mjs"]


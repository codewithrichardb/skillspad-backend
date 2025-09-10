#!/bin/bash
# Exit on error
set -e

# Install the correct Node.js version
NODE_VERSION=18.x
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install $NODE_VERSION
nvm use $NODE_VERSION

# Install dependencies
npm install --force

echo "Build completed successfully!"

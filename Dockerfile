FROM node:18-alpine

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install --production

# Copie des fichiers source
COPY . .

# Exposition du port
EXPOSE 8080

# Démarrage de l'application
CMD ["npm", "start"] 
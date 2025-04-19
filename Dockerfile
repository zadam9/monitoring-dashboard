FROM node:18-alpine

WORKDIR /app

# Installation des outils nécessaires pour l'analyse de sécurité
RUN apk add --no-cache \
    curl \
    procps \
    net-tools \
    findutils \
    grep \
    iputils \
    iproute2 \
    nmap \
    openssh-client \
    bash

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install --production

# Copie des fichiers source
COPY . .

# Création des répertoires pour les montages hosts
RUN mkdir -p /host/etc /host/proc /host/sys /host/var/log

# Exposition du port
EXPOSE 8080

# Démarrage de l'application
CMD ["npm", "start"]

# LaborEssence - Dashboard de Monitoring Docker

Un dashboard de monitoring en temps réel pour superviser les containers Docker et les ressources système sur une VM AWS.

![LaborEssence Dashboard](https://i.imgur.com/placeholder-image.png)

## Fonctionnalités

- 📊 Visualisation en temps réel des containers Docker
- 📈 Suivi des ressources système (RAM, CPU, uptime)
- 📋 Consultation des logs Docker (stdout/stderr)
- 🔒 Vérification du statut HTTPS
- 🔄 Actualisation automatique via WebSockets

## Technologies utilisées

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
  - Chart.js pour les graphiques
  - Socket.io pour les mises à jour en temps réel
- **Backend**: Node.js avec Express
  - Dockerode pour l'interaction avec l'API Docker
  - Socket.io pour les WebSockets
- **Déploiement**: Docker, GitHub Actions

## Prérequis

- Docker et Docker Compose
- Node.js 14+
- Un serveur avec accès à l'API Docker

## Installation locale

```bash
# Cloner le dépôt
git clone https://github.com/votre-utilisateur/monitoring-dashboard.git
cd monitoring-dashboard

# Installer les dépendances
npm install

# Démarrer en mode développement
npm run dev
```

## Déploiement

### Avec Docker Compose

```bash
# Construire et démarrer le container
docker-compose up -d

# Vérifier que le container fonctionne
docker ps
```

### Déploiement manuel

```bash
# Construire l'image Docker
docker build -t dashboard .

# Lancer le container
docker run -d -p 8080:8080 -v /var/run/docker.sock:/var/run/docker.sock --name dashboard dashboard
```

## Utilisation

Accédez au dashboard via http://[IP-SERVEUR]:8080

## Structure du projet

```
monitoring-dashboard/
├── public/               # Assets frontend
│   ├── index.html        # Page HTML principale
│   ├── style.css         # Styles CSS
│   └── script.js         # JavaScript frontend
├── src/
│   └── server.js         # API backend Express
├── Dockerfile            # Configuration Docker
├── docker-compose.yml    # Configuration Docker Compose
├── package.json          # Dépendances Node.js
├── .github/workflows/    # GitHub Actions CI/CD
└── README.md
```

## Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou proposer une pull request.

## Licence

[MIT](LICENSE)

---

Développé par Adam | [Github](https://github.com/zadam9) 
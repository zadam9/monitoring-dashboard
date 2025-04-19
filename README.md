# LaborEssence - Dashboard de Monitoring Docker

Un tableau de bord de monitoring en temps réel pour surveiller vos containers Docker, les ressources système et les statuts des sites web.

![Dashboard Screenshot](https://via.placeholder.com/800x400?text=LaborEssence+Dashboard)

## Fonctionnalités

- 📊 **Monitoring en temps réel** : Suivi des ressources système (CPU, RAM, uptime)
- 🐳 **Gestion des containers Docker** : Liste des containers avec états et informations détaillées
- 📝 **Accès aux logs** : Visualisation et copie des logs de chaque container
- 🌐 **Statut des sites web** : Vérification de l'activité de vos services web et HTTPS
- 📈 **Graphiques** : Visualisation graphique de l'utilisation des ressources
- 🌓 **Mode sombre/clair** : Interface adaptable selon vos préférences
- ⚠️ **Système d'alertes** : Notifications en cas d'utilisation excessive des ressources
- 📤 **Exportation de rapports** : Génération de rapports sur l'état actuel du système

## Prérequis

- Node.js (v14 ou supérieur)
- Docker installé et configuré
- Un serveur Linux, macOS ou Windows avec Docker Engine

## Installation

1. Clonez le dépôt :
   ```
   git clone https://github.com/votre-username/monitoring-dashboard.git
   cd monitoring-dashboard
   ```

2. Installez les dépendances :
   ```
   npm install
   ```

3. Démarrez l'application :
   ```
   npm start
   ```
   
   Ou utilisez Docker :
   ```
   docker-compose up -d
   ```

4. Accédez au dashboard dans votre navigateur :
   ```
   http://localhost:8080
   ```

## Déploiement

Ce projet est configuré pour un déploiement automatique via CI/CD. À chaque push sur la branche principale, le système redéploie automatiquement l'application.

## Configuration

Vous pouvez personnaliser le dashboard en modifiant les variables d'environnement :

- `PORT` : Port d'écoute du serveur (8080 par défaut)
- `TARGET_WEBSITE` : Site à surveiller (aitalla.cloud par défaut)

## Développement

- `npm run dev` : Démarrer en mode développement avec hot-reload
- `npm test` : Exécuter les tests
- `npm run build` : Construire pour la production

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou proposer une pull request.

## Licence

[MIT](LICENSE)

## Auteur

Créé avec ❤️ par Adam 
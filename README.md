# Motor - Dashboard de Monitoring Docker

Un dashboard moderne pour surveiller vos conteneurs Docker et services en temps réel.

## 🚧 En cours de développement

Le site [dashboard.aitalla.cloud](https://dashboard.aitalla.cloud) est actuellement en cours de construction. Certaines fonctionnalités peuvent ne pas être disponibles ou être en cours de développement.

## Fonctionnalités

- Surveillance en temps réel des conteneurs Docker
- Métriques système (CPU, Mémoire, Disque)
- Historique des performances
- Audit de sécurité (en cours de développement)
- Interface utilisateur moderne et responsive
- Mode sombre/clair
- Export de rapports

## Installation

1. Clonez le dépôt :
```bash
git clone https://github.com/votre-utilisateur/monitoring-dashboard.git
```

2. Installez les dépendances :
```bash
cd monitoring-dashboard
npm install
```

3. Configurez les variables d'environnement :
```bash
cp .env.example .env
# Modifiez les valeurs dans .env selon votre configuration
```

4. Démarrez le serveur :
```bash
npm start
```

## Utilisation avec Docker

1. Construisez l'image :
```bash
docker-compose build
```

2. Démarrez les conteneurs :
```bash
docker-compose up -d
```

## Configuration

Le dashboard peut être configuré via les variables d'environnement suivantes :

- `PORT` : Port d'écoute du serveur (défaut: 8080)
- `API_KEY` : Clé API pour sécuriser les appels (défaut: labordashboard2024)
- `EMAIL_USER` : Email pour les notifications
- `EMAIL_PASSWORD` : Mot de passe de l'email
- `ADMIN_EMAIL` : Email de l'administrateur

## Développement

Pour contribuer au projet :

1. Créez une branche pour votre fonctionnalité :
```bash
git checkout -b feature/ma-nouvelle-fonctionnalite
```

2. Committez vos changements :
```bash
git commit -m "feat: ajout de ma nouvelle fonctionnalité"
```

3. Poussez vers GitHub :
```bash
git push origin feature/ma-nouvelle-fonctionnalite
```

4. Créez une Pull Request

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Contact

Pour toute question ou suggestion, contactez-nous à [contact@aitalla.cloud](mailto:adam.aitalla9@gmail.com)
Je vous invite à voir mon portfolio à https://aitalla.cloud

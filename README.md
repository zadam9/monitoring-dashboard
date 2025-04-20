# Motor - Dashboard de Monitoring Docker

Un tableau de bord de monitoring en temps réel pour surveiller vos containers Docker, les ressources système et les statuts des sites web.

![Dashboard Screenshot](https://via.placeholder.com/800x400?text=Motor+Dashboard)

## Fonctionnalités

- 📊 **Monitoring en temps réel** : Suivi des ressources système (CPU, RAM, uptime)
- 🐳 **Gestion des containers Docker** : Liste des containers avec états et informations détaillées
- 📝 **Accès aux logs** : Visualisation et copie des logs de chaque container
- 🌐 **Statut des sites web** : Vérification de l'activité de vos services web et HTTPS
- 📈 **Graphiques** : Visualisation graphique de l'utilisation des ressources
- 🔒 **Sécurité système réelle** : Analyse des vulnérabilités, ports ouverts et utilisateurs root de votre VM
- 🌓 **Mode sombre/clair** : Interface adaptable selon vos préférences
- ⚠️ **Système d'alertes** : Notifications en cas d'utilisation excessive des ressources
- 📤 **Exportation de rapports** : Génération de rapports sur l'état actuel du système

## Designs disponibles

Le projet propose deux designs d'interface différents :

1. **Design classique** (branche `main`) - Interface verticale traditionnelle, simple et fonctionnelle
2. **Design moderne** (branche `redesign-modern`) - Interface avec sidebar, charts améliorés et fonctionnalités supplémentaires

### Comment changer de design

Pour basculer entre les deux designs, utilisez les commandes Git suivantes :

```bash
# Pour le design classique
git checkout main

# Pour le design moderne
git checkout redesign-modern
```

Ensuite, redémarrez l'application pour appliquer le changement.

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

2. Choisissez le design souhaité :
   ```
   git checkout main     # Pour le design classique
   git checkout redesign-modern  # Pour le design moderne
   ```

3. Installez les dépendances :
   ```
   npm install
   ```

4. Démarrez l'application :
   ```
   npm start
   ```
   
   Ou utilisez Docker :
   ```
   docker-compose up -d
   ```

5. Accédez au dashboard dans votre navigateur :
   ```
   http://localhost:8080
   ```

## Déploiement

Ce projet est configuré pour un déploiement automatique via CI/CD. À chaque push sur la branche principale, le système redéploie automatiquement l'application.

## Configuration

Vous pouvez personnaliser le dashboard en modifiant les variables d'environnement :

- `PORT` : Port d'écoute du serveur (8080 par défaut)
- `TARGET_WEBSITE` : Site à surveiller (aitalla.cloud par défaut)

### Configuration du design moderne

Le design moderne offre des options supplémentaires :

- Personnalisation des couleurs
- Bascule du mode sombre/clair
- Disposition des widgets
- Seuils d'alertes ajustables

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

## Instructions pour lancer avec accès système réel

Pour que le dashboard puisse accéder aux informations système réelles (nécessaire pour l'onglet Sécurité), vous devez lancer le container avec des privilèges étendus :

```bash
# Construire l'image
docker build -t monitoring-dashboard .

# Lancer avec privilèges étendus pour accéder aux informations système
docker run -d --name monitoring-dashboard \
  -p 8080:8080 \
  --privileged \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc:/host/etc:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /var/log:/host/var/log:ro \
  monitoring-dashboard
```

Cela permet au container d'accéder :
- Au socket Docker pour contrôler les containers
- Aux fichiers système en lecture seule pour les analyses de sécurité
- Aux journaux système pour l'analyse des logs

### ⚠️ Avertissement de sécurité

L'utilisation du flag `--privileged` donne au container des permissions étendues sur la machine hôte. 
Utilisez cette configuration uniquement sur des environnements contrôlés comme votre VM de développement AWS.
En production, privilégiez une approche plus restrictive avec des permissions spécifiques.

## Onglet Sécurité

L'onglet Sécurité du dashboard surveille en temps réel les aspects de sécurité de votre infrastructure :

- **Score de sécurité** : Calcul dynamique basé sur les vulnérabilités détectées
- **Ports ouverts** : Détection des ports exposés avec évaluation des risques
- **Utilisateurs root** : Identification des comptes disposant de privilèges root
- **Services exposés** : Liste des services réseau accessibles 
- **Vulnérabilités** : Analyse automatique des failles potentielles
- **Fichiers modifiés** : Surveillance des fichiers système critiques récemment modifiés

L'application utilise des outils système standard (ss, netstat, nmap si disponible) pour collecter ces données directement depuis votre VM. Toutes les analyses sont effectuées en temps réel.

### Audit de sécurité

Vous pouvez déclencher manuellement un audit de sécurité approfondi via le bouton dédié. Cet audit effectue des vérifications supplémentaires :

- Analyse des ports avec nmap (si disponible)
- Vérification des processus avec privilèges élevés
- Analyse de l'état du pare-feu
- Détection des utilisateurs connectés 
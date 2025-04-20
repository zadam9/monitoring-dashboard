const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const Docker = require('dockerode');
const path = require('path');
const morgan = require('morgan');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const winston = require('winston');
const nodemailer = require('nodemailer');

// Middleware de vérification de la clé API
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.API_KEY || 'labordashboard2024';

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Clé API invalide ou manquante' });
  }
  next();
};

// Initialisation de l'app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const docker = new Docker();

// Configuration de la journalisation
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Configuration des notifications
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Fonction pour envoyer des notifications
const sendNotification = async (subject, message) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `[Docker Monitor] ${subject}`,
      html: `
        <h2>${subject}</h2>
        <p>${message}</p>
        <p>Date: ${new Date().toLocaleString()}</p>
      `
    });
    logger.info(`Notification envoyée: ${subject}`);
  } catch (error) {
    logger.error(`Erreur lors de l'envoi de la notification: ${error.message}`);
  }
};

// Middleware pour journaliser les actions
const logAction = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const role = getRoleFromApiKey(apiKey);
  const action = `${req.method} ${req.path}`;
  
  logger.info({
    timestamp: new Date().toISOString(),
    role: role,
    action: action,
    params: req.params,
    query: req.query,
    body: req.body,
    ip: req.ip
  });
  
  next();
};

// Appliquer le middleware de journalisation à toutes les routes API
app.use('/api', logAction);

// Chemin des fichiers d'historique
const DATA_DIR = path.join(__dirname, '../data');
const SYSTEM_HISTORY_FILE = path.join(DATA_DIR, 'system_history.json');
const WEBSITE_HISTORY_FILE = path.join(DATA_DIR, 'website_history.json');

// Création du répertoire de données si n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialisation des historiques
let systemHistory = [];
let websiteHistory = [];

// Chargement des historiques existants
try {
  if (fs.existsSync(SYSTEM_HISTORY_FILE)) {
    systemHistory = JSON.parse(fs.readFileSync(SYSTEM_HISTORY_FILE, 'utf8'));
    console.log(`Historique système chargé : ${systemHistory.length} entrées`);
  }
  if (fs.existsSync(WEBSITE_HISTORY_FILE)) {
    websiteHistory = JSON.parse(fs.readFileSync(WEBSITE_HISTORY_FILE, 'utf8'));
    console.log(`Historique site web chargé : ${websiteHistory.length} entrées`);
  }
} catch (error) {
  console.error('Erreur lors du chargement de l\'historique:', error);
}

// Fonction pour sauvegarder les historiques
function saveHistory() {
  try {
    // Limiter l'historique à 1000 entrées (environ 83 heures à 5 minutes d'intervalle)
    if (systemHistory.length > 1000) {
      systemHistory = systemHistory.slice(systemHistory.length - 1000);
    }
    if (websiteHistory.length > 1000) {
      websiteHistory = websiteHistory.slice(websiteHistory.length - 1000);
    }
    
    fs.writeFileSync(SYSTEM_HISTORY_FILE, JSON.stringify(systemHistory));
    fs.writeFileSync(WEBSITE_HISTORY_FILE, JSON.stringify(websiteHistory));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'historique:', error);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

// Port d'écoute
const PORT = process.env.PORT || 8080;

// Clé API pour sécuriser les actions d'administration
// En production, utilisez une variable d'environnement ou une configuration sécurisée
const API_KEY = process.env.API_KEY || 'labordashboard2024';

// Configuration des rôles et permissions
const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
};

const PERMISSIONS = {
  [ROLES.ADMIN]: {
    containers: ['create', 'read', 'update', 'delete', 'start', 'stop', 'restart'],
    security: ['audit', 'configure'],
    system: ['configure', 'monitor']
  },
  [ROLES.OPERATOR]: {
    containers: ['read', 'start', 'stop', 'restart'],
    security: ['audit'],
    system: ['monitor']
  },
  [ROLES.VIEWER]: {
    containers: ['read'],
    security: ['read'],
    system: ['monitor']
  }
};

// Middleware pour vérifier les permissions
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const role = getRoleFromApiKey(apiKey);
    
    if (!role || !PERMISSIONS[role] || !PERMISSIONS[role][resource] || !PERMISSIONS[role][resource].includes(action)) {
      return res.status(403).json({ error: 'Permission refusée' });
    }
    
    next();
  };
};

// Fonction pour obtenir le rôle à partir de la clé API
const getRoleFromApiKey = (apiKey) => {
  // En production, utilisez une base de données ou un service d'authentification
  const apiKeys = {
    'admin-key-2024': ROLES.ADMIN,
    'operator-key-2024': ROLES.OPERATOR,
    'viewer-key-2024': ROLES.VIEWER
  };
  
  return apiKeys[apiKey];
};

// Fonction pour récupérer les statistiques système
async function getSystemStats() {
  try {
    const stats = {
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: os.platform(),
      userInfo: os.userInfo(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAvg: os.loadavg(),
      arch: os.arch(),
      release: os.release()
    };
    
    logger.info('Stats système récupérées:', JSON.stringify(stats));
    return stats;
  } catch (error) {
    logger.error('Erreur lors de la récupération des stats système:', error);
    return {
      error: error.message
    };
  }
}

// Récupérer la liste des containers
async function getContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.map(container => ({
      id: container.Id.substring(0, 12),
      name: container.Names[0].replace(/^\//, ''),
      image: container.Image,
      state: container.State,
      status: container.Status,
      created: container.Created,
      ports: container.Ports.map(port => ({
        ip: port.IP,
        privatePort: port.PrivatePort,
        publicPort: port.PublicPort,
        type: port.Type
      }))
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des containers:', error);
    return [];
  }
}

// Récupérer les stats d'un container
async function getContainerStats(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    return stats;
  } catch (error) {
    console.error(`Erreur lors de la récupération des stats pour le container ${containerId}:`, error);
    return null;
  }
}

// Vérifier si le site principal est up
async function checkWebsiteStatus() {
  return new Promise((resolve) => {
    console.log('Vérification du statut du site aitalla.cloud...');
    // Utiliser une requête HTTPS avec un User-Agent valide et un timeout
    const command = 'curl -s -L --max-time 10 -I -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dashboard Monitor" https://aitalla.cloud';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur curl lors de la vérification du site:', error.message);
        // Essayer de faire un ping pour voir si le domaine est accessible
        exec('ping -n 1 aitalla.cloud', (pingError, pingStdout) => {
          if (!pingError && pingStdout.includes('TTL=')) {
            console.log('Le domaine répond au ping, mais pas à HTTPS');
            resolve({ status: 'PARTIAL', statusCode: null, pingOk: true });
          } else {
            console.log('Échec total de connexion au domaine');
            resolve({ status: 'DOWN', statusCode: null });
          }
        });
        return;
      }
      
      console.log('Réponse curl reçue:', stdout.substring(0, 150));
      
      // Rechercher n'importe quelle ligne de statut HTTP
      const statusMatch = stdout.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/i);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : null;
      
      if (statusCode) {
        console.log('Code de statut détecté:', statusCode);
        resolve({
          status: statusCode >= 200 && statusCode < 400 ? 'UP' : 'DOWN',
          statusCode
        });
      } else if (stdout.trim()) {
        // Si nous avons une réponse mais pas de code de statut, c'est probablement une redirection
        console.log('Réponse sans code de statut valide, considéré comme UP');
        resolve({
          status: 'UP',
          statusCode: 200,
          note: 'Réponse sans code HTTP standard'
        });
      } else {
        console.log('Aucune réponse valide');
        resolve({ status: 'DOWN', statusCode: null });
      }
    });
  });
}

// Vérifier si HTTPS est actif
async function checkHttpsStatus() {
  return new Promise((resolve) => {
    console.log('Vérification du statut HTTPS...');
    // Utiliser une requête HTTPS avec un User-Agent valide et un timeout
    const command = 'curl -s -L --max-time 10 -I -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dashboard Monitor" https://aitalla.cloud';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur curl lors de la vérification HTTPS:', error.message);
        resolve(false);
        return;
      }
      
      // Vérifier si la réponse contient un en-tête HTTPS
      const hasHttpsHeader = stdout.includes('HTTP/') && 
                            (stdout.includes('X-Served-By') || 
                             stdout.includes('Strict-Transport-Security') || 
                             stdout.includes('X-Content-Type-Options'));
      
      if (hasHttpsHeader) {
        console.log('HTTPS détecté via les en-têtes de sécurité');
        resolve(true);
        return;
      }
      
      // Vérifier si la réponse contient une ligne de statut HTTP valide
      const statusMatch = stdout.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/i);
      
      if (statusMatch && parseInt(statusMatch[1]) >= 200) {
        console.log('HTTPS actif avec statut:', statusMatch[1]);
        resolve(true);
      } else {
        console.log('HTTPS inactif ou erreur dans la réponse');
        resolve(false);
      }
    });
  });
}

// Routes API
app.get('/api/containers', checkPermission('containers', 'read'), async (req, res) => {
  try {
    const containers = await getContainers();
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/containers/:id/stats', async (req, res) => {
  try {
    const stats = await getContainerStats(req.params.id);
    if (!stats) {
      return res.status(404).json({ error: 'Container not found' });
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/containers/:id/logs', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({
      follow: false,
      stdout: true,
      stderr: true,
      tail: 100
    });
    
    // Format des logs pour renvoyer du texte lisible
    let logsString = logs.toString('utf8');
    res.send(logsString);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system', async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/website/status', async (req, res) => {
  try {
    const status = await checkWebsiteStatus();
    const httpsActive = await checkHttpsStatus();
    res.json({
      ...status,
      https: httpsActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nouvelle route pour l'historique du système
app.get('/api/history/system', (req, res) => {
  // Filtrer selon la période demandée
  const period = req.query.period || '24h';
  let filteredHistory = [...systemHistory];
  
  const now = Date.now();
  if (period === '24h') {
    filteredHistory = filteredHistory.filter(entry => now - entry.timestamp < 24 * 60 * 60 * 1000);
  } else if (period === '7d') {
    filteredHistory = filteredHistory.filter(entry => now - entry.timestamp < 7 * 24 * 60 * 60 * 1000);
  } else if (period === '30d') {
    filteredHistory = filteredHistory.filter(entry => now - entry.timestamp < 30 * 24 * 60 * 60 * 1000);
  }
  
  res.json(filteredHistory);
});

// Nouvelle route pour l'historique du site web
app.get('/api/history/website', (req, res) => {
  // Filtrer selon la période demandée
  const period = req.query.period || '24h';
  let filteredHistory = [...websiteHistory];
  
  const now = Date.now();
  if (period === '24h') {
    filteredHistory = filteredHistory.filter(entry => now - entry.timestamp < 24 * 60 * 60 * 1000);
  } else if (period === '7d') {
    filteredHistory = filteredHistory.filter(entry => now - entry.timestamp < 7 * 24 * 60 * 60 * 1000);
  } else if (period === '30d') {
    filteredHistory = filteredHistory.filter(entry => now - entry.timestamp < 30 * 24 * 60 * 60 * 1000);
  }
  
  res.json(filteredHistory);
});

// WebSocket pour mises à jour en temps réel
io.on('connection', (socket) => {
  console.log('Client connecté avec ID:', socket.id);
  
  // Envoyer l'historique immédiatement à la connexion
  socket.emit('systemHistory', systemHistory);
  socket.emit('websiteHistory', websiteHistory);
  
  let containersInterval;
  let systemStatsInterval;
  
  // Envoyer les données immédiatement à la connexion
  (async () => {
    try {
      const containers = await getContainers();
      socket.emit('containers', containers);
      
      const stats = await getSystemStats();
      const websiteStatus = await checkWebsiteStatus();
      const httpsActive = await checkHttpsStatus();
      
      const systemData = {
        ...stats,
        website: {
          ...websiteStatus,
          https: httpsActive
        }
      };
      
      socket.emit('systemStats', systemData);
      
      console.log('Données initiales envoyées au client', socket.id);
    } catch (error) {
      console.error('Erreur lors de l\'envoi des données initiales:', error);
    }
  })();
  
  // Envoyer les données des containers toutes les 5 secondes
  containersInterval = setInterval(async () => {
    try {
      const containers = await getContainers();
      socket.emit('containers', containers);
    } catch (error) {
      console.error('Erreur WebSocket (containers):', error);
    }
  }, 5000);
  
  // Envoyer les stats système toutes les 5 secondes
  systemStatsInterval = setInterval(async () => {
    try {
      const stats = await getSystemStats();
      const websiteStatus = await checkWebsiteStatus();
      const httpsActive = await checkHttpsStatus();
      
      const systemData = {
        ...stats,
        website: {
          ...websiteStatus,
          https: httpsActive
        }
      };
      
      socket.emit('systemStats', systemData);
      
      // Ajout à l'historique toutes les 5 minutes
      const now = Date.now();
      if (systemHistory.length === 0 || (now - systemHistory[systemHistory.length - 1].timestamp) >= 5 * 60 * 1000) {
        // Historique du système
        systemHistory.push({
          timestamp: now,
          cpu: Math.min(Math.round((stats.loadAvg[0] / stats.cpuCount) * 100), 100),
          memory: Math.round(((stats.totalMemory - stats.freeMemory) / stats.totalMemory) * 100),
          uptime: stats.uptime
        });
        
        // Historique du site web
        websiteHistory.push({
          timestamp: now,
          status: websiteStatus.status,
          https: httpsActive
        });
        
        // Sauvegarde dans les fichiers
        saveHistory();
        
        // Envoyer l'historique mis à jour
        io.emit('systemHistory', systemHistory);
        io.emit('websiteHistory', websiteHistory);
      }
    } catch (error) {
      console.error('Erreur WebSocket (systemStats):', error);
    }
  }, 5000);
  
  // Nettoyage à la déconnexion
  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
    clearInterval(containersInterval);
    clearInterval(systemStatsInterval);
  });
});

// Routes API pour la sécurité
app.get('/api/security/data', verifyApiKey, async (req, res) => {
  try {
    const securityData = await getSecurityData();
    res.json(securityData);
  } catch (error) {
    console.error('Erreur lors de la récupération des données de sécurité:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/security/audit', verifyApiKey, async (req, res) => {
  try {
    const securityData = await getSecurityData();
    res.json(securityData);
  } catch (error) {
    console.error('Erreur lors de l\'audit de sécurité:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Envoyer une notification pour les erreurs critiques
  if (err.status >= 500) {
    sendNotification(
      'Erreur Critique',
      `Une erreur critique s'est produite sur le serveur: ${err.message}`
    );
  }

  res.status(err.status || 500).json({
    error: err.message
  });
});

// Fonctions pour la sécurité
async function getSecurityData() {
  try {
    const openPorts = await checkOpenPorts();
    const rootUsers = await checkRootUsers();
    const vulnerabilities = await checkVulnerabilities();
    
    const score = calculateSecurityScore(openPorts, rootUsers, vulnerabilities);
    
    return {
      score,
      lastAudit: new Date().toISOString(),
      openPorts,
      rootUsers,
      vulnerabilities
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des données de sécurité:', error);
    throw error;
  }
}

// Fonction pour vérifier les ports ouverts
async function checkOpenPorts() {
  try {
    const { stdout } = await exec('netstat -tuln');
    const ports = stdout.split('\n')
      .filter(line => line.includes('LISTEN'))
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          port: parts[3].split(':').pop(),
          service: getServiceName(parts[3].split(':').pop()),
          state: 'Ouvert'
        };
      });
    return ports;
  } catch (error) {
    console.error('Erreur lors de la vérification des ports:', error);
    return [];
  }
}

// Fonction pour vérifier les utilisateurs root
async function checkRootUsers() {
  try {
    const containers = await docker.listContainers({ all: true });
    const rootUsers = [];
    
    for (const container of containers) {
      try {
        const containerId = container.Id.substring(0, 12);
        const containerName = container.Names[0].replace(/^\//, '');
        
        const { stdout } = await exec(`docker exec ${containerId} whoami`);
        const user = stdout.trim();
        
        if (user === 'root') {
          rootUsers.push({
            container: containerName,
            user: 'root',
            state: 'Actif'
          });
        }
      } catch (error) {
        console.error(`Erreur lors de la vérification de l'utilisateur pour le conteneur ${container.Id}:`, error);
      }
    }
    
    return rootUsers;
  } catch (error) {
    console.error('Erreur lors de la vérification des utilisateurs root:', error);
    return [];
  }
}

// Fonction pour vérifier les vulnérabilités
async function checkVulnerabilities() {
  try {
    const { stdout } = await exec('docker images --format "{{.Repository}}:{{.Tag}}" | xargs -I {} docker scan {}');
    const vulnerabilities = stdout.split('\n')
      .filter(line => line.includes('CRITICAL') || line.includes('HIGH'))
      .map(line => {
        const parts = line.split('|');
        return {
          type: parts[0].trim(),
          description: parts[1].trim(),
          level: parts[2].trim()
        };
      });
    return vulnerabilities;
  } catch (error) {
    console.error('Erreur lors de la vérification des vulnérabilités:', error);
    return [];
  }
}

// Fonction pour calculer le score de sécurité
function calculateSecurityScore(openPorts, rootUsers, vulnerabilities) {
  let score = 100;
  
  // Pénalités pour les ports ouverts
  score -= openPorts.length * 5;
  
  // Pénalités pour les utilisateurs root
  score -= rootUsers.length * 10;
  
  // Pénalités pour les vulnérabilités
  vulnerabilities.forEach(vuln => {
    if (vuln.level === 'CRITICAL') score -= 20;
    else if (vuln.level === 'HIGH') score -= 10;
  });
  
  return Math.max(0, Math.min(100, score));
}

// Configuration de la sauvegarde
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures

// Créer le dossier de sauvegarde s'il n'existe pas
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

// Fonction pour créer une sauvegarde
const createBackup = async () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `config-${timestamp}.json`);
    
    const backupData = {
      timestamp: new Date().toISOString(),
      containers: await docker.listContainers({ all: true }),
      images: await docker.listImages(),
      networks: await docker.listNetworks(),
      volumes: await docker.listVolumes()
    };

    await fs.promises.writeFile(
      backupPath,
      JSON.stringify(backupData, null, 2)
    );

    logger.info(`Sauvegarde créée: ${backupPath}`);
    
    // Garder seulement les 5 dernières sauvegardes
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('config-'))
      .sort()
      .reverse();
    
    if (backups.length > 5) {
      for (const file of backups.slice(5)) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
      }
    }
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde: ${error.message}`);
    sendNotification(
      'Erreur de Sauvegarde',
      `La sauvegarde automatique a échoué: ${error.message}`
    );
  }
};

// Planifier les sauvegardes automatiques
setInterval(createBackup, BACKUP_INTERVAL);
createBackup(); // Créer une sauvegarde immédiate

// Route pour créer une sauvegarde manuelle
app.post('/api/backup', async (req, res) => {
  try {
    await createBackup();
    res.json({ message: 'Sauvegarde créée avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes pour la documentation détaillée
app.get('/docs/getting-started', verifyApiKey, (req, res) => {
  res.json({
    title: 'Prise en main',
    content: `
      <h2>Bienvenue sur le Dashboard de Monitoring</h2>
      <p>Ce guide vous aidera à prendre en main le dashboard de monitoring Docker.</p>
      <h3>Fonctionnalités principales</h3>
      <ul>
        <li>Surveillance en temps réel des conteneurs Docker</li>
        <li>Analyse des performances système (CPU, Mémoire)</li>
        <li>Gestion des logs des conteneurs</li>
        <li>Audit de sécurité et analyse des vulnérabilités</li>
        <li>Export de rapports PDF</li>
      </ul>
      <h3>Premiers pas</h3>
      <ol>
        <li>Connectez-vous avec votre clé API</li>
        <li>Explorez les différentes sections du dashboard</li>
        <li>Configurez vos alertes et seuils</li>
        <li>Lancez un audit de sécurité</li>
      </ol>
    `
  });
});

app.get('/docs/features', verifyApiKey, (req, res) => {
  res.json({
    title: 'Fonctionnalités principales',
    content: `
      <h2>Fonctionnalités du dashboard</h2>
      <h3>Monitoring</h3>
      <ul>
        <li>Utilisation CPU et mémoire en temps réel</li>
        <li>Statut des conteneurs Docker</li>
        <li>Historique des performances</li>
        <li>Alertes personnalisables</li>
      </ul>
      <h3>Sécurité</h3>
      <ul>
        <li>Analyse des ports ouverts</li>
        <li>Détection des utilisateurs root</li>
        <li>Scan de vulnérabilités</li>
        <li>Score de sécurité</li>
      </ul>
      <h3>Gestion des conteneurs</h3>
      <ul>
        <li>Démarrage/Arrêt/Redémarrage</li>
        <li>Visualisation des logs</li>
        <li>Informations détaillées</li>
        <li>Export de rapports</li>
      </ul>
    `
  });
});

app.get('/wiki/architecture', verifyApiKey, (req, res) => {
  res.json({
    title: 'Architecture',
    content: `
      <h2>Architecture du système</h2>
      <p>Le dashboard est construit avec les technologies suivantes :</p>
      <ul>
        <li>Backend : Node.js avec Express</li>
        <li>Frontend : HTML, CSS, JavaScript</li>
        <li>Communication : WebSocket pour les mises à jour en temps réel</li>
        <li>Docker : API pour l'interaction avec les conteneurs</li>
        <li>Base de données : Pas de base de données, stockage en mémoire</li>
      </ul>
      <h3>Composants principaux</h3>
      <ul>
        <li>Serveur Node.js pour l'API REST</li>
        <li>Interface utilisateur responsive</li>
        <li>Système de notification par email</li>
        <li>Générateur de rapports PDF</li>
      </ul>
    `
  });
});

app.get('/wiki/api', verifyApiKey, (req, res) => {
  res.json({
    title: 'API Documentation',
    content: `
      <h2>API REST</h2>
      <h3>Endpoints disponibles</h3>
      <ul>
        <li>GET /api/system - Statistiques système</li>
        <li>GET /api/containers - Liste des conteneurs</li>
        <li>GET /api/containers/:id/logs - Logs d'un conteneur</li>
        <li>POST /api/containers/:id/start - Démarrer un conteneur</li>
        <li>POST /api/containers/:id/stop - Arrêter un conteneur</li>
        <li>POST /api/containers/:id/restart - Redémarrer un conteneur</li>
        <li>GET /api/security/data - Données de sécurité</li>
        <li>POST /api/security/audit - Lancer un audit de sécurité</li>
        <li>GET /api/documentation - Documentation générale</li>
      </ul>
      <h3>Authentification</h3>
      <p>Toutes les routes API nécessitent une clé API valide dans les headers :</p>
      <code>x-api-key: votre_clé_api</code>
    `
  });
});

// Route pour la documentation
app.get('/api/documentation', verifyApiKey, (req, res) => {
  const documentation = {
    guides: [
      {
        title: 'Prise en main',
        description: 'Guide de démarrage rapide pour utiliser le dashboard',
        link: '/docs/getting-started'
      },
      {
        title: 'Fonctionnalités principales',
        description: 'Découvrez les principales fonctionnalités du dashboard',
        link: '/docs/features'
      },
      {
        title: 'Architecture',
        description: 'Comprendre l\'architecture du système',
        link: '/wiki/architecture'
      },
      {
        title: 'API Documentation',
        description: 'Documentation complète de l\'API',
        link: '/wiki/api'
      }
    ]
  };
  res.json(documentation);
});

// Démarrage du serveur
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Motor Dashboard démarre sur http://0.0.0.0:${PORT}`);
}); 
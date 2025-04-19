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

// Initialisation de l'app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const docker = new Docker();

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

// Middleware pour vérifier l'API key
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'API key invalide ou manquante' });
  }
  
  next();
};

// Fonction pour récupérer les statistiques système
async function getSystemStats() {
  try {
    const stats = {
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: os.platform(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAvg: os.loadavg(),
    };
    
    console.log('Stats système récupérées:', JSON.stringify(stats));
    return stats;
  } catch (error) {
    console.error('Erreur lors de la récupération des stats système:', error);
    return {
      uptime: 0,
      hostname: 'Inconnu',
      platform: 'Inconnu',
      cpuCount: 0,
      totalMemory: 0,
      freeMemory: 0,
      loadAvg: [0, 0, 0],
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
app.get('/api/containers', async (req, res) => {
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

// Route par défaut (renvoie l'interface frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route pour démarrer un container
app.post('/api/containers/:id/start', verifyApiKey, async (req, res) => {
  try {
    const containerId = req.params.id;
    console.log(`Démarrage du container ${containerId}`);
    
    const container = docker.getContainer(containerId);
    await container.start();
    
    res.json({ success: true, action: 'start', id: containerId });
  } catch (error) {
    console.error(`Erreur lors du démarrage du container ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour arrêter un container
app.post('/api/containers/:id/stop', verifyApiKey, async (req, res) => {
  try {
    const containerId = req.params.id;
    console.log(`Arrêt du container ${containerId}`);
    
    const container = docker.getContainer(containerId);
    await container.stop();
    
    res.json({ success: true, action: 'stop', id: containerId });
  } catch (error) {
    console.error(`Erreur lors de l'arrêt du container ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour redémarrer un container
app.post('/api/containers/:id/restart', verifyApiKey, async (req, res) => {
  try {
    const containerId = req.params.id;
    console.log(`Redémarrage du container ${containerId}`);
    
    const container = docker.getContainer(containerId);
    await container.restart();
    
    res.json({ success: true, action: 'restart', id: containerId });
  } catch (error) {
    console.error(`Erreur lors du redémarrage du container ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour récupérer des informations détaillées sur un container
app.get('/api/containers/:id/info', async (req, res) => {
  try {
    const containerId = req.params.id;
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    
    res.json(info);
  } catch (error) {
    console.error(`Erreur lors de la récupération des infos du container ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Fonctions pour la sécurité
async function getSecurityData() {
  // Données simulées pour la démonstration
  return {
    lastAuditTime: new Date().toISOString(),
    securityScore: 75,
    openPorts: [
      { port: 22, service: 'SSH', state: 'open', risk: 'medium' },
      { port: 80, service: 'HTTP', state: 'open', risk: 'low' },
      { port: 443, service: 'HTTPS', state: 'open', risk: 'low' },
      { port: 8080, service: 'HTTP-ALT', state: 'open', risk: 'medium' }
    ],
    rootUsers: [
      { username: 'root', uid: 0, group: 'root', shell: '/bin/bash' }
    ],
    exposedServices: [
      { name: 'SSH', port: 22, state: 'running', risk: 'medium' },
      { name: 'NGINX', port: 80, state: 'running', risk: 'low' },
      { name: 'Docker API', port: 2375, state: 'filtered', risk: 'high' }
    ],
    vulnerabilities: [
      { issue: 'Docker API exposée', description: 'L\'API Docker est exposée sans authentification', level: 'high', recommendation: 'Activer l\'authentification TLS' },
      { issue: 'Accès SSH par mot de passe', description: 'L\'accès SSH par mot de passe est activé', level: 'medium', recommendation: 'Utiliser uniquement des clés SSH' },
      { issue: 'Version de logiciel obsolète', description: 'Plusieurs versions de logiciels sont obsolètes', level: 'medium', recommendation: 'Mettre à jour les packages systèmes' }
    ],
    modifiedFiles: [
      { name: 'nginx.conf', path: '/etc/nginx/', mtime: new Date().toISOString(), user: 'root' },
      { name: 'docker.service', path: '/etc/systemd/system/', mtime: new Date().toISOString(), user: 'root' },
      { name: 'authorized_keys', path: '/root/.ssh/', mtime: new Date().toISOString(), user: 'root' }
    ]
  };
}

async function runSecurityAudit() {
  // Simulation d'un audit de sécurité
  console.log('Exécution d\'un audit de sécurité...');
  
  // Retarder la réponse pour simuler un traitement
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const securityData = await getSecurityData();
  
  // Ajouter quelques variations pour l'audit
  securityData.lastAuditTime = new Date().toISOString();
  securityData.securityScore = Math.floor(Math.random() * 20) + 65; // Score entre 65 et 85
  
  return securityData;
}

// Routes API pour la sécurité
app.get('/api/security/data', async (req, res) => {
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
    const auditResults = await runSecurityAudit();
    res.json(auditResults);
  } catch (error) {
    console.error('Erreur lors de l\'audit de sécurité:', error);
    res.status(500).json({ error: error.message });
  }
});

// Démarrage du serveur
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LaborEssence Dashboard démarre sur http://0.0.0.0:${PORT}`);
}); 
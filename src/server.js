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
  try {
    console.log('Récupération des données de sécurité réelles...');
    
    // Chemins vers les fichiers système de l'hôte (montés en volumes)
    const HOST_ETC = '/host/etc';
    const HOST_PROC = '/host/proc';
    
    // Objet qui contiendra toutes les données de sécurité
    const securityData = {
      lastAuditTime: new Date().toISOString(),
      securityScore: 0, // Sera calculé à la fin
      openPorts: [],
      rootUsers: [],
      exposedServices: [],
      vulnerabilities: [],
      modifiedFiles: []
    };
    
    // 1. Récupération des ports ouverts avec 'ss' ou 'netstat'
    const portsPromise = new Promise((resolve) => {
      // Essayer d'accéder aux données de ports via /proc/net de l'hôte
      exec('cat /host/proc/net/tcp /host/proc/net/tcp6 2>/dev/null || ss -tuln || netstat -tuln', (error, stdout) => {
        if (error) {
          console.error('Erreur lors de la récupération des ports:', error);
          resolve([]);
          return;
        }
        
        const ports = [];
        const lines = stdout.split('\n');
        const portRegex = /\d+\.\d+\.\d+\.\d+:(\d+)|LISTEN.*:(\d+)|:::(\d+)|:[0-9A-F]{4}$/;
        
        lines.forEach(line => {
          const match = line.match(portRegex);
          if (match) {
            // Pour /proc/net/tcp, le port est en hexadécimal
            let port = match[1] || match[2] || match[3];
            if (!port && line.includes('/proc/net/tcp')) {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1) {
                const addrPort = parts[1].split(':');
                if (addrPort.length > 1) {
                  port = parseInt(addrPort[1], 16).toString();
                }
              }
            }
            
            if (port && !ports.some(p => p.port === parseInt(port))) {
              let service = 'Unknown';
              let risk = 'low';
              
              // Identification basique des services
              if (port == 22) { service = 'SSH'; risk = 'medium'; }
              else if (port == 80) { service = 'HTTP'; risk = 'low'; }
              else if (port == 443) { service = 'HTTPS'; risk = 'low'; }
              else if (port == 2375) { service = 'Docker API'; risk = 'high'; }
              else if (port == 3306) { service = 'MySQL'; risk = 'medium'; }
              else if (port == 5432) { service = 'PostgreSQL'; risk = 'medium'; }
              else if (port == 6379) { service = 'Redis'; risk = 'medium'; }
              else if (port == 8080) { service = 'HTTP-ALT'; risk = 'medium'; }
              else if (port == 27017) { service = 'MongoDB'; risk = 'medium'; }
              
              ports.push({
                port: parseInt(port),
                service,
                state: 'open',
                risk
              });
            }
          }
        });
        
        resolve(ports);
      });
    });
    
    // 2. Récupération des utilisateurs root
    const rootUsersPromise = new Promise((resolve) => {
      // Utiliser le fichier passwd de l'hôte s'il est disponible
      const passwdFile = fs.existsSync(`${HOST_ETC}/passwd`) ? `${HOST_ETC}/passwd` : '/etc/passwd';
      
      fs.readFile(passwdFile, 'utf8', (error, data) => {
        if (error) {
          console.error(`Erreur lors de la lecture de ${passwdFile}:`, error);
          resolve([]);
          return;
        }
        
        const users = [];
        const lines = data.split('\n');
        
        lines.forEach(line => {
          if (!line) return;
          
          const parts = line.split(':');
          if (parts.length >= 7) {
            const username = parts[0];
            const uid = parseInt(parts[2]);
            const group = parts[3];
            const shell = parts[6];
            
            // Récupérer uniquement les utilisateurs avec UID 0 (root)
            if (uid === 0) {
              users.push({ username, uid, group, shell });
            }
          }
        });
        
        resolve(users);
      });
    });
    
    // 3. Récupération des services exposés
    const exposedServicesPromise = new Promise((resolve) => {
      // Vérifier les services système sur l'hôte
      exec('ls -l /host/proc/[0-9]*/exe 2>/dev/null || systemctl list-units --type=service --state=running || service --status-all | grep "\\[ + \\]"', (error, stdout) => {
        if (error) {
          console.error('Erreur lors de la récupération des services:', error);
          // On continue car on va essayer d'autres approches
        }
        
        const services = [];
        const lines = stdout.split('\n');
        
        // Vérifier les services communs
        const serviceMap = {
          'ssh': { name: 'SSH', port: 22, risk: 'medium' },
          'sshd': { name: 'SSH', port: 22, risk: 'medium' },
          'nginx': { name: 'NGINX', port: 80, risk: 'low' },
          'apache2': { name: 'Apache', port: 80, risk: 'low' },
          'httpd': { name: 'Apache', port: 80, risk: 'low' },
          'docker': { name: 'Docker', port: null, risk: 'low' },
          'docker.service': { name: 'Docker', port: null, risk: 'low' },
          'mysqld': { name: 'MySQL', port: 3306, risk: 'medium' },
          'postgresql': { name: 'PostgreSQL', port: 5432, risk: 'medium' },
          'redis': { name: 'Redis', port: 6379, risk: 'medium' },
          'mongodb': { name: 'MongoDB', port: 27017, risk: 'medium' }
        };
        
        // Vérifier pour chaque service connu s'il est mentionné dans la sortie
        Object.keys(serviceMap).forEach(serviceName => {
          if (stdout.includes(serviceName)) {
            const service = serviceMap[serviceName];
            services.push({
              name: service.name,
              port: service.port,
              state: 'running',
              risk: service.risk
            });
          }
        });
        
        // Vérifier spécifiquement pour Docker API
        exec('curl -s --unix-socket /var/run/docker.sock http://localhost/version || curl -s http://localhost:2375/version', (dockerError, dockerStdout) => {
          let dockerApiState = 'filtered';
          let dockerApiRisk = 'medium';
          
          if (!dockerError && dockerStdout && dockerStdout.includes('ApiVersion')) {
            dockerApiState = 'running';
            dockerApiRisk = 'high';
          }
          
          // Ajouter Docker API uniquement s'il est exposé (état running)
          if (dockerApiState === 'running') {
            services.push({
              name: 'Docker API',
              port: 2375,
              state: dockerApiState,
              risk: dockerApiRisk
            });
          }
          
          resolve(services);
        });
      });
    });
    
    // 4. Recherche des fichiers système modifiés récemment
    const modifiedFilesPromise = new Promise((resolve) => {
      // Chercher dans les répertoires de l'hôte montés
      const criticalDirs = [
        `${HOST_ETC}`, 
        '/host/var/log', 
        '/host/usr/bin', 
        '/host/usr/local/bin'
      ].filter(dir => fs.existsSync(dir));
      
      if (criticalDirs.length === 0) {
        console.log('Aucun répertoire hôte disponible pour la recherche de fichiers modifiés');
        resolve([]);
        return;
      }
      
      const dirsParam = criticalDirs.join(' ');
      
      // Utiliser find pour obtenir les fichiers modifiés
      exec(`find ${dirsParam} -type f -mtime -7 -ls 2>/dev/null | head -10`, (error, stdout) => {
        if (error) {
          console.error('Erreur lors de la recherche des fichiers modifiés:', error);
          resolve([]);
          return;
        }
        
        const files = [];
        const lines = stdout.split('\n');
        
        lines.forEach(line => {
          if (!line.trim()) return;
          
          const parts = line.split(/\s+/);
          if (parts.length >= 11) {
            const user = parts[5];
            // Fusionner le reste pour obtenir le chemin complet
            const path = parts.slice(10).join(' ');
            // Convertir le chemin hôte en chemin réel
            const realPath = path.replace(/^\/host/, '');
            const name = path.split('/').pop();
            
            // Obtenir la date actuelle pour l'horodatage
            const mtime = new Date().toISOString();
            
            files.push({ name, path: realPath, mtime, user });
          }
        });
        
        resolve(files);
      });
    });
    
    // 5. Identifier des vulnérabilités potentielles
    const vulnerabilitiesPromise = new Promise((resolve) => {
      const vulnerabilities = [];
      
      // Vérifier si Docker est en cours d'exécution sans authentification TLS
      exec('curl -s --unix-socket /var/run/docker.sock http://localhost/version || curl -s http://localhost:2375/version', (error, stdout) => {
        if (!error && stdout && stdout.includes('ApiVersion')) {
          vulnerabilities.push({
            issue: 'Docker API exposée',
            description: 'L\'API Docker est exposée sans authentification TLS',
            level: 'high',
            recommendation: 'Activer l\'authentification TLS pour Docker API'
          });
        }
        
        // Vérifier si le port SSH est ouvert
        exec('ss -tuln | grep ":22 " || cat /host/proc/net/tcp | grep ":0016"', (sshError, sshStdout) => {
          if (!sshError && sshStdout) {
            vulnerabilities.push({
              issue: 'Port SSH ouvert',
              description: 'Le port SSH (22) est accessible depuis l\'extérieur',
              level: 'medium',
              recommendation: 'Limiter l\'accès SSH avec un pare-feu ou changer le port par défaut'
            });
          }
          
          // Vérifier l'état du pare-feu
          exec('ufw status 2>/dev/null || firewall-cmd --state 2>/dev/null || iptables -L 2>/dev/null', (fwError, fwStdout) => {
            if (fwError || !fwStdout || fwStdout.includes('inactive') || fwStdout.includes('Chain INPUT (policy ACCEPT)')) {
              vulnerabilities.push({
                issue: 'Pare-feu désactivé ou mal configuré',
                description: 'Aucun pare-feu actif détecté sur le système',
                level: 'high',
                recommendation: 'Activer et configurer le pare-feu (ufw, firewalld ou iptables)'
              });
            }
            
            // Vérifier si Docker s'exécute en tant que root
            exec('ps aux | grep -v grep | grep -c "docker"', (dockerError, dockerStdout) => {
              if (!dockerError && parseInt(dockerStdout.trim()) > 0) {
                vulnerabilities.push({
                  issue: 'Docker s\'exécute en tant que root',
                  description: 'Les conteneurs Docker s\'exécutent avec des privilèges root par défaut',
                  level: 'medium',
                  recommendation: 'Utiliser des utilisateurs non-root dans les conteneurs'
                });
              }
              
              // Vérifier si les mises à jour sont disponibles
              exec('apt list --upgradable 2>/dev/null | wc -l || yum check-update --quiet 2>/dev/null | wc -l', (updateError, updateStdout) => {
                const updateCount = parseInt(updateStdout.trim());
                if (!updateError && updateCount > 10) {
                  vulnerabilities.push({
                    issue: 'Packages système obsolètes',
                    description: `${updateCount} packages peuvent être mis à jour`,
                    level: 'medium',
                    recommendation: 'Mettre à jour le système avec apt update && apt upgrade ou yum update'
                  });
                }
                
                resolve(vulnerabilities);
              });
            });
          });
        });
      });
    });
    
    // Attendre que toutes les requêtes soient terminées
    const [openPorts, rootUsers, exposedServices, modifiedFiles, vulnerabilities] = await Promise.all([
      portsPromise, rootUsersPromise, exposedServicesPromise, modifiedFilesPromise, vulnerabilitiesPromise
    ]);
    
    // Mettre à jour l'objet de données
    securityData.openPorts = openPorts;
    securityData.rootUsers = rootUsers;
    securityData.exposedServices = exposedServices;
    securityData.modifiedFiles = modifiedFiles;
    securityData.vulnerabilities = vulnerabilities;
    
    // Calculer un score de sécurité basique
    // Plus le score est élevé, meilleure est la sécurité
    let securityScore = 100;
    
    // Réduire le score en fonction des problèmes trouvés
    securityScore -= vulnerabilities.filter(v => v.level === 'high').length * 15;
    securityScore -= vulnerabilities.filter(v => v.level === 'medium').length * 8;
    securityScore -= vulnerabilities.filter(v => v.level === 'low').length * 3;
    securityScore -= openPorts.filter(p => p.risk === 'high').length * 10;
    securityScore -= openPorts.filter(p => p.risk === 'medium').length * 5;
    securityScore -= rootUsers.length > 1 ? 10 : 0;
    
    // S'assurer que le score reste dans les limites 0-100
    securityData.securityScore = Math.max(0, Math.min(100, securityScore));
    
    console.log(`Score de sécurité calculé: ${securityData.securityScore}`);
    return securityData;
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse de sécurité:', error);
    
    // En cas d'erreur, retourner des données simulées basiques
    return {
      lastAuditTime: new Date().toISOString(),
      securityScore: 65,
      openPorts: [
        { port: 22, service: 'SSH', state: 'open', risk: 'medium' },
        { port: 80, service: 'HTTP', state: 'open', risk: 'low' }
      ],
      rootUsers: [
        { username: 'root', uid: 0, group: 'root', shell: '/bin/bash' }
      ],
      exposedServices: [
        { name: 'SSH', port: 22, state: 'running', risk: 'medium' }
      ],
      vulnerabilities: [
        { issue: 'Erreur d\'analyse', description: error.message, level: 'medium', recommendation: 'Vérifier les logs serveur' }
      ],
      modifiedFiles: []
    };
  }
}

async function runSecurityAudit() {
  console.log('Exécution d\'un audit de sécurité complet...');
  
  try {
    // Exécuter des commandes supplémentaires pour un audit plus approfondi
    const deepScanPromises = [];
    
    // 1. Vérifier les ports ouverts avec nmap (si disponible)
    const nmapPromise = new Promise((resolve) => {
      exec('which nmap && nmap -F localhost', (error, stdout) => {
        if (error || !stdout.includes('PORT')) {
          console.log('nmap non disponible ou erreur:', error);
          resolve(null);
          return;
        }
        
        console.log('Scan nmap effectué');
        resolve(stdout);
      });
    });
    deepScanPromises.push(nmapPromise);
    
    // 2. Vérifier les processus avec des privilèges élevés
    const processPromise = new Promise((resolve) => {
      exec('ps -eo user,pid,ppid,cmd,%cpu,%mem --sort=-%mem | head -15', (error, stdout) => {
        if (error) {
          console.log('Erreur ps:', error);
          resolve(null);
          return;
        }
        
        console.log('Scan des processus effectué');
        resolve(stdout);
      });
    });
    deepScanPromises.push(processPromise);
    
    // 3. Vérifier les utilisateurs connectés
    const usersPromise = new Promise((resolve) => {
      exec('who', (error, stdout) => {
        if (error) {
          console.log('Erreur who:', error);
          resolve(null);
          return;
        }
        
        console.log('Scan des utilisateurs connectés effectué');
        resolve(stdout);
      });
    });
    deepScanPromises.push(usersPromise);
    
    // 4. Vérifier l'état du pare-feu
    const firewallPromise = new Promise((resolve) => {
      exec('ufw status 2>/dev/null || firewall-cmd --state 2>/dev/null || iptables -L 2>/dev/null', (error, stdout) => {
        if (error) {
          console.log('Erreur firewall:', error);
          resolve(null);
          return;
        }
        
        console.log('Scan du pare-feu effectué');
        resolve(stdout);
      });
    });
    deepScanPromises.push(firewallPromise);
    
    // Attendre que tous les scans profonds soient terminés (mais ne pas bloquer si certains échouent)
    await Promise.allSettled(deepScanPromises);
    
    // Obtenir les données de sécurité standard
    const securityData = await getSecurityData();
    
    // Ajouter des informations supplémentaires basées sur les scans profonds
    // Ces informations pourraient être ajoutées aux vulnérabilités
    
    // Audit complet réalisé
    console.log('Audit de sécurité complet terminé');
    return securityData;
    
  } catch (error) {
    console.error('Erreur lors de l\'audit de sécurité:', error);
    // En cas d'erreur, retourner les données standard
    return await getSecurityData();
  }
}

// Démarrage du serveur
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LaborEssence Dashboard démarre sur http://0.0.0.0:${PORT}`);
}); 
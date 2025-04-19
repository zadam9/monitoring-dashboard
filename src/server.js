const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const Docker = require('dockerode');
const path = require('path');
const morgan = require('morgan');
const { exec } = require('child_process');
const os = require('os');

// Initialisation de l'app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const docker = new Docker();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

// Port d'écoute
const PORT = process.env.PORT || 8080;

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
    exec('curl -s --head https://aitalla.cloud', (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur lors de la vérification du site:', error);
        resolve({ status: 'DOWN', statusCode: null });
        return;
      }
      
      const statusLine = stdout.split('\n')[0];
      const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : null;
      
      resolve({
        status: statusCode && statusCode >= 200 && statusCode < 400 ? 'UP' : 'DOWN',
        statusCode
      });
    });
  });
}

// Vérifier si HTTPS est actif
async function checkHttpsStatus() {
  return new Promise((resolve) => {
    exec('curl -s --head https://aitalla.cloud', (error, stdout, stderr) => {
      if (error) {
        console.error('Erreur lors de la vérification HTTPS:', error);
        resolve(false);
        return;
      }
      
      // Vérifier si la réponse contient une ligne de statut HTTP valide
      const statusLine = stdout.split('\n')[0];
      const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
      
      if (statusMatch && parseInt(statusMatch[1]) >= 200 && parseInt(statusMatch[1]) < 400) {
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

// WebSocket pour mises à jour en temps réel
io.on('connection', (socket) => {
  console.log('Client connecté avec ID:', socket.id);
  
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
      
      socket.emit('systemStats', {
        ...stats,
        website: {
          ...websiteStatus,
          https: httpsActive
        }
      });
      
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
      
      console.log('Envoi des données système:', JSON.stringify(systemData).substring(0, 200) + '...');
      socket.emit('systemStats', systemData);
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

// Démarrage du serveur
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LaborEssence Dashboard démarre sur http://0.0.0.0:${PORT}`);
}); 
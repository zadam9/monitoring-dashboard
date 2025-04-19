// Initialisation du socket
const socket = io();

// Données pour les graphiques
const cpuData = {
  labels: [], // Timestamps
  datasets: [{
    label: 'CPU Usage (%)',
    data: [],
    borderColor: '#0db7ed',
    backgroundColor: 'rgba(13, 183, 237, 0.1)',
    borderWidth: 2,
    pointRadius: 0,
    fill: true,
    tension: 0.4,
  }]
};

const memoryData = {
  labels: [], // Timestamps
  datasets: [{
    label: 'Memory Usage (%)',
    data: [],
    borderColor: '#384d54',
    backgroundColor: 'rgba(56, 77, 84, 0.1)',
    borderWidth: 2,
    pointRadius: 0,
    fill: true,
    tension: 0.4,
  }]
};

// Configuration des graphiques
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    }
  },
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: 'Temps'
      }
    },
    y: {
      display: true,
      title: {
        display: true,
        text: 'Utilisation (%)'
      },
      min: 0,
      max: 100
    }
  }
};

// Initialisation des graphiques
const ctx = document.getElementById('resources-chart').getContext('2d');
const resourcesChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: cpuData.labels,
    datasets: [
      cpuData.datasets[0],
      memoryData.datasets[0]
    ]
  },
  options: chartOptions
});

// Fonction pour formater le temps d'uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  let result = '';
  if (days > 0) result += `${days}j `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${Math.floor(seconds)}s`;
  
  return result;
}

// Fonction pour formater la taille de mémoire
function formatMemorySize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Formater date pour afficher dans l'UI
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Mettre à jour les graphiques avec les nouvelles données
function updateCharts(cpuUsage, memoryUsage) {
  const now = new Date().toLocaleTimeString();
  
  // Limiter le nombre de points affichés (20 points)
  if (cpuData.labels.length > 20) {
    cpuData.labels.shift();
    cpuData.datasets[0].data.shift();
    memoryData.datasets[0].data.shift();
  }
  
  cpuData.labels.push(now);
  cpuData.datasets[0].data.push(cpuUsage);
  memoryData.datasets[0].data.push(memoryUsage);
  
  resourcesChart.data.labels = cpuData.labels;
  resourcesChart.data.datasets[0].data = cpuData.datasets[0].data;
  resourcesChart.data.datasets[1].data = memoryData.datasets[0].data;
  resourcesChart.update();
}

// Mettre à jour la liste des containers
function updateContainersList(containers) {
  const containersList = document.getElementById('containers-list');
  const containerSelector = document.getElementById('container-selector');
  
  // Vider la liste actuelle mais conserver les options dans le selecteur
  const currentSelectedValue = containerSelector.value;
  
  // Mise à jour du compteur de containers
  const activeContainers = containers.filter(c => c.state === 'running').length;
  document.getElementById('active-containers').textContent = activeContainers;
  document.getElementById('total-containers').textContent = containers.length;
  
  // Nettoyer le conteneur
  containersList.innerHTML = '';
  
  // Si il n'y a pas de containers, afficher un message
  if (containers.length === 0) {
    containersList.innerHTML = `
      <div class="loading-container">
        <p>Aucun container trouvé</p>
      </div>
    `;
    return;
  }
  
  // Mettre à jour le dropdown avec les containers disponibles
  // On sauvegarde d'abord le container sélectionné
  containerSelector.innerHTML = '<option value="">Sélectionner un container</option>';
  
  // Variable pour suivre si nous devons charger le premier conteneur
  let shouldLoadFirstContainer = !currentSelectedValue;
  let firstContainerId = null;
  
  // Ajouter les containers à la liste
  containers.forEach((container, index) => {
    // Ajouter le container à la liste visuelle
    const containerItem = document.createElement('div');
    containerItem.classList.add('container-item');
    
    // Sauvegarder l'ID du premier container si c'est le premier de la liste
    if (index === 0) {
      firstContainerId = container.id;
    }
    
    // Déterminer la classe CSS du statut
    let statusClass = 'status-created';
    if (container.state === 'running') {
      statusClass = 'status-running';
    } else if (container.state === 'exited') {
      statusClass = 'status-exited';
    }
    
    // Construire les tags de ports
    let portsHTML = '';
    if (container.ports && container.ports.length > 0) {
      container.ports.forEach(port => {
        if (port.PublicPort) {
          portsHTML += `<span class="port-tag">${port.PrivatePort}:${port.PublicPort}/${port.Type}</span>`;
        }
      });
    }
    
    containerItem.innerHTML = `
      <div class="container-status ${statusClass}">${container.state}</div>
      <div class="container-info">
        <div class="container-name">${container.name}</div>
        <div class="container-id">ID: ${container.id}</div>
      </div>
      <div class="container-image">${container.image}</div>
      <div class="container-ports">${portsHTML}</div>
    `;
    
    containersList.appendChild(containerItem);
    
    // Ajouter au selecteur
    const option = document.createElement('option');
    option.value = container.id;
    option.textContent = container.name;
    
    // Si c'était le container sélectionné, le resélectionner
    if (container.id === currentSelectedValue) {
      option.selected = true;
      shouldLoadFirstContainer = false;
    }
    
    containerSelector.appendChild(option);
  });
  
  // Si aucun container n'était précédemment sélectionné, sélectionner et charger le premier
  if (shouldLoadFirstContainer && firstContainerId) {
    containerSelector.value = firstContainerId;
    fetchContainerLogs(firstContainerId);
  }
}

// Récupérer les logs d'un container
async function fetchContainerLogs(containerId) {
  if (!containerId) return;
  
  try {
    const response = await fetch(`/api/containers/${containerId}/logs`);
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des logs');
    }
    
    const logs = await response.text();
    document.getElementById('logs-output').textContent = logs || 'Aucun log disponible pour ce container';
  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('logs-output').textContent = `Erreur: ${error.message}`;
  }
}

// Écouteurs d'événements
document.addEventListener('DOMContentLoaded', () => {
  // Écouteur pour la sélection du container
  const containerSelector = document.getElementById('container-selector');
  containerSelector.addEventListener('change', (e) => {
    if (e.target.value) {
      fetchContainerLogs(e.target.value);
    }
  });
  
  // Écouteur pour le bouton de rafraîchissement des logs
  const refreshLogsButton = document.getElementById('refresh-logs');
  refreshLogsButton.addEventListener('click', () => {
    fetchContainerLogs(containerSelector.value);
  });

  // Ajout d'un bouton pour copier les logs
  const logsOutput = document.getElementById('logs-output');
  const copyButton = document.createElement('button');
  copyButton.id = 'copy-logs';
  copyButton.innerHTML = '<i class="fas fa-copy"></i> Copier les logs';
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(logsOutput.textContent)
      .then(() => {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check"></i> Copié!';
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('Erreur lors de la copie:', err);
      });
  });
  
  // Ajouter le bouton à côté du bouton de rafraîchissement
  document.querySelector('.logs-selector').appendChild(copyButton);
  
  // Ajouter un bouton pour exporter le rapport
  const exportButton = document.createElement('button');
  exportButton.id = 'export-report';
  exportButton.innerHTML = '<i class="fas fa-file-export"></i> Exporter';
  exportButton.addEventListener('click', exportSystemReport);
  document.querySelector('.logs-selector').appendChild(exportButton);

  // Gestion du thème
  const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
  
  // Vérifier si un thème est enregistré dans localStorage
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    if (currentTheme === 'dark') {
      toggleSwitch.checked = true;
    }
  }
  
  // Fonction de changement de thème
  function switchTheme(e) {
    if (e.target.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }
  
  toggleSwitch.addEventListener('change', switchTheme, false);
});

// Fonction pour exporter le rapport système
function exportSystemReport() {
  // Récupérer les données actuelles du système
  const hostname = document.getElementById('hostname').textContent;
  const platform = document.getElementById('platform').textContent;
  const uptime = document.getElementById('system-uptime').textContent;
  const cpuUsage = document.getElementById('cpu-usage').textContent;
  const memoryUsage = document.getElementById('memory-usage').textContent;
  const websiteStatus = document.getElementById('site-status-indicator').textContent;
  const httpsStatus = document.getElementById('https-status').textContent;
  
  // Nombre de containers
  const activeContainers = document.getElementById('active-containers').textContent;
  const totalContainers = document.getElementById('total-containers').textContent;
  
  // Créer le contenu du rapport
  const currentDate = new Date().toLocaleString();
  let reportContent = `# Rapport de Monitoring - ${currentDate}\n\n`;
  
  reportContent += `## Informations Système\n`;
  reportContent += `- Hostname: ${hostname}\n`;
  reportContent += `- Plateforme: ${platform}\n`;
  reportContent += `- ${uptime}\n\n`;
  
  reportContent += `## Ressources\n`;
  reportContent += `- CPU: ${cpuUsage}\n`;
  reportContent += `- Mémoire: ${memoryUsage}\n\n`;
  
  reportContent += `## Site Web\n`;
  reportContent += `- Statut: ${websiteStatus}\n`;
  reportContent += `- HTTPS: ${httpsStatus}\n\n`;
  
  reportContent += `## Containers Docker\n`;
  reportContent += `- Actifs: ${activeContainers} / ${totalContainers} total\n\n`;
  
  // Créer un élément blob et un lien de téléchargement
  const blob = new Blob([reportContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `monitoring-report-${new Date().toISOString().split('T')[0]}.md`;
  
  // Simuler un clic pour télécharger
  document.body.appendChild(downloadLink);
  downloadLink.click();
  
  // Nettoyage
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}

// Système d'alertes
function checkAndShowAlerts(cpuUsage, memoryUsage) {
  const cpuThreshold = 80;
  const memoryThreshold = 80;
  
  if (cpuUsage > cpuThreshold) {
    showAlert(`Alerte: Utilisation CPU élevée (${cpuUsage.toFixed(2)}%)`, 'danger');
  }
  
  if (memoryUsage > memoryThreshold) {
    showAlert(`Alerte: Utilisation mémoire élevée (${memoryUsage.toFixed(2)}%)`, 'danger');
  }
}

function showAlert(message, type) {
  // Créer l'élément d'alerte s'il n'existe pas déjà
  let alertsContainer = document.getElementById('alerts-container');
  
  if (!alertsContainer) {
    alertsContainer = document.createElement('div');
    alertsContainer.id = 'alerts-container';
    document.querySelector('.dashboard').insertBefore(alertsContainer, document.querySelector('header').nextSibling);
  }
  
  // Créer la notification
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type}`;
  alertElement.innerHTML = `
    <div class="alert-content">
      <i class="fas fa-exclamation-triangle"></i>
      <span>${message}</span>
    </div>
    <button class="alert-close"><i class="fas fa-times"></i></button>
  `;
  
  // Ajouter la fonctionnalité de fermeture
  alertElement.querySelector('.alert-close').addEventListener('click', () => {
    alertElement.remove();
  });
  
  // Ajouter au container et configurer l'auto-destruction
  alertsContainer.appendChild(alertElement);
  
  // Auto-fermeture après 10 secondes
  setTimeout(() => {
    if (alertElement.parentNode) {
      alertElement.remove();
    }
  }, 10000);
}

// Abonnements WebSocket
socket.on('connect', () => {
  console.log('Connecté au serveur');
});

socket.on('disconnect', () => {
  console.log('Déconnecté du serveur');
});

socket.on('systemStats', (stats) => {
  // Mise à jour de l'uptime
  document.getElementById('system-uptime').textContent = `Uptime: ${formatUptime(stats.uptime)}`;
  
  // Mise à jour des informations serveur
  document.getElementById('hostname').textContent = stats.hostname;
  document.getElementById('platform').textContent = stats.platform;
  
  // Calcul et affichage du pourcentage d'utilisation mémoire
  const memoryUsage = 100 - (stats.freeMemory / stats.totalMemory * 100);
  document.getElementById('memory-usage-bar').style.width = `${memoryUsage}%`;
  document.getElementById('memory-usage').textContent = 
    `${memoryUsage.toFixed(2)}% (${formatMemorySize(stats.totalMemory - stats.freeMemory)} / ${formatMemorySize(stats.totalMemory)})`;
  
  // Calcul et affichage du pourcentage d'utilisation CPU
  const cpuUsage = stats.loadAvg[0] * 100 / stats.cpuCount;
  document.getElementById('cpu-usage-bar').style.width = `${cpuUsage > 100 ? 100 : cpuUsage}%`;
  document.getElementById('cpu-usage').textContent = 
    `${cpuUsage.toFixed(2)}% (${stats.loadAvg[0].toFixed(2)} load avg, ${stats.cpuCount} cores)`;
  
  // Mise à jour des graphiques
  updateCharts(cpuUsage, memoryUsage);
  
  // Vérifier les alertes
  checkAndShowAlerts(cpuUsage, memoryUsage);
  
  // Mise à jour du statut du site web
  const siteStatusIndicator = document.getElementById('site-status-indicator');
  const httpsStatus = document.getElementById('https-status');
  const statusCode = document.getElementById('status-code');
  
  if (stats.website) {
    siteStatusIndicator.textContent = stats.website.status;
    siteStatusIndicator.className = 'status-indicator';
    siteStatusIndicator.classList.add(stats.website.status === 'UP' ? 'status-up' : 'status-down');
    
    httpsStatus.textContent = stats.website.https ? 'Actif' : 'Inactif';
    httpsStatus.className = stats.website.https ? 'status-up' : 'status-down';
    
    statusCode.textContent = stats.website.statusCode || 'N/A';
  }
});

socket.on('containers', (containers) => {
  updateContainersList(containers);
}); 
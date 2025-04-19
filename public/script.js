// Initialisation du socket
const socket = io();

// État de l'application
const appState = {
  selectedTheme: localStorage.getItem('theme') || 'light',
  activeSection: 'dashboard-section',
  containers: [],
  cpuThreshold: 80,
  memoryThreshold: 80,
  refreshInterval: 5000,
  animationEnabled: true,
  compactMode: false,
  primaryColor: '#0db7ed',
  apiKey: localStorage.getItem('api_key') || '',
  currentHistoryPeriod: '24h',
  systemHistory: [],
  websiteHistory: []
};

// Configuration des graphiques
Chart.defaults.font.family = "'Poppins', sans-serif";
Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();

// Données pour les graphiques
const chartData = {
  cpu: {
    labels: [],  // Timestamps
    values: []
  },
  memory: {
    labels: [],  // Timestamps
    values: []
  }
};

// Initialisation des graphiques
let cpuDonutChart, memoryDonutChart, resourcesChart;

// Variables pour les nouveaux graphiques
let cpuHistoryChart, memoryHistoryChart, uptimeHistoryChart, websiteHistoryChart;

// Variables pour le tableau de bord de sécurité
let securityScoreChart;
let securityData = {
  lastAuditTime: null,
  securityScore: null,
  openPorts: [],
  rootUsers: [],
  exposedServices: [],
  vulnerabilities: [],
  modifiedFiles: []
};

// Fonction pour obtenir l'heure actuelle formatée
function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Fonction pour initialiser les graphiques
function initCharts() {
  // CPU Donut Chart
  const cpuCtx = document.getElementById('cpu-donut-chart').getContext('2d');
  cpuDonutChart = new Chart(cpuCtx, {
    type: 'doughnut',
    data: {
      labels: ['Utilisé', 'Libre'],
      datasets: [{
        data: [0, 100],
        backgroundColor: [
          appState.primaryColor,
          'rgba(200, 200, 200, 0.2)'
        ],
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  });
  
  // Memory Donut Chart
  const memoryCtx = document.getElementById('memory-donut-chart').getContext('2d');
  memoryDonutChart = new Chart(memoryCtx, {
    type: 'doughnut',
    data: {
      labels: ['Utilisé', 'Libre'],
      datasets: [{
        data: [0, 100],
        backgroundColor: [
          appState.primaryColor,
          'rgba(200, 200, 200, 0.2)'
        ],
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  });
  
  // Resources Line Chart
  const resourcesCtx = document.getElementById('resources-chart').getContext('2d');
  resourcesChart = new Chart(resourcesCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'CPU (%)',
          data: [],
          borderColor: appState.primaryColor,
          backgroundColor: `${appState.primaryColor}20`,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
          order: 1
        },
        {
          label: 'Mémoire (%)',
          data: [],
          borderColor: '#384d54',
          backgroundColor: '#384d5420',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  });
}

// Fonction pour initialiser les graphiques d'historique
function initHistoryCharts() {
  // CPU History Chart
  const cpuHistoryCtx = document.getElementById('cpu-history-chart').getContext('2d');
  cpuHistoryChart = new Chart(cpuHistoryCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'CPU Utilisation (%)',
        data: [],
        borderColor: appState.primaryColor,
        backgroundColor: `${appState.primaryColor}20`,
        borderWidth: 2,
        pointRadius: 1,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 8,
            callback: function(value, index, values) {
              const date = new Date(appState.systemHistory[index]?.timestamp);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  });
  
  // Memory History Chart
  const memoryHistoryCtx = document.getElementById('memory-history-chart').getContext('2d');
  memoryHistoryChart = new Chart(memoryHistoryCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Mémoire Utilisation (%)',
        data: [],
        borderColor: '#384d54',
        backgroundColor: '#384d5420',
        borderWidth: 2,
        pointRadius: 1,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 8,
            callback: function(value, index, values) {
              const date = new Date(appState.systemHistory[index]?.timestamp);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  });
  
  // Website Status History Chart
  const websiteHistoryCtx = document.getElementById('website-history-chart').getContext('2d');
  websiteHistoryChart = new Chart(websiteHistoryCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Statut du site',
        data: [],
        borderColor: '#27ae60',
        backgroundColor: '#27ae6020',
        borderWidth: 2,
        pointRadius: 2,
        stepped: true,
        tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              if (value === 2) return 'UP';
              if (value === 1) return 'PARTIAL';
              return 'DOWN';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 8,
            callback: function(value, index, values) {
              const date = new Date(appState.websiteHistory[index]?.timestamp);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
        },
        y: {
          beginAtZero: true,
          max: 2,
          ticks: {
            stepSize: 1,
            callback: function(value) {
              if (value === 2) return 'UP';
              if (value === 1) return 'PARTIAL';
              return 'DOWN';
            }
          }
        }
      }
    }
  });
}

// Fonction pour initialiser les graphiques relatifs à la sécurité
function initSecurityCharts() {
  const securityScoreCtx = document.getElementById('security-score-chart').getContext('2d');
  securityScoreChart = new Chart(securityScoreCtx, {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Restant'],
      datasets: [{
        data: [0, 100],
        backgroundColor: [
          '#27ae60',
          'rgba(200, 200, 200, 0.2)'
        ],
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: appState.animationEnabled ? 1000 : 0
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  });
}

// Fonction pour initialiser tous les graphiques
function initAllCharts() {
  initCharts();
  initHistoryCharts();
  initSecurityCharts();
}

// Fonction pour mettre à jour les graphiques
function updateCharts(cpuUsage, memoryUsage) {
  const now = getCurrentTime();
  
  // Mettre à jour les donut charts
  cpuDonutChart.data.datasets[0].data = [cpuUsage, 100 - cpuUsage];
  cpuDonutChart.update();
  
  memoryDonutChart.data.datasets[0].data = [memoryUsage, 100 - memoryUsage];
  memoryDonutChart.update();
  
  // Mettre à jour le graphique de ressources
  // Limiter à 20 points pour la lisibilité
  if (chartData.cpu.labels.length > 20) {
    chartData.cpu.labels.shift();
    chartData.cpu.values.shift();
    chartData.memory.values.shift();
  }
  
  chartData.cpu.labels.push(now);
  chartData.cpu.values.push(cpuUsage);
  chartData.memory.values.push(memoryUsage);
  
  resourcesChart.data.labels = chartData.cpu.labels;
  resourcesChart.data.datasets[0].data = chartData.cpu.values;
  resourcesChart.data.datasets[1].data = chartData.memory.values;
  resourcesChart.update();
  
  // Mettre à jour les valeurs affichées
  document.getElementById('cpu-usage').textContent = `${cpuUsage.toFixed(1)}%`;
  document.getElementById('cpu-usage-overview').textContent = `${cpuUsage.toFixed(1)}%`;
  document.getElementById('memory-usage').textContent = `${memoryUsage.toFixed(1)}%`;
  document.getElementById('memory-usage-overview').textContent = `${memoryUsage.toFixed(1)}%`;
}

// Fonction pour mettre à jour les graphiques d'historique
function updateHistoryCharts() {
  if (!cpuHistoryChart || !memoryHistoryChart || !websiteHistoryChart) {
    return;
  }
  
  // Mettre à jour le graphique CPU
  cpuHistoryChart.data.labels = appState.systemHistory.map(entry => '');
  cpuHistoryChart.data.datasets[0].data = appState.systemHistory.map(entry => entry.cpu);
  cpuHistoryChart.update();
  
  // Mettre à jour le graphique mémoire
  memoryHistoryChart.data.labels = appState.systemHistory.map(entry => '');
  memoryHistoryChart.data.datasets[0].data = appState.systemHistory.map(entry => entry.memory);
  memoryHistoryChart.update();
  
  // Mettre à jour le graphique du statut du site
  websiteHistoryChart.data.labels = appState.websiteHistory.map(entry => '');
  websiteHistoryChart.data.datasets[0].data = appState.websiteHistory.map(entry => {
    if (entry.status === 'UP') return 2;
    if (entry.status === 'PARTIAL') return 1;
    return 0;
  });
  websiteHistoryChart.update();
}

// Fonction pour charger l'historique depuis le serveur
async function loadHistory(period = '24h') {
  try {
    // Charger l'historique système
    const systemResponse = await fetch(`/api/history/system?period=${period}`);
    if (!systemResponse.ok) {
      throw new Error('Erreur lors du chargement de l\'historique système');
    }
    appState.systemHistory = await systemResponse.json();
    
    // Charger l'historique du site web
    const websiteResponse = await fetch(`/api/history/website?period=${period}`);
    if (!websiteResponse.ok) {
      throw new Error('Erreur lors du chargement de l\'historique du site web');
    }
    appState.websiteHistory = await websiteResponse.json();
    
    // Mettre à jour les graphiques
    updateHistoryCharts();
    
    console.log(`Historique chargé pour la période ${period}`);
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error);
    showAlert(`Erreur lors du chargement de l'historique: ${error.message}`, 'danger');
  }
}

// Fonction pour changer la période d'historique
function changeHistoryPeriod(period) {
  appState.currentHistoryPeriod = period;
  loadHistory(period);
  
  // Mettre à jour l'UI
  document.querySelectorAll('.history-period-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.history-period-btn[data-period="${period}"]`).classList.add('active');
}

// Fonction pour changer de section
function switchSection(sectionId) {
  // Cacher toutes les sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Afficher la section sélectionnée
  document.getElementById(sectionId).classList.add('active');
  
  // Mettre à jour le menu
  document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.classList.remove('active');
  });
  
  // Trouver et activer l'élément de menu correspondant
  document.querySelector(`.sidebar-nav a[href="#${sectionId}"]`).parentElement.classList.add('active');
  
  // Mettre à jour le titre de la page
  document.querySelector('.page-title h2').textContent = document.querySelector(`#${sectionId} .section-header h2`).textContent;
  
  // Sauvegarder la section active
  appState.activeSection = sectionId;
}

// Fonction pour basculer la sidebar
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('collapsed');
}

// Fonction pour changer de thème
function switchTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  appState.selectedTheme = theme;
  
  // Mettre à jour le checkbox du thème
  const themeCheckbox = document.getElementById('checkbox');
  themeCheckbox.checked = theme === 'dark';
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

// Fonction pour formater date pour afficher dans l'UI
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Mettre à jour la liste des containers
function updateContainersList(containers) {
  // Mettre à jour l'état
  appState.containers = containers;
  
  // Mettre à jour les compteurs de containers
  const activeContainers = containers.filter(c => c.state === 'running').length;
  document.getElementById('active-containers').textContent = activeContainers;
  document.getElementById('total-containers').textContent = containers.length;
  document.getElementById('active-containers-count').textContent = activeContainers;
  document.getElementById('total-containers-count').textContent = containers.length;
  
  // Mise à jour du site status overview
  const siteStatus = document.getElementById('site-status-indicator').textContent;
  document.getElementById('site-status-overview').textContent = siteStatus;
  
  // Nettoyer le conteneur
  const containersGrid = document.getElementById('containers-grid');
  
  // Garder seulement l'élément de loading
  const loading = containersGrid.querySelector('.loading-container');
  containersGrid.innerHTML = '';
  
  if (loading) {
    containersGrid.appendChild(loading);
  }
  
  // Si il n'y a pas de containers, afficher un message
  if (containers.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.innerHTML = '<i class="fas fa-info-circle"></i><p>Aucun container trouvé</p>';
    containersGrid.appendChild(emptyMessage);
    return;
  }
  
  // Cacher le loading
  if (loading) {
    loading.style.display = 'none';
  }
  
  // Mettre à jour le selecteur de containers pour les logs
  const containerSelector = document.getElementById('container-selector');
  const currentSelectedValue = containerSelector.value;
  
  containerSelector.innerHTML = '<option value="">Sélectionner un container</option>';
  
  // Variable pour suivre si nous devons charger le premier conteneur
  let shouldLoadFirstContainer = !currentSelectedValue;
  let firstContainerId = null;
  
  // Ajouter les containers à la grille
  containers.forEach((container, index) => {
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
        if (port.publicPort) {
          portsHTML += `<span class="port-tag">${port.privatePort}:${port.publicPort}/${port.type}</span>`;
        }
      });
    }
    
    // Créer la carte de container
    const containerCard = document.createElement('div');
    containerCard.className = 'container-card';
    containerCard.dataset.id = container.id;
    containerCard.dataset.state = container.state;
    
    containerCard.innerHTML = `
      <div class="container-header">
        <div class="container-status ${statusClass}">${container.state}</div>
        <div class="container-actions-buttons">
          <button class="container-action-btn logs" data-id="${container.id}">
            <i class="fas fa-terminal"></i> Logs
          </button>
          <button class="container-action-btn details" data-id="${container.id}">
            <i class="fas fa-info-circle"></i> Détails
          </button>
        </div>
      </div>
      <div class="container-name">${container.name}</div>
      <div class="container-id">ID: ${container.id}</div>
      <div class="container-image">
        <i class="fas fa-tag"></i>
        ${container.image}
      </div>
      <div class="container-ports">${portsHTML}</div>
      <div class="container-controls">
        ${container.state === 'running' ? 
          `<button class="container-control-btn stop" data-id="${container.id}"><i class="fas fa-stop"></i> Arrêter</button>
          <button class="container-control-btn restart" data-id="${container.id}"><i class="fas fa-sync"></i> Redémarrer</button>` : 
          `<button class="container-control-btn start" data-id="${container.id}"><i class="fas fa-play"></i> Démarrer</button>`
        }
      </div>
    `;
    
    // Ajouter à la grille
    containersGrid.appendChild(containerCard);
    
    // Ajouter les écouteurs d'événements
    containerCard.querySelector('.container-action-btn.logs').addEventListener('click', () => {
      containerSelector.value = container.id;
      fetchContainerLogs(container.id);
      switchSection('logs-section');
    });
    
    containerCard.querySelector('.container-action-btn.details').addEventListener('click', () => {
      showContainerDetails(container);
    });
    
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
    
    // Ajouter les écouteurs pour les contrôles de containers
    const startBtn = containerCard.querySelector('.container-control-btn.start');
    const stopBtn = containerCard.querySelector('.container-control-btn.stop');
    const restartBtn = containerCard.querySelector('.container-control-btn.restart');
    
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const containerId = e.currentTarget.dataset.id;
        controlContainer(containerId, 'start');
      });
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const containerId = e.currentTarget.dataset.id;
        controlContainer(containerId, 'stop');
      });
    }
    
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const containerId = e.currentTarget.dataset.id;
        controlContainer(containerId, 'restart');
      });
    }
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

// Réception des mises à jour du système
socket.on('systemStats', function(data) {
  console.log('Données système reçues:', data);
  
  // Mise à jour de l'uptime
  const uptimeElement = document.getElementById('system-uptime');
  if (uptimeElement) {
    uptimeElement.innerHTML = `<i class="fas fa-clock"></i> <span>Uptime: ${formatUptime(data.uptime)}</span>`;
  }
  
  // Mise à jour des infos serveur
  const hostnameElement = document.getElementById('system-hostname');
  if (hostnameElement) hostnameElement.textContent = data.hostname;
  
  const platformElement = document.getElementById('system-platform');
  if (platformElement) platformElement.textContent = data.platform;
  
  // Corrections pour le bloc serveur
  const hostnameValueElement = document.getElementById('hostname');
  if (hostnameValueElement) hostnameValueElement.textContent = data.hostname;
  
  const platformValueElement = document.getElementById('platform');
  if (platformValueElement) platformValueElement.textContent = data.platform;
  
  const uptimeValueElement = document.getElementById('uptime-value');
  if (uptimeValueElement) uptimeValueElement.textContent = formatUptime(data.uptime);
  
  const cpuCoresElement = document.getElementById('cpu-cores');
  if (cpuCoresElement) cpuCoresElement.textContent = data.cpuCount;
  
  // Calcul de l'utilisation mémoire
  const memoryUsed = data.totalMemory - data.freeMemory;
  const memoryPercentage = Math.round((memoryUsed / data.totalMemory) * 100);
  
  // Mise à jour des éléments de mémoire
  const memoryUsedElement = document.getElementById('memory-used');
  if (memoryUsedElement) memoryUsedElement.textContent = formatMemorySize(memoryUsed);
  
  const memoryTotalElement = document.getElementById('memory-total');
  if (memoryTotalElement) memoryTotalElement.textContent = formatMemorySize(data.totalMemory);
  
  const memoryUsageElement = document.getElementById('memory-usage');
  if (memoryUsageElement) memoryUsageElement.textContent = `${memoryPercentage}%`;
  
  const memoryUsageOverviewElement = document.getElementById('memory-usage-overview');
  if (memoryUsageOverviewElement) memoryUsageOverviewElement.textContent = `${memoryPercentage}% utilisé`;
  
  // Calcul et mise à jour de l'utilisation CPU (approximation depuis la charge moyenne)
  const cpuUsage = Math.min(Math.round((data.loadAvg[0] / data.cpuCount) * 100), 100);
  
  const cpuUsageElement = document.getElementById('cpu-usage');
  if (cpuUsageElement) cpuUsageElement.textContent = `${cpuUsage}%`;
  
  const cpuLoadElement = document.getElementById('cpu-load');
  if (cpuLoadElement) cpuLoadElement.textContent = data.loadAvg[0].toFixed(2);
  
  const cpuUsageOverviewElement = document.getElementById('cpu-usage-overview');
  if (cpuUsageOverviewElement) cpuUsageOverviewElement.textContent = `${cpuUsage}% utilisé`;
  
  // Mise à jour du statut du site
  if (data.website) {
    const siteStatusElement = document.getElementById('site-status-overview');
    if (siteStatusElement) {
      let statusText = '';
      if (data.website.status === 'UP') {
        statusText = `<span class="status-up">Opérationnel</span>`;
      } else if (data.website.status === 'PARTIAL') {
        statusText = `<span class="status-partial">Partiellement disponible</span>`;
      } else {
        statusText = `<span class="status-down">Hors service</span>`;
      }
      siteStatusElement.innerHTML = statusText;
    }
    
    const httpsIndicator = document.getElementById('https-indicator');
    if (httpsIndicator) {
      httpsIndicator.className = data.website.https ? 'status-up' : 'status-down';
      httpsIndicator.textContent = data.website.https ? 'Actif' : 'Inactif';
    }
  }
  
  // Mise à jour des graphiques si définis
  if (cpuDonutChart && memoryDonutChart) {
    updateCharts(cpuUsage, memoryPercentage);
  }
  
  // Vérification des alertes
  checkAndShowAlerts(cpuUsage, memoryPercentage);
});

socket.on('containers', (containers) => {
  updateContainersList(containers);
});

// Fonction pour afficher les détails d'un container
function showContainerDetails(container) {
  const detailsContainer = document.getElementById('container-details');
  const modal = document.getElementById('container-details-modal');
  
  // Format HTML pour les détails
  let detailsHTML = `
    <div class="container-details">
      <div class="detail-group">
        <h4>Informations générales</h4>
        <div class="detail-row">
          <span class="detail-label">Nom:</span>
          <span class="detail-value">${container.name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">ID:</span>
          <span class="detail-value">${container.id}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Image:</span>
          <span class="detail-value">${container.image}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">État:</span>
          <span class="detail-value status-${container.state}">${container.state}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Créé le:</span>
          <span class="detail-value">${formatDate(container.created)}</span>
        </div>
      </div>
      
      <div class="detail-group">
        <h4>Ports exposés</h4>
  `;
  
  if (container.ports && container.ports.length > 0) {
    detailsHTML += '<div class="ports-list">';
    container.ports.forEach(port => {
      if (port.publicPort) {
        detailsHTML += `
          <div class="port-item">
            <span class="port-internal">${port.privatePort}/${port.type}</span>
            <i class="fas fa-arrow-right"></i>
            <span class="port-external">${port.publicPort}</span>
          </div>
        `;
      } else {
        detailsHTML += `
          <div class="port-item">
            <span class="port-internal">${port.privatePort}/${port.type}</span>
            <i class="fas fa-times"></i>
            <span class="port-external">Non exposé</span>
          </div>
        `;
      }
    });
    detailsHTML += '</div>';
  } else {
    detailsHTML += '<p class="no-data">Aucun port exposé</p>';
  }
  
  detailsHTML += `
      </div>
      
      <div class="detail-actions">
        <button class="action-button view-logs" data-id="${container.id}">
          <i class="fas fa-terminal"></i> Voir les logs
        </button>
      </div>
    </div>
  `;
  
  detailsContainer.innerHTML = detailsHTML;
  
  // Ajouter l'écouteur pour le bouton de logs
  detailsContainer.querySelector('.view-logs').addEventListener('click', () => {
    document.getElementById('container-selector').value = container.id;
    fetchContainerLogs(container.id);
    switchSection('logs-section');
    modal.classList.remove('active');
  });
  
  // Afficher le modal
  modal.classList.add('active');
  
  // Ajouter l'écouteur pour fermer le modal
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  // Fermer le modal en cliquant en dehors
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// Fonctions pour contrôler les containers
async function controlContainer(containerId, action) {
  if (!appState.apiKey) {
    showApiKeyPrompt(() => controlContainer(containerId, action));
    return;
  }
  
  try {
    const response = await fetch(`/api/containers/${containerId}/${action}?api_key=${appState.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': appState.apiKey
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erreur lors de l'action ${action}`);
    }
    
    const result = await response.json();
    showAlert(`Action ${action} réussie sur le container ${result.id}`, 'success');
    
    // Rafraîchir la liste des containers après 2 secondes
    setTimeout(async () => {
      const containers = await getContainers();
      updateContainersList(containers);
    }, 2000);
    
  } catch (error) {
    console.error(`Erreur ${action}:`, error);
    showAlert(error.message, 'danger');
    
    // Si l'erreur est liée à l'API key, demander une nouvelle clé
    if (error.message.includes('API key')) {
      showApiKeyPrompt(() => controlContainer(containerId, action));
    }
  }
}

// Fonction pour demander la clé API
function showApiKeyPrompt(callback) {
  const modal = document.getElementById('api-key-modal');
  const input = document.getElementById('api-key-input');
  const saveButton = document.getElementById('save-api-key');
  
  // Si le modal n'existe pas, le créer
  if (!modal) {
    const modalHTML = `
      <div id="api-key-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Clé API requise</h3>
            <span class="modal-close">&times;</span>
          </div>
          <div class="modal-body">
            <p>Une clé API est requise pour effectuer des actions sur les containers.</p>
            <div class="form-group">
              <label for="api-key-input">Clé API :</label>
              <input type="password" id="api-key-input" placeholder="Entrez votre clé API">
            </div>
            <div class="form-actions">
              <button id="save-api-key" class="action-button">Enregistrer</button>
              <button id="cancel-api-key" class="action-button secondary">Annuler</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const newModal = document.getElementById('api-key-modal');
    const newInput = document.getElementById('api-key-input');
    const newSaveButton = document.getElementById('save-api-key');
    const cancelButton = document.getElementById('cancel-api-key');
    const closeButton = newModal.querySelector('.modal-close');
    
    // Gérer la fermeture du modal
    closeButton.addEventListener('click', () => {
      newModal.classList.remove('active');
    });
    
    cancelButton.addEventListener('click', () => {
      newModal.classList.remove('active');
    });
    
    // Gérer l'enregistrement de la clé API
    newSaveButton.addEventListener('click', () => {
      appState.apiKey = newInput.value.trim();
      localStorage.setItem('api_key', appState.apiKey);
      newModal.classList.remove('active');
      
      if (callback && typeof callback === 'function') {
        callback();
      }
    });
    
    // Afficher le modal
    newModal.classList.add('active');
    newInput.focus();
  } else {
    // Réinitialiser et afficher le modal existant
    input.value = appState.apiKey || '';
    modal.classList.add('active');
    input.focus();
    
    // Mettre à jour le callback
    saveButton.onclick = () => {
      appState.apiKey = input.value.trim();
      localStorage.setItem('api_key', appState.apiKey);
      modal.classList.remove('active');
      
      if (callback && typeof callback === 'function') {
        callback();
      }
    };
  }
}

// Abonnements WebSocket
socket.on('systemHistory', (history) => {
  console.log('Historique système reçu:', history.length, 'entrées');
  appState.systemHistory = history;
  updateHistoryCharts();
});

socket.on('websiteHistory', (history) => {
  console.log('Historique du site web reçu:', history.length, 'entrées');
  appState.websiteHistory = history;
  updateHistoryCharts();
});

// Initialisation du DOM
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser les graphiques
  initAllCharts();
  
  // Charger l'historique initial
  loadHistory('24h');
  
  // Appliquer le thème initial
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('checkbox').checked = savedTheme === 'dark';
  
  // Écouteur pour la bascule du thème
  document.getElementById('checkbox').addEventListener('change', (e) => {
    switchTheme(e.target.checked ? 'dark' : 'light');
  });
  
  // Écouteur pour le basculement de la sidebar
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
  
  // Écouteurs pour la navigation
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.currentTarget.getAttribute('href').substring(1);
      switchSection(target);
    });
  });
  
  // Écouteur pour les sélecteurs de plage de temps
  document.querySelectorAll('.time-range').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.time-range').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      // Logique pour changer l'intervalle temporel du graphique
    });
  });
  
  // Écouteur pour les filtres de containers
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const filter = e.currentTarget.dataset.filter;
      const containers = document.querySelectorAll('.container-card');
      
      containers.forEach(card => {
        if (filter === 'all' || (filter === 'running' && card.dataset.state === 'running') || (filter === 'stopped' && card.dataset.state === 'exited')) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
  
  // Écouteur pour les options d'affichage des containers
  document.querySelectorAll('.view-option').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.view-option').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const view = e.currentTarget.dataset.view;
      const containersGrid = document.getElementById('containers-grid');
      
      if (view === 'list') {
        containersGrid.classList.add('list-view');
      } else {
        containersGrid.classList.remove('list-view');
      }
    });
  });
  
  // Écouteur pour la recherche de containers
  document.getElementById('container-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const containers = document.querySelectorAll('.container-card');
    
    containers.forEach(card => {
      const name = card.querySelector('.container-name').textContent.toLowerCase();
      const id = card.querySelector('.container-id').textContent.toLowerCase();
      const image = card.querySelector('.container-image').textContent.toLowerCase();
      
      if (name.includes(searchTerm) || id.includes(searchTerm) || image.includes(searchTerm)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
  
  // Écouteur pour les paramètres de thème
  document.querySelectorAll('.theme-option').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.theme-option').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const theme = e.currentTarget.dataset.theme;
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        switchTheme(prefersDark ? 'dark' : 'light');
      } else {
        switchTheme(theme);
      }
    });
  });
  
  // Écouteur pour les couleurs principales
  document.querySelectorAll('.color-option').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const color = e.currentTarget.dataset.color;
      document.documentElement.style.setProperty('--primary-color', color);
      appState.primaryColor = color;
      
      // Mettre à jour les graphiques avec la nouvelle couleur
      if (cpuDonutChart && memoryDonutChart && resourcesChart) {
        cpuDonutChart.data.datasets[0].backgroundColor[0] = color;
        cpuDonutChart.update();
        
        memoryDonutChart.data.datasets[0].backgroundColor[0] = color;
        memoryDonutChart.update();
        
        resourcesChart.data.datasets[0].borderColor = color;
        resourcesChart.data.datasets[0].backgroundColor = `${color}20`;
        resourcesChart.update();
      }
    });
  });
  
  // Écouteur pour la sélection du container pour les logs
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
  
  // Écouteur pour le bouton de copie des logs
  const copyLogsButton = document.getElementById('copy-logs');
  copyLogsButton.addEventListener('click', () => {
    const logsOutput = document.getElementById('logs-output');
    navigator.clipboard.writeText(logsOutput.textContent)
      .then(() => {
        showAlert('Logs copiés dans le presse-papier', 'success');
      })
      .catch(err => {
        console.error('Erreur lors de la copie:', err);
        showAlert('Erreur lors de la copie des logs', 'danger');
      });
  });
  
  // Écouteur pour le bouton d'effacement des logs
  const clearLogsButton = document.getElementById('clear-logs');
  clearLogsButton.addEventListener('click', () => {
    document.getElementById('logs-output').textContent = 'Logs effacés';
  });
  
  // Écouteur pour le filtre des logs
  document.getElementById('logs-filter').addEventListener('input', (e) => {
    const filterTerm = e.target.value.toLowerCase();
    const logsOutput = document.getElementById('logs-output');
    const originalText = logsOutput.getAttribute('data-original') || logsOutput.textContent;
    
    // Sauvegarder le texte original si ce n'est pas déjà fait
    if (!logsOutput.getAttribute('data-original')) {
      logsOutput.setAttribute('data-original', originalText);
    }
    
    if (!filterTerm) {
      logsOutput.textContent = originalText;
      return;
    }
    
    // Filtrer les logs
    const lines = originalText.split('\n');
    const filteredLines = lines.filter(line => line.toLowerCase().includes(filterTerm));
    logsOutput.textContent = filteredLines.join('\n');
  });
  
  // Écouteur pour le bouton d'exportation
  document.getElementById('export-report').addEventListener('click', exportSystemReport);
  
  // Écouteurs pour les boutons de période d'historique
  document.querySelectorAll('.history-period-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const period = e.currentTarget.dataset.period;
      changeHistoryPeriod(period);
    });
  });

  // Initialiser tous les graphiques
  initAllCharts();
  
  // Charger les données de sécurité
  fetchSecurityData();
  
  // Gestion des événements de la section sécurité
  document.getElementById('run-security-audit').addEventListener('click', () => {
    showApiKeyPrompt(() => {
      runSecurityAudit();
    });
  });
  
  document.getElementById('export-security-report').addEventListener('click', exportSecurityReport);
});

// Fonction pour mettre à jour le score de sécurité
function updateSecurityScore(score) {
  if (!securityScoreChart) return;
  
  // Mettre à jour la couleur en fonction du score
  let color = '#27ae60'; // vert pour un bon score
  if (score < 70) {
    color = '#f39c12'; // orange pour un score moyen
  }
  if (score < 50) {
    color = '#e74c3c'; // rouge pour un mauvais score
  }
  
  // Mettre à jour le graphique
  securityScoreChart.data.datasets[0].data = [score, 100 - score];
  securityScoreChart.data.datasets[0].backgroundColor[0] = color;
  securityScoreChart.update();
  
  // Mettre à jour le texte du score
  document.getElementById('security-score-value').innerText = score + '%';
  document.getElementById('security-score-value').style.color = color;
  
  // Mettre à jour le texte de résumé
  let summaryText = '';
  if (score >= 90) {
    summaryText = 'Excellente sécurité! Votre système est bien protégé.';
  } else if (score >= 70) {
    summaryText = 'Bonne sécurité. Quelques améliorations mineures possibles.';
  } else if (score >= 50) {
    summaryText = 'Sécurité moyenne. Des corrections importantes sont recommandées.';
  } else {
    summaryText = 'Sécurité insuffisante. Des actions immédiates sont nécessaires!';
  }
  
  document.getElementById('security-summary-text').innerText = summaryText;
}

// Fonction pour exécuter un audit de sécurité
async function runSecurityAudit() {
  try {
    document.getElementById('security-loader').style.display = 'flex';
    document.getElementById('run-audit-btn').disabled = true;
    
    const response = await fetch('/api/security/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'labordashboard2024'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    updateSecurityDashboard(data);
    
    // Afficher une alerte de succès
    showAlert('Audit de sécurité terminé avec succès.', 'success');
    
  } catch (error) {
    console.error('Erreur lors de l\'audit:', error);
    showAlert('Erreur lors de l\'audit de sécurité: ' + error.message, 'danger');
    
    // En cas d'erreur, afficher des données simulées enrichies
    const simulatedData = {
      lastAuditTime: new Date().toISOString(),
      securityScore: 60,
      openPorts: [
        { port: 22, service: 'SSH', state: 'open', risk: 'medium' },
        { port: 80, service: 'HTTP', state: 'open', risk: 'low' },
        { port: 443, service: 'HTTPS', state: 'open', risk: 'low' },
        { port: 8080, service: 'HTTP-ALT', state: 'open', risk: 'medium' },
        { port: 3306, service: 'MySQL', state: 'open', risk: 'medium' }
      ],
      rootUsers: [
        { username: 'root', uid: 0, group: 'root', shell: '/bin/bash' }
      ],
      exposedServices: [
        { name: 'SSH', port: 22, state: 'running', risk: 'medium' },
        { name: 'NGINX', port: 80, state: 'running', risk: 'low' },
        { name: 'Docker', port: null, state: 'running', risk: 'low' },
        { name: 'MySQL', port: 3306, state: 'running', risk: 'medium' }
      ],
      vulnerabilities: [
        { issue: 'Erreur d\'audit', description: 'Impossible de réaliser un audit complet', level: 'high', recommendation: 'Vérifier la configuration du conteneur Docker' },
        { issue: 'Accès limité', description: 'Le conteneur n\'a pas les permissions nécessaires pour analyser le système hôte', level: 'medium', recommendation: 'Lancer le conteneur avec --privileged et les volumes nécessaires' },
        { issue: 'MySQL exposé', description: 'Le service MySQL est accessible depuis l\'extérieur', level: 'medium', recommendation: 'Limiter l\'accès à MySQL avec un pare-feu' }
      ],
      modifiedFiles: [
        { name: 'sshd_config', path: '/etc/ssh/sshd_config', mtime: new Date().toISOString(), user: 'root' },
        { name: 'nginx.conf', path: '/etc/nginx/nginx.conf', mtime: new Date().toISOString(), user: 'root' },
        { name: 'passwd', path: '/etc/passwd', mtime: new Date().toISOString(), user: 'root' },
        { name: 'my.cnf', path: '/etc/mysql/my.cnf', mtime: new Date().toISOString(), user: 'root' }
      ],
      auditDetails: {
        timestamp: new Date().toISOString(),
        systemInfo: {
          platform: 'linux',
          hostname: 'aws-instance',
          cpus: 2,
          totalMemory: 4294967296,
          freeMemory: 1073741824,
          loadAvg: [0.5, 0.7, 0.8]
        },
        processAudit: [
          { user: 'root', pid: '1', cpu: 0.1, mem: 0.5, command: '/sbin/init' },
          { user: 'mysql', pid: '1234', cpu: 1.5, mem: 15.2, command: 'mysqld' },
          { user: 'www-data', pid: '2345', cpu: 0.8, mem: 4.5, command: 'nginx: worker process' }
        ],
        networkAudit: [
          { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 8.2' },
          { port: 80, state: 'open', service: 'http', version: 'nginx 1.18.0' },
          { port: 3306, state: 'open', service: 'mysql', version: 'MySQL 8.0.27' }
        ],
        userAudit: [
          { username: 'ubuntu', tty: 'pts/0', date: 'May 10 14:23', from: '192.168.1.5' }
        ]
      }
    };
    
    updateSecurityDashboard(simulatedData);
  } finally {
    document.getElementById('security-loader').style.display = 'none';
    document.getElementById('run-audit-btn').disabled = false;
  }
}

// Fonction pour récupérer les données de sécurité
async function fetchSecurityData() {
  try {
    const response = await fetch('/api/security/data');
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    updateSecurityDashboard(data);
    
  } catch (error) {
    console.error('Erreur lors du chargement des données de sécurité:', error);
    showAlert('Erreur lors du chargement des données de sécurité. Utilisation de données de simulation.', 'warning');
    
    // En cas d'erreur, utiliser des données simulées pour que l'interface continue de fonctionner
    const simulatedData = {
      lastAuditTime: new Date().toISOString(),
      securityScore: 65,
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
        { name: 'Docker', port: null, state: 'running', risk: 'low' }
      ],
      vulnerabilities: [
        { issue: 'Erreur d\'analyse', description: 'Impossible de collecter les données réelles de sécurité', level: 'medium', recommendation: 'Vérifier la configuration du conteneur Docker' },
        { issue: 'Accès limité', description: 'Le conteneur n\'a pas les permissions nécessaires pour analyser le système hôte', level: 'medium', recommendation: 'Lancer le conteneur avec --privileged et les volumes nécessaires' }
      ],
      modifiedFiles: [
        { name: 'sshd_config', path: '/etc/ssh/sshd_config', mtime: new Date().toISOString(), user: 'root' },
        { name: 'nginx.conf', path: '/etc/nginx/nginx.conf', mtime: new Date().toISOString(), user: 'root' },
        { name: 'passwd', path: '/etc/passwd', mtime: new Date().toISOString(), user: 'root' }
      ]
    };
    
    updateSecurityDashboard(simulatedData);
  }
}

// Fonction pour mettre à jour le tableau de bord de sécurité
function updateSecurityDashboard(data) {
  securityData = data;
  
  // Mettre à jour l'heure du dernier audit
  if (data.lastAuditTime) {
    const date = new Date(data.lastAuditTime);
    document.getElementById('last-audit-time').innerText = date.toLocaleString();
  }
  
  // Mettre à jour le score de sécurité
  if (data.securityScore !== null) {
    updateSecurityScore(data.securityScore);
  }
  
  // Mettre à jour le tableau des ports ouverts
  updateOpenPortsTable(data.openPorts);
  
  // Mettre à jour le tableau des utilisateurs root
  updateRootUsersTable(data.rootUsers);
  
  // Mettre à jour le tableau des services exposés
  updateExposedServicesTable(data.exposedServices);
  
  // Mettre à jour le tableau des vulnérabilités
  updateVulnerabilitiesTable(data.vulnerabilities);
  
  // Mettre à jour le tableau des fichiers modifiés
  updateModifiedFilesTable(data.modifiedFiles);
}

// Fonction pour mettre à jour le tableau des ports ouverts
function updateOpenPortsTable(ports) {
  const table = document.getElementById('open-ports-table');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!ports || ports.length === 0) {
    tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4">Aucun port ouvert détecté</td></tr>';
    document.getElementById('ports-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
    return;
  }
  
  // Compter les ports à risque
  const riskyPorts = ports.filter(port => port.risk !== 'low').length;
  
  // Mettre à jour le statut
  if (riskyPorts > 0) {
    document.getElementById('ports-status').innerHTML = 
      `<i class="fas fa-exclamation-circle status-warning"></i> ${riskyPorts} à risque`;
  } else {
    document.getElementById('ports-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
  }
  
  // Remplir le tableau
  ports.forEach(port => {
    const tr = document.createElement('tr');
    
    const portTd = document.createElement('td');
    portTd.textContent = port.port;
    
    const serviceTd = document.createElement('td');
    serviceTd.textContent = port.service;
    
    const stateTd = document.createElement('td');
    stateTd.textContent = port.state;
    
    const riskTd = document.createElement('td');
    const riskBadge = document.createElement('span');
    riskBadge.className = `risk-badge risk-${port.risk}`;
    riskBadge.textContent = port.risk;
    riskTd.appendChild(riskBadge);
    
    tr.appendChild(portTd);
    tr.appendChild(serviceTd);
    tr.appendChild(stateTd);
    tr.appendChild(riskTd);
    
    tbody.appendChild(tr);
  });
}

// Fonction pour mettre à jour le tableau des utilisateurs root
function updateRootUsersTable(users) {
  const table = document.getElementById('root-users-table');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4">Aucun utilisateur root trouvé</td></tr>';
    document.getElementById('users-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
    return;
  }
  
  // Mettre à jour le statut
  const tooManyRootUsers = users.length > 1;
  if (tooManyRootUsers) {
    document.getElementById('users-status').innerHTML = 
      `<i class="fas fa-exclamation-circle status-warning"></i> ${users.length} utilisateurs`;
  } else {
    document.getElementById('users-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
  }
  
  // Remplir le tableau
  users.forEach(user => {
    const tr = document.createElement('tr');
    
    const usernameTd = document.createElement('td');
    usernameTd.textContent = user.username;
    
    const uidTd = document.createElement('td');
    uidTd.textContent = user.uid;
    
    const groupTd = document.createElement('td');
    groupTd.textContent = user.group;
    
    const shellTd = document.createElement('td');
    shellTd.textContent = user.shell;
    
    tr.appendChild(usernameTd);
    tr.appendChild(uidTd);
    tr.appendChild(groupTd);
    tr.appendChild(shellTd);
    
    tbody.appendChild(tr);
  });
}

// Fonction pour mettre à jour le tableau des services exposés
function updateExposedServicesTable(services) {
  const table = document.getElementById('exposed-services-table');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!services || services.length === 0) {
    tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4">Aucun service exposé détecté</td></tr>';
    document.getElementById('services-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
    return;
  }
  
  // Compter les services à risque
  const riskyServices = services.filter(service => service.risk !== 'low').length;
  
  // Mettre à jour le statut
  if (riskyServices > 0) {
    document.getElementById('services-status').innerHTML = 
      `<i class="fas fa-exclamation-circle status-warning"></i> ${riskyServices} à risque`;
  } else {
    document.getElementById('services-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
  }
  
  // Remplir le tableau
  services.forEach(service => {
    const tr = document.createElement('tr');
    
    const serviceTd = document.createElement('td');
    serviceTd.textContent = service.name;
    
    const portTd = document.createElement('td');
    portTd.textContent = service.port;
    
    const stateTd = document.createElement('td');
    stateTd.textContent = service.state;
    
    const riskTd = document.createElement('td');
    const riskBadge = document.createElement('span');
    riskBadge.className = `risk-badge risk-${service.risk}`;
    riskBadge.textContent = service.risk;
    riskTd.appendChild(riskBadge);
    
    tr.appendChild(serviceTd);
    tr.appendChild(portTd);
    tr.appendChild(stateTd);
    tr.appendChild(riskTd);
    
    tbody.appendChild(tr);
  });
}

// Fonction pour mettre à jour le tableau des vulnérabilités
function updateVulnerabilitiesTable(vulnerabilities) {
  const table = document.getElementById('vulnerabilities-table');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!vulnerabilities || vulnerabilities.length === 0) {
    tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4">Aucune vulnérabilité détectée</td></tr>';
    document.getElementById('vulnerabilities-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
    return;
  }
  
  // Compter les problèmes critiques
  const criticalVulnerabilities = vulnerabilities.filter(v => v.level === 'high').length;
  
  // Mettre à jour le statut
  if (criticalVulnerabilities > 0) {
    document.getElementById('vulnerabilities-status').innerHTML = 
      `<i class="fas fa-exclamation-triangle status-critical"></i> ${criticalVulnerabilities} critique(s)`;
  } else {
    document.getElementById('vulnerabilities-status').innerHTML = 
      `<i class="fas fa-exclamation-circle status-warning"></i> ${vulnerabilities.length} mineur(s)`;
  }
  
  // Remplir le tableau
  vulnerabilities.forEach(vulnerability => {
    const tr = document.createElement('tr');
    
    const issueTd = document.createElement('td');
    issueTd.textContent = vulnerability.issue;
    
    const descriptionTd = document.createElement('td');
    descriptionTd.textContent = vulnerability.description;
    
    const levelTd = document.createElement('td');
    const levelBadge = document.createElement('span');
    levelBadge.className = `risk-badge risk-${vulnerability.level}`;
    levelBadge.textContent = vulnerability.level;
    levelTd.appendChild(levelBadge);
    
    const recommendationTd = document.createElement('td');
    recommendationTd.textContent = vulnerability.recommendation;
    
    tr.appendChild(issueTd);
    tr.appendChild(descriptionTd);
    tr.appendChild(levelTd);
    tr.appendChild(recommendationTd);
    
    tbody.appendChild(tr);
  });
}

// Fonction pour mettre à jour le tableau des fichiers modifiés
function updateModifiedFilesTable(files) {
  const table = document.getElementById('modified-files-table');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (!files || files.length === 0) {
    tbody.innerHTML = '<tr class="placeholder-row"><td colspan="4">Aucun fichier modifié récemment</td></tr>';
    document.getElementById('files-status').innerHTML = '<i class="fas fa-check-circle status-good"></i>';
    return;
  }
  
  // Mettre à jour le statut
  document.getElementById('files-status').innerHTML = 
    `<i class="fas fa-info-circle"></i> ${files.length} fichiers`;
  
  // Remplir le tableau
  files.forEach(file => {
    const tr = document.createElement('tr');
    
    const filenameTd = document.createElement('td');
    filenameTd.textContent = file.name;
    
    const pathTd = document.createElement('td');
    pathTd.textContent = file.path;
    
    const modificationDateTd = document.createElement('td');
    modificationDateTd.textContent = new Date(file.mtime).toLocaleString();
    
    const userTd = document.createElement('td');
    userTd.textContent = file.user;
    
    tr.appendChild(filenameTd);
    tr.appendChild(pathTd);
    tr.appendChild(modificationDateTd);
    tr.appendChild(userTd);
    
    tbody.appendChild(tr);
  });
}

// Fonction pour exporter le rapport de sécurité
function exportSecurityReport() {
  if (!securityData.lastAuditTime) {
    showAlert('Veuillez effectuer un audit de sécurité avant d\'exporter le rapport', 'warning');
    return;
  }
  
  // Créer le rapport HTML
  let reportContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport de Sécurité - LaborEssence Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; }
        .report-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .report-header { text-align: center; margin-bottom: 30px; }
        .report-header h1 { margin-bottom: 10px; color: #2496ed; }
        .report-header p { color: #666; }
        .report-section { margin-bottom: 30px; }
        .report-section h2 { color: #2496ed; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f8f8; }
        .score-section { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
        .score-circle { width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white; }
        .risk-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .risk-low { background-color: #27ae60; color: white; }
        .risk-medium { background-color: #f39c12; color: white; }
        .risk-high { background-color: #e74c3c; color: white; }
        .footer { text-align: center; margin-top: 40px; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="report-container">
        <div class="report-header">
          <h1>Rapport d'audit de sécurité</h1>
          <p>Généré le ${new Date().toLocaleString()} via LaborEssence Dashboard</p>
        </div>
        
        <div class="report-section">
          <h2>Résumé de la sécurité</h2>
          <div class="score-section">
            <div class="score-circle" style="background-color: ${securityData.securityScore >= 70 ? '#27ae60' : securityData.securityScore >= 50 ? '#f39c12' : '#e74c3c'}">
              ${securityData.securityScore}%
            </div>
            <div>
              <p><strong>Dernier audit:</strong> ${new Date(securityData.lastAuditTime).toLocaleString()}</p>
              <p><strong>Résumé:</strong> ${document.getElementById('security-summary-text').innerText}</p>
            </div>
          </div>
        </div>
  `;
  
  // Ajouter les sections du rapport
  
  // Ports ouverts
  reportContent += `
    <div class="report-section">
      <h2>Ports ouverts</h2>
      <table>
        <thead>
          <tr>
            <th>Port</th>
            <th>Service</th>
            <th>État</th>
            <th>Risque</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (securityData.openPorts && securityData.openPorts.length > 0) {
    securityData.openPorts.forEach(port => {
      reportContent += `
        <tr>
          <td>${port.port}</td>
          <td>${port.service}</td>
          <td>${port.state}</td>
          <td><span class="risk-badge risk-${port.risk}">${port.risk}</span></td>
        </tr>
      `;
    });
  } else {
    reportContent += `<tr><td colspan="4" style="text-align: center;">Aucun port ouvert détecté</td></tr>`;
  }
  
  reportContent += `
        </tbody>
      </table>
    </div>
  `;
  
  // Utilisateurs root
  reportContent += `
    <div class="report-section">
      <h2>Utilisateurs avec privilèges root</h2>
      <table>
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>UID</th>
            <th>Groupe</th>
            <th>Shell</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (securityData.rootUsers && securityData.rootUsers.length > 0) {
    securityData.rootUsers.forEach(user => {
      reportContent += `
        <tr>
          <td>${user.username}</td>
          <td>${user.uid}</td>
          <td>${user.group}</td>
          <td>${user.shell}</td>
        </tr>
      `;
    });
  } else {
    reportContent += `<tr><td colspan="4" style="text-align: center;">Aucun utilisateur root trouvé</td></tr>`;
  }
  
  reportContent += `
        </tbody>
      </table>
    </div>
  `;
  
  // Vulnérabilités
  reportContent += `
    <div class="report-section">
      <h2>Vulnérabilités détectées</h2>
      <table>
        <thead>
          <tr>
            <th>Problème</th>
            <th>Description</th>
            <th>Niveau</th>
            <th>Recommandation</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (securityData.vulnerabilities && securityData.vulnerabilities.length > 0) {
    securityData.vulnerabilities.forEach(vulnerability => {
      reportContent += `
        <tr>
          <td>${vulnerability.issue}</td>
          <td>${vulnerability.description}</td>
          <td><span class="risk-badge risk-${vulnerability.level}">${vulnerability.level}</span></td>
          <td>${vulnerability.recommendation}</td>
        </tr>
      `;
    });
  } else {
    reportContent += `<tr><td colspan="4" style="text-align: center;">Aucune vulnérabilité détectée</td></tr>`;
  }
  
  reportContent += `
        </tbody>
      </table>
    </div>
  `;
  
  // Fichiers modifiés
  reportContent += `
    <div class="report-section">
      <h2>Fichiers modifiés récemment</h2>
      <table>
        <thead>
          <tr>
            <th>Fichier</th>
            <th>Chemin</th>
            <th>Date de modification</th>
            <th>Utilisateur</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (securityData.modifiedFiles && securityData.modifiedFiles.length > 0) {
    securityData.modifiedFiles.forEach(file => {
      reportContent += `
        <tr>
          <td>${file.name}</td>
          <td>${file.path}</td>
          <td>${new Date(file.mtime).toLocaleString()}</td>
          <td>${file.user}</td>
        </tr>
      `;
    });
  } else {
    reportContent += `<tr><td colspan="4" style="text-align: center;">Aucun fichier modifié récemment</td></tr>`;
  }
  
  reportContent += `
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <p>Ce rapport a été généré automatiquement par LaborEssence Dashboard. Pour plus d'informations, veuillez consulter la documentation.</p>
    </div>
    
    </div>
    </body>
    </html>
  `;
  
  // Créer un blob avec le contenu du rapport
  const blob = new Blob([reportContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Créer un lien pour télécharger le rapport
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-securite-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showAlert('Rapport de sécurité exporté avec succès', 'success');
} 
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
  apiKey: 'labordashboard2024', // Clé API pour les appels sécurisés
  currentHistoryPeriod: '24h',
  systemHistory: [],
  websiteHistory: [],
  securityData: null,
  securityRefreshInterval: null
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
let securityData = null;
let securityScoreChart = null;

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

// Fonction pour initialiser tous les graphiques
function initAllCharts() {
  // Initialiser les charts principaux
  initCharts();
  
  // Initialiser les charts d'historique
  initHistoryCharts();
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
    console.log('📣 [DEBUG] Chargement de l\'historique pour la période:', period);
    const apiBase = window.location.origin;
    
    // Charger l'historique système
    const systemResponse = await fetch(`${apiBase}/api/history/system?period=${period}`, {
      headers: {
        'x-api-key': appState.apiKey
      }
    });
    
    if (!systemResponse.ok) {
      throw new Error(`Erreur HTTP: ${systemResponse.status}`);
    }
    
    appState.systemHistory = await systemResponse.json();
    console.log(`📣 [DEBUG] Historique système chargé: ${appState.systemHistory.length} entrées`);
    
    // Charger l'historique du site web
    const websiteResponse = await fetch(`${apiBase}/api/history/website?period=${period}`, {
      headers: {
        'x-api-key': appState.apiKey
      }
    });
    
    if (!websiteResponse.ok) {
      throw new Error(`Erreur HTTP: ${websiteResponse.status}`);
    }
    
    appState.websiteHistory = await websiteResponse.json();
    console.log(`📣 [DEBUG] Historique web chargé: ${appState.websiteHistory.length} entrées`);
    
    // Mettre à jour les graphiques
    updateHistoryCharts();
  } catch (error) {
    console.error('❌ [ERREUR] lors du chargement de l\'historique:', error);
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
  // Masquer toutes les sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Désactiver tous les liens de navigation
  document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.classList.remove('active');
  });
  
  // Afficher la section demandée
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  
  // Mettre à jour le titre de la page
    const pageTitle = document.querySelector('.page-title h2');
    if (pageTitle) {
      // Trouver le texte du lien correspondant
      const navLink = document.querySelector(`.sidebar-nav a[href="#${sectionId}"]`);
      pageTitle.innerHTML = navLink ? navLink.innerHTML : 'Dashboard';
    }
    
    // Activer le lien de navigation correspondant
    const navItem = document.querySelector(`.sidebar-nav a[href="#${sectionId}"]`).parentNode;
    navItem.classList.add('active');
    
    // Actions spécifiques selon la section
    if (sectionId === 'containers-section') {
      // Rafraîchir la liste des containers
      updateContainersList(appState.containers);
    } else if (sectionId === 'logs-section') {
      // Mise à jour du sélecteur de containers
      updateContainerSelector();
    }
  }
}

// Fonction pour basculer la sidebar
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('collapsed');
}

// Fonction pour appliquer le thème
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Mettre à jour les couleurs des graphiques
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#333333';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  
  // Mettre à jour tous les graphiques
  if (cpuDonutChart) {
    cpuDonutChart.options.plugins.legend.labels.color = textColor;
    cpuDonutChart.update();
  }
  if (memoryDonutChart) {
    memoryDonutChart.options.plugins.legend.labels.color = textColor;
    memoryDonutChart.update();
  }
  if (resourcesChart) {
    resourcesChart.options.scales.x.grid.color = gridColor;
    resourcesChart.options.scales.y.grid.color = gridColor;
    resourcesChart.options.scales.x.ticks.color = textColor;
    resourcesChart.options.scales.y.ticks.color = textColor;
    resourcesChart.update();
  }
}

// Fonction pour basculer le thème
function switchTheme(theme) {
  appState.selectedTheme = theme;
  applyTheme(theme);
  
  // Mettre à jour l'interface
  document.querySelectorAll('.theme-option').forEach(option => {
    option.classList.toggle('active', option.dataset.theme === theme);
  });
  
  // Mettre à jour le switch
  const themeSwitch = document.querySelector('.theme-switch input');
  if (themeSwitch) {
    themeSwitch.checked = theme === 'dark';
  }
}

// Fonction pour appliquer les paramètres d'apparence
function applyAppearanceSettings() {
  // Appliquer le thème
  applyTheme(appState.selectedTheme);
  
  // Appliquer le mode compact
  document.body.classList.toggle('compact-mode', appState.compactMode);
  
  // Appliquer les animations
  document.body.classList.toggle('animations-enabled', appState.animationEnabled);
  
  // Appliquer la couleur principale
  document.documentElement.style.setProperty('--primary-color', appState.primaryColor);
  
  // Mettre à jour les graphiques
  if (cpuDonutChart) {
    cpuDonutChart.data.datasets[0].backgroundColor[0] = appState.primaryColor;
    cpuDonutChart.update();
  }
  if (memoryDonutChart) {
    memoryDonutChart.data.datasets[0].backgroundColor[0] = appState.primaryColor;
    memoryDonutChart.update();
  }
  if (resourcesChart) {
    resourcesChart.data.datasets[0].borderColor = appState.primaryColor;
    resourcesChart.data.datasets[0].backgroundColor = `${appState.primaryColor}20`;
    resourcesChart.update();
  }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
  // Récupérer les paramètres sauvegardés
  const savedTheme = localStorage.getItem('theme');
  const savedCompactMode = localStorage.getItem('compactMode') === 'true';
  const savedAnimationEnabled = localStorage.getItem('animationEnabled') !== 'false';
  const savedPrimaryColor = localStorage.getItem('primaryColor') || '#0db7ed';
  
  // Appliquer les paramètres
  appState.selectedTheme = savedTheme || 'light';
  appState.compactMode = savedCompactMode;
  appState.animationEnabled = savedAnimationEnabled;
  appState.primaryColor = savedPrimaryColor;
  
  // Appliquer les paramètres d'apparence
  applyAppearanceSettings();
  
  // Gestionnaire pour le switch de thème
  const themeSwitch = document.querySelector('.theme-switch input');
  if (themeSwitch) {
    themeSwitch.addEventListener('change', function() {
      const newTheme = this.checked ? 'dark' : 'light';
      switchTheme(newTheme);
    });
  }
  
  // Gestionnaires pour les paramètres d'apparence
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', function() {
      const theme = this.dataset.theme;
      switchTheme(theme);
    });
  });
  
  document.getElementById('compact-mode').addEventListener('change', function() {
    appState.compactMode = this.checked;
    localStorage.setItem('compactMode', this.checked);
    applyAppearanceSettings();
  });
  
  document.getElementById('chart-animations').addEventListener('change', function() {
    appState.animationEnabled = this.checked;
    localStorage.setItem('animationEnabled', this.checked);
    applyAppearanceSettings();
  });
  
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
      const color = this.dataset.color;
      appState.primaryColor = color;
      localStorage.setItem('primaryColor', color);
      applyAppearanceSettings();
    });
  });
});

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
  exportButton.addEventListener('click', exportReport);
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
  try {
    const response = await fetch(`/api/containers/${containerId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': appState.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    showAlert(`Conteneur ${action} avec succès`, 'success');
    updateContainersList(); // Rafraîchir la liste des conteneurs
  } catch (error) {
    console.error(`Erreur lors de ${action} du conteneur:`, error);
    showAlert(`Erreur lors de ${action} du conteneur: ${error.message}`, 'error');
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
  console.log('📣 [DEBUG] Initialisation de l\'application...');
  
  // Initialiser les graphiques
  initAllCharts();
  
  // Charger l'historique initial
  loadHistory('24h');
  
  // Appliquer le thème sauvegardé
  switchTheme(appState.selectedTheme);
  
  // Activer la section par défaut
  switchSection(appState.activeSection);
  
  // Gestionnaires d'événements
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const sectionId = link.getAttribute('href').substring(1); // Enlever le #
      switchSection(sectionId);
      
      // Fermer la sidebar sur mobile après la navigation
      if (window.innerWidth < 768) {
        document.querySelector('.sidebar').classList.add('collapsed');
      }
    });
    });
  });
  
// Fonction pour charger la documentation
async function loadDocumentation() {
  try {
    // Charger la documentation générale
    const response = await fetch('/api/documentation', {
      headers: {
        'x-api-key': appState.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    const documentation = await response.json();
    updateDocumentationUI(documentation);

    // Mettre à jour les liens de documentation
    const documentationLinks = document.querySelectorAll('.read-more');
    documentationLinks.forEach(link => {
      const title = link.closest('.documentation-item').querySelector('h4').textContent;
      switch(title) {
        case 'Prise en main':
          link.href = '/docs/getting-started';
          break;
        case 'Fonctionnalités principales':
          link.href = '/docs/features';
          break;
        case 'Documentation technique':
          link.href = '/wiki/architecture';
          break;
        case 'Questions fréquentes':
          link.href = '/wiki/api';
          break;
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement de la documentation:', error);
    showAlert('Erreur lors du chargement de la documentation. Veuillez réessayer.', 'error');
  }
}

// Fonction pour mettre à jour l'interface de documentation
function updateDocumentationUI(documentation) {
  // Mise à jour des guides
  const guidesContainer = document.querySelector('.documentation-content');
  if (guidesContainer && documentation.guides) {
    guidesContainer.innerHTML = documentation.guides.map(guide => `
      <div class="documentation-item">
        <h4>${guide.title}</h4>
        <p>${guide.description}</p>
        <a href="${guide.link}" class="read-more">Lire plus <i class="fas fa-arrow-right"></i></a>
      </div>
    `).join('');
  }
}

// Fonction pour lancer un audit de sécurité
async function runSecurityAudit() {
  try {
    const response = await fetch('/api/security/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': appState.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    const securityData = await response.json();
    updateSecurityUI(securityData);
  } catch (error) {
    console.error('Erreur lors de l\'audit de sécurité:', error);
    showAlert('Erreur lors de l\'audit de sécurité. Veuillez réessayer.', 'error');
  }
}

// Fonction pour mettre à jour l'interface de sécurité
function updateSecurityUI(securityData) {
  // Mise à jour du score de sécurité
  const scoreElement = document.getElementById('security-score-value');
  if (scoreElement) {
    scoreElement.textContent = securityData.score || '-';
  }
  
  // Mise à jour de la date du dernier audit
  const lastAuditElement = document.getElementById('last-audit-time');
  if (lastAuditElement) {
    lastAuditElement.textContent = securityData.lastAudit || '-';
  }
  
  // Mise à jour des ports ouverts
  updateTable('open-ports-table', securityData.openPorts);
  
  // Mise à jour des utilisateurs root
  updateTable('root-users-table', securityData.rootUsers);
  
  // Mise à jour des vulnérabilités
  updateTable('vulnerabilities-table', securityData.vulnerabilities);
}

// Fonction utilitaire pour mettre à jour les tableaux
function updateTable(tableId, data) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">Aucune donnée disponible</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(item => `
    <tr>
      ${Object.values(item).map(value => `<td>${value}</td>`).join('')}
    </tr>
  `).join('');
}

// Ajout des écouteurs d'événements
document.addEventListener('DOMContentLoaded', () => {
  // Écouteur pour le bouton d'audit de sécurité
  const auditButton = document.getElementById('run-security-audit');
  if (auditButton) {
    auditButton.addEventListener('click', runSecurityAudit);
  }
  
  // Chargement initial de la documentation
  loadDocumentation();
});

// Gestion des clics sur les liens de documentation
document.addEventListener('DOMContentLoaded', function() {
  const documentationLinks = document.querySelectorAll('.read-more');
  
  documentationLinks.forEach(link => {
    link.addEventListener('click', async function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      
      try {
        const response = await fetch(href);
        const data = await response.json();
        
        // Créer une modale pour afficher le contenu
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
          <div class="modal-content">
            <div class="modal-header">
              <h3>${data.title}</h3>
              <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              ${data.content}
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
        
        // Gérer la fermeture de la modale
        const closeButton = modal.querySelector('.modal-close');
        closeButton.addEventListener('click', () => {
          modal.remove();
        });
        
        // Fermer la modale en cliquant en dehors
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
          }
        });
      } catch (error) {
        console.error('Erreur lors du chargement de la documentation:', error);
        alert('Erreur lors du chargement de la documentation');
      }
    });
    });
  });
  
// Fonction pour exporter le rapport PDF
async function exportReport() {
  try {
    const response = await fetch('/api/system', {
      headers: {
        'x-api-key': appState.apiKey
      }
    });
    const systemData = await response.json();
    
    const containersResponse = await fetch('/api/containers', {
      headers: {
        'x-api-key': appState.apiKey
      }
    });
    const containersData = await containersResponse.json();
    
    const securityResponse = await fetch('/api/security/data', {
      headers: {
        'x-api-key': appState.apiKey
      }
    });
    const securityData = await securityResponse.json();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Titre
    doc.setFontSize(20);
    doc.text('Rapport de Monitoring', 20, 20);

    // Informations système
    doc.setFontSize(12);
    doc.text('Informations Système:', 20, 40);
    doc.text(`Hostname: ${systemData.hostname}`, 20, 50);
    doc.text(`Platform: ${systemData.platform}`, 20, 60);
    doc.text(`Uptime: ${formatUptime(systemData.uptime)}`, 20, 70);
    doc.text(`CPU Count: ${systemData.cpuCount}`, 20, 80);
    doc.text(`Total Memory: ${formatMemorySize(systemData.totalMemory)}`, 20, 90);

    // Statistiques des conteneurs
    doc.text('Statistiques des Conteneurs:', 20, 110);
    doc.text(`Total: ${containersData.length}`, 20, 120);
    doc.text(`En cours: ${containersData.filter(c => c.state === 'running').length}`, 20, 130);

    // Liste des conteneurs
    doc.text('Liste des Conteneurs:', 20, 150);
    let y = 160;
    containersData.forEach(container => {
      doc.text(`- ${container.name} (${container.id})`, 20, y);
      doc.text(`  Image: ${container.image}`, 20, y + 10);
      doc.text(`  État: ${container.state}`, 20, y + 20);
      doc.text(`  Ports: ${container.ports.join(', ')}`, 20, y + 30);
      y += 50;
    });

    // Informations de sécurité
    doc.text('Informations de Sécurité:', 20, y + 20);
    doc.text(`Score de sécurité: ${securityData.score}`, 20, y + 30);
    doc.text(`Dernier audit: ${new Date(securityData.lastAudit).toLocaleString()}`, 20, y + 40);

    // Sauvegarder le PDF
    const date = new Date().toISOString().split('T')[0];
    doc.save(`rapport-monitoring-${date}.pdf`);
  } catch (error) {
    console.error('Erreur lors de la génération du rapport:', error);
    showAlert('Erreur lors de la génération du rapport. Veuillez réessayer.', 'error');
  }
}

// Ajouter l'écouteur d'événements pour le bouton d'export
document.addEventListener('DOMContentLoaded', () => {
  const exportButton = document.getElementById('export-report');
  if (exportButton) {
    exportButton.addEventListener('click', exportReport);
  }
}); 
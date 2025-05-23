// Importa módulos do Electron para comunicação entre processos
const { contextBridge, ipcRenderer } = require('electron')

// Expõe API segura para o frontend acessar funcionalidades do Electron
contextBridge.exposeInMainWorld('electronAPI', {
  // Autenticação e Navegação
  login: (credentials) => ipcRenderer.invoke('user-login', credentials),
  register: (userData) => ipcRenderer.invoke('user-register', userData), // Essencial para o registro
  logout: () => ipcRenderer.send('user-logout'),
  getUserData: () => ipcRenderer.invoke('get-user-data'),
  navigateTo: (page) => ipcRenderer.send('navigate-to', page),

  // Funcionalidades específicas dos Dashboards
  getAllPatientsForDoctorView: () => ipcRenderer.invoke('get-all-patients-for-doctor-view'),
  getScheduledAppointments: (patientUserId) => ipcRenderer.invoke('get-scheduled-appointments', patientUserId),
  scheduleAppointment: (appointmentData) => ipcRenderer.invoke('schedule-appointment', appointmentData),
  
  // Funções para upload e listagem de arquivos (implementação básica no backend)
  uploadPatientFile: (fileData) => ipcRenderer.invoke('upload-patient-file', fileData),
  getPatientFiles: (patientUserId) => ipcRenderer.invoke('get-patient-files', patientUserId),

  // Função para abrir diálogo de seleção de arquivo (exemplo, se for usar para upload)
  selectFile: () => ipcRenderer.invoke('dialog:openFile')
});

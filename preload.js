// Importa módulos do Electron para comunicação entre processos
const { contextBridge, ipcRenderer } = require('electron')

// Expõe API segura para o frontend acessar funcionalidades do Electron
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('user-login', credentials),
  register: (userData) => ipcRenderer.invoke('user-register', userData),
  logout: () => ipcRenderer.send('user-logout'),
  getUserData: () => ipcRenderer.invoke('get-user-data'),
  
  // Navigation
  navigateTo: (page) => ipcRenderer.send('navigate-to', page),

  // Doctor specific
  getAllPatients: () => ipcRenderer.invoke('get-all-patients'),
  scheduleAppointment: (appointmentData) => ipcRenderer.invoke('schedule-appointment', appointmentData),
  uploadPatientFile: (fileData) => ipcRenderer.invoke('upload-patient-file', fileData),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Patient specific
  getPatientAppointments: (patientId) => ipcRenderer.invoke('get-patient-appointments', patientId),
  getPatientFiles: (patientId) => ipcRenderer.invoke('get-patient-files', patientId),

  // General file operations
  openFileExternally: (filePath) => ipcRenderer.send('open-file-externally', filePath),
  onFileOpenError: (callback) => ipcRenderer.on('file-open-error', (_event, message) => callback(message))
})
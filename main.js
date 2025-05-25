// Importa os módulos necessários do Electron e outras dependências
const { app, BrowserWindow, ipcMain, dialog } = require('electron');

// DESABILITA A ACELERAÇÃO DE HARDWARE PARA TENTAR RESOLVER PROBLEMAS DE RENDERIZAÇÃO
app.disableHardwareAcceleration();

const path = require('path');
const fs = require('fs');
const { db, hashPassword, comparePassword } = require('./src/database/db'); //

// Variáveis globais para gerenciar o estado da aplicação
let mainWindow; //
let currentUser = null; //

/**
 * Cria a janela principal da aplicação
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920, //
    height: 1080, //
    frame: false, //
    fullscreen: false, //
    webPreferences: { //
      nodeIntegration: false, //
      contextIsolation: true, //
      enableRemoteModule: false, //
      preload: path.join(__dirname, 'preload.js') //
    }
  });
  mainWindow.loadFile('src/pages/auth/login.html'); //
  mainWindow.on('closed', () => { //
    mainWindow = null; //
  });
}

// Função auxiliar para forçar repintura da UI
function forceUIRefresh(windowInstance, reason = "generic") {
  if (windowInstance && !windowInstance.isDestroyed()) {
    console.log(`Forçando atualização da UI devido a: ${reason}`);
    if (windowInstance.isMinimizable() && !windowInstance.isMinimized()) {
      windowInstance.minimize();
      console.log("Janela minimizada para forçar repintura.");

      setTimeout(() => {
        if (windowInstance && !windowInstance.isDestroyed()) {
          if (windowInstance.isMinimized()) {
            windowInstance.restore();
            console.log("Janela restaurada.");
          }
          windowInstance.webContents.focus();
          if (windowInstance.webContents) {
            windowInstance.webContents.invalidate();
            console.log("webContents invalidado após restaurar.");
          }
        }
      }, 50); // Ajuste o delay conforme necessário
    } else {
      // Se não puder minimizar (ex: já minimizado ou não minimizável, ou em alguns ambientes de janela),
      // tenta outras formas de forçar o repaint.
      console.log("Janela não minimizável ou já minimizada. Tentando foco e invalidação direta.");
      windowInstance.webContents.focus();
      if (windowInstance.webContents) {
        windowInstance.webContents.invalidate();
      }
      // Como fallback, uma pequena alteração de tamanho pode ajudar em alguns casos.
      const currentSize = windowInstance.getSize();
      windowInstance.setSize(currentSize[0], currentSize[1] -1);
      setTimeout(() => {
        if(windowInstance && !windowInstance.isDestroyed()){
             windowInstance.setSize(currentSize[0], currentSize[1]);
        }
      }, 20)

    }
  }
}


/**
 * Handler para o evento de login via IPC
 */
ipcMain.handle('user-login', async (_, credentials) => { //
  try {
    const user = await new Promise((resolve, reject) => { //
      db.users.findOne({ email: credentials.email }, (err, userDoc) => { //
        if (err) return reject(err);
        resolve(userDoc);
      });
    });
    if (!user) return { success: false, message: 'Usuário não encontrado' }; //
    if (user.userType !== credentials.userType) { //
      return { success: false, message: 'Tipo de usuário incorreto' }; //
    }
    const isMatch = await comparePassword(credentials.password, user.password); //
    if (!isMatch) return { success: false, message: 'Senha incorreta' }; //

    const userCollection = credentials.userType === 'patient' ? db.patients : db.doctors; //
    const userData = await new Promise((resolve, reject) => { //
      userCollection.findOne({ userId: user._id }, (err, data) => { //
        if (err) return reject(err);
        resolve(data);
      });
    });

    currentUser = { ...user, ...userData }; //
    currentUser.userId = user._id; 
    if (userData && userData._id) { 
        if (credentials.userType === 'patient') currentUser.patientId = userData._id;
        if (credentials.userType === 'doctor') currentUser.doctorId = userData._id;
    }
    
    return { success: true, user: currentUser }; //
  } catch (error) {
    console.error('Erro no login:', error); //
    return { success: false, message: 'Erro no servidor' }; //
  }
});

/**
 * Handler para o evento de registro via IPC
 */
ipcMain.handle('user-register', async (_, userData) => { //
  try {
    const existingUser = await new Promise((resolve, reject) => { //
      db.users.findOne({ email: userData.email }, (err, user) => { //
        if (err) return reject(err);
        resolve(user);
      });
    });
    if (existingUser) return { success: false, message: 'Email já está em uso' }; //

    const hashedPassword = await hashPassword(userData.password); //
    const baseUser = { //
      email: userData.email, //
      password: hashedPassword, //
      userType: userData.userType, //
      createdAt: new Date() //
    };
    const newUser = await new Promise((resolve, reject) => { //
      db.users.insert(baseUser, (err, user) => { //
        if (err) return reject(err);
        resolve(user);
      });
    });

    const specificData = { //
      userId: newUser._id, //
      name: userData.name, //
      email: userData.email 
    };
    if (userData.userType === 'patient') { //
      Object.assign(specificData, { //
        birthDate: userData.birthDate, //
        healthPlan: userData.healthPlan //
      });
    } else { // doctor //
      Object.assign(specificData, { //
        crm: userData.crm, //
        specialty: userData.specialty //
      });
    }
    const collection = userData.userType === 'patient' ? db.patients : db.doctors; //
    await new Promise((resolve, reject) => { //
      collection.insert(specificData, (err, newSpecificDoc) => { //
        if (err) return reject(err);
        resolve(newSpecificDoc);
      });
    });
    return { success: true }; //
  } catch (error) {
    console.error('Erro no registro:', error); //
    return { success: false, message: 'Erro no registro' }; //
  }
});

/**
 * Retorna os dados do usuário atualmente logado
 */
ipcMain.handle('get-user-data', () => currentUser); //

/**
 * Handler para logout do usuário
 */
ipcMain.on('user-logout', () => { //
  currentUser = null;
  const loginPagePath = path.join(__dirname, 'src/pages/auth/login.html');
  const loginUrl = `file://${loginPagePath}?fresh=true`;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(loginUrl)
      .then(() => {
        console.log("Página de login carregada com fresh=true após o logout."); //
        if (mainWindow && !mainWindow.isDestroyed()) { 
          mainWindow.webContents.reloadIgnoringCache(); //
          console.log("Cache ignorado e reload forçado na página de login."); //
          forceUIRefresh(mainWindow, "logout"); 
        }
      })
      .catch(err => {
        console.error('Erro ao carregar a página de login no logout:', err);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadFile(loginPagePath) //
            .then(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.reloadIgnoringCache(); //
                    forceUIRefresh(mainWindow, "logout fallback"); 
                }
            })
            .catch(fallbackErr => console.error('Erro ao carregar a página de login no logout (fallback):', fallbackErr));
        }
      });
  }
});

/**
 * Handler para navegação entre páginas
 */
ipcMain.on('navigate-to', (_, page) => { //
  const [pathWithoutQuery, queryString] = page.split('?'); //
  const loadPath = `src/pages/${pathWithoutQuery}.html`; //
  console.log(`Navigating to: ${loadPath}, Query: ${queryString}`); //

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(loadPath).then(() => { //
      if (mainWindow && !mainWindow.isDestroyed()) {
        let needsUIRefresh = false;
        if (queryString && queryString.includes('fresh=true')) { //
          mainWindow.webContents.reloadIgnoringCache(); //
          console.log(`Cache ignorado para ${loadPath}`);
          
          if (pathWithoutQuery === 'auth/login') {
            needsUIRefresh = true;
          }
        }

        if (needsUIRefresh) {
          forceUIRefresh(mainWindow, `Maps-to (${pathWithoutQuery} com fresh=true)`);
        } else {
           mainWindow.webContents.focus();
        }
      }
    }).catch(err => console.error(`Failed to load page ${loadPath}:`, err)); //
  }
});

// --- HANDLERS PARA DASHBOARD ---

// Handler para buscar todos os pacientes (para o médico)
ipcMain.handle('get-all-patients', async () => {
  try {
    const patients = await new Promise((resolve, reject) => {
      db.patients.find({}, (err, patientDocs) => {
        if (err) return reject(err);
        resolve(patientDocs);
      });
    });
    return { success: true, patients };
  } catch (error) {
    console.error('Erro ao buscar todos os pacientes:', error);
    return { success: false, message: 'Erro ao buscar pacientes.' };
  }
});

// Handler para marcar consulta
ipcMain.handle('schedule-appointment', async (_, { patientId, doctorId, doctorName, patientName, appointmentDate, reason }) => {
  console.log('[schedule-appointment] Iniciado com:', { patientId, doctorId, doctorName, patientName, appointmentDate, reason }); //
  try {
    if (!patientId || !doctorId || !appointmentDate || !reason || !doctorName || !patientName) {
      console.error('[schedule-appointment] Dados incompletos para agendamento.');
      return { success: false, message: 'Dados incompletos para agendamento.' };
    }
    const appointment = {
      patientId,
      doctorId,
      doctorName,
      patientName,
      date: new Date(appointmentDate),
      reason,
      status: 'scheduled',
      createdAt: new Date()
    };
    const newAppointment = await new Promise((resolve, reject) => {
      db.appointments.insert(appointment, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
    return { success: true, appointment: newAppointment };
  } catch (error) {
    console.error('[schedule-appointment] Erro CRÍTICO no handler:', error);
    return { success: false, message: 'Erro no servidor ao marcar consulta.' };
  }
});

// Handler para upload de arquivo
ipcMain.handle('upload-patient-file', async (_, { patientId, doctorId, doctorName, patientName, filePath, fileName, description }) => {
  console.log('[upload-patient-file] Iniciado com:', { patientId, filePath, fileName }); //
  try {
    if (!patientId || !doctorId || !filePath || !fileName || !doctorName || !patientName) {
      console.error('[upload-patient-file] Dados incompletos para upload.');
      return { success: false, message: 'Dados incompletos para upload do arquivo.' };
    }
    const fileData = {
      patientId,
      doctorId,
      doctorName,
      patientName,
      originalPath: filePath,
      fileName,
      description: description || '',
      uploadDate: new Date(),
    };
    const newFile = await new Promise((resolve, reject) => {
      db.patientFiles.insert(fileData, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
    return { success: true, file: newFile };
  } catch (error) {
    console.error('[upload-patient-file] Erro CRÍTICO no handler:', error);
    return { success: false, message: 'Erro no servidor ao registrar arquivo.' };
  }
});

// Handler para buscar consultas de um paciente
ipcMain.handle('get-patient-appointments', async (_, patientId) => {
  try {
    if (!patientId) return { success: false, message: 'ID do Paciente não fornecido.' };
    const appointments = await new Promise((resolve, reject) => {
      db.appointments.find({ patientId }).sort({ date: 1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
    return { success: true, appointments };
  } catch (error) {
    console.error('Erro ao buscar consultas do paciente:', error);
    return { success: false, message: 'Erro ao buscar consultas.' };
  }
});

// Handler para buscar arquivos de um paciente
ipcMain.handle('get-patient-files', async (_, patientId) => {
  try {
    if (!patientId) return { success: false, message: 'ID do Paciente não fornecido.' };
    const files = await new Promise((resolve, reject) => {
      db.patientFiles.find({ patientId }).sort({ uploadDate: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        resolve(docs);
      });
    });
    return { success: true, files };
  } catch (error) {
    console.error('Erro ao buscar arquivos do paciente:', error);
    return { success: false, message: 'Erro ao buscar arquivos.' };
  }
});

// Handler para abrir diálogo de seleção de arquivo
ipcMain.handle('open-file-dialog', async () => {
  console.log('[open-file-dialog] Iniciado.'); //
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('[open-file-dialog] Janela principal não está disponível.');
    return { success: false, message: 'Janela principal não disponível.'};
  }
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'txt', 'odt'] },
        { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    });
    if (result.canceled) {
      console.log('[open-file-dialog] Cancelado pelo usuário.');
      return { success: false, canceled: true };
    } else {
      console.log('[open-file-dialog] Arquivo selecionado:', result.filePaths[0]); //
      return { success: true, filePath: result.filePaths[0] };
    }
  } catch (error) {
      console.error('[open-file-dialog] Erro CRÍTICO no handler:', error);
      return { success: false, message: 'Erro ao abrir diálogo de arquivo.'};
  }
});

// Handler para abrir arquivo com o programa padrão do sistema
ipcMain.on('open-file-externally', (_, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    require('electron').shell.openPath(filePath)
      .then(status => {
        if(status !== "") console.error("Erro ao tentar abrir arquivo:", status);
        else console.log("Arquivo aberto/tentativa enviada ao SO:", filePath);
      })
      .catch(err => {
          console.error("Falha ao abrir arquivo com shell.openPath:", err);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file-open-error', `Não foi possível abrir o arquivo: ${err.message}`);
          }
      });
  } else {
    console.error("Caminho do arquivo inválido ou arquivo não existe:", filePath);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file-open-error', 'Arquivo não encontrado ou caminho inválido.');
    }
  }
});

// Eventos do ciclo de vida do Electron
app.whenReady().then(createWindow); //
app.on('window-all-closed', () => { //
  if (process.platform !== 'darwin') app.quit(); //
});
app.on('activate', () => { //
  if (mainWindow === null) createWindow(); //
});
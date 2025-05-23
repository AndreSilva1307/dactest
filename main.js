// Importa os módulos necessários do Electron e outras dependências
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs'); 
const { db, hashPassword, comparePassword } = require('./src/database/db');

// Variáveis globais
let mainWindow;
let currentUser = null;

const patientFilesDir = path.join(app.getPath('userData'), 'patient_files');
if (!fs.existsSync(patientFilesDir)) {
  fs.mkdirSync(patientFilesDir, { recursive: true });
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile('src/pages/auth/login.html');
  // mainWindow.webContents.openDevTools(); 
  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- Handlers de Autenticação e Navegação ---
ipcMain.handle('user-login', async (_, credentials) => {
  console.log('[Main Process] Tentativa de login recebida:', credentials.email);
  try {
    const user = await new Promise((resolve, reject) => {
      db.users.findOne({ email: credentials.email }, (err, doc) => err ? reject(err) : resolve(doc));
    });
    if (!user) {
        console.log('[Main Process] Usuário não encontrado:', credentials.email);
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (user.userType !== credentials.userType) {
        console.log('[Main Process] Tipo de usuário incorreto para:', credentials.email, 'Esperado:', credentials.userType, 'Encontrado:', user.userType);
        return { success: false, message: 'Tipo de usuário incorreto para esta interface.' };
    }
    const isMatch = await comparePassword(credentials.password, user.password);
    if (!isMatch) {
        console.log('[Main Process] Senha incorreta para:', credentials.email);
        return { success: false, message: 'Senha incorreta.' };
    }

    const userCollection = user.userType === 'patient' ? db.patients : db.doctors;
    const userData = await new Promise((resolve, reject) => {
      userCollection.findOne({ userId: user._id }, (err, data) => err ? reject(err) : resolve(data));
    });
    if (!userData) {
        console.error('[Main Process] Dados específicos não encontrados para usuário:', user._id, user.email);
        return { success: false, message: 'Erro crítico: Dados complementares do usuário não encontrados.' };
    }
    
    currentUser = { ...user, ...userData }; // Combina dados de 'users' e da coleção específica (patients/doctors)
    console.log('[Main Process] Login bem-sucedido para:', currentUser.email);
    return { success: true, user: currentUser };
  } catch (error) {
    console.error('[Main Process] Erro interno no processo de login:', error);
    return { success: false, message: 'Erro no servidor durante o login. Tente novamente.' };
  }
});

ipcMain.handle('user-register', async (_, userData) => {
  console.log('[Main Process] Pedido de registro recebido para:', userData.email);
  try {
    // 1. Verificar se o email já existe na coleção 'users'
    const existingUser = await new Promise((resolve, reject) => {
      db.users.findOne({ email: userData.email }, (err, user) => {
        if (err) {
          console.error('[Main Process] Erro ao verificar email existente:', err);
          return reject(new Error('Erro ao verificar email.')); // Rejeitar com um erro claro
        }
        resolve(user);
      });
    });

    if (existingUser) {
      console.log('[Main Process] Tentativa de registrar email já existente:', userData.email);
      return { success: false, message: 'Este email já está cadastrado.' };
    }

    // 2. Criptografar a senha
    const hashedPassword = await hashPassword(userData.password);
    
    // 3. Criar o registro base do usuário na coleção 'users'
    const baseUser = {
      email: userData.email,
      password: hashedPassword,
      userType: userData.userType,
      createdAt: new Date()
    };
    const newUser = await new Promise((resolve, reject) => {
      db.users.insert(baseUser, (err, userDoc) => {
        if (err) {
          console.error('[Main Process] Erro ao inserir usuário base (db.users):', err);
          return reject(new Error('Erro ao criar registro de usuário.'));
        }
        console.log('[Main Process] Usuário base criado com ID:', newUser._id);
        resolve(userDoc);
      });
    });

    // 4. Preparar e inserir dados específicos na coleção 'patients' ou 'doctors'
    const specificData = {
      userId: newUser._id, // MUITO IMPORTANTE: linkar com o _id da coleção 'users'
      name: userData.name,
      email: userData.email // Redundante, mas pode ser útil para buscas diretas
    };

    let specificCollection;
    if (userData.userType === 'patient') {
      Object.assign(specificData, {
        birthDate: userData.birthDate, // Frontend envia como string AAAA-MM-DD
        healthPlan: userData.healthPlan || '' // Garante que healthPlan exista
      });
      specificCollection = db.patients;
    } else if (userData.userType === 'doctor') {
      Object.assign(specificData, {
        crm: userData.crm,
        specialty: userData.specialty || '' // Garante que specialty exista
      });
      specificCollection = db.doctors;
    } else {
      // Tipo de usuário inválido - deveria ter sido pego no frontend, mas é bom ter um fallback
      console.error('[Main Process] Tipo de usuário inválido no registro:', userData.userType);
      // Rollback: remover o usuário da coleção 'users'
      await new Promise((resolve, reject) => db.users.remove({ _id: newUser._id }, {}, (err) => err ? reject(err) : resolve()) );
      return { success: false, message: 'Tipo de usuário inválido fornecido.' };
    }

    await new Promise((resolve, reject) => {
      specificCollection.insert(specificData, (err, newSpecificDoc) => {
        if (err) {
          console.error('[Main Process] Erro ao inserir dados específicos (db.patients/doctors):', err);
          // Rollback: remover o usuário da coleção 'users'
           db.users.remove({ _id: newUser._id }, {}, (removeErr) => {
            if(removeErr) console.error("[Main Process] Erro ao tentar fazer rollback do usuário base:", removeErr);
          });
          return reject(new Error('Erro ao salvar informações detalhadas do usuário.'));
        }
        console.log('[Main Process] Dados específicos inseridos para usuário ID:', newUser._id);
        resolve(newSpecificDoc);
      });
    });

    console.log('[Main Process] Registro concluído com sucesso para:', userData.email);
    return { success: true, message: 'Usuário registrado com sucesso!' };
  } catch (error) {
    console.error('[Main Process] Erro geral no handler user-register:', error.message, error.stack);
    return { success: false, message: error.message || 'Erro interno no servidor durante o registro. Tente novamente.' };
  }
});


ipcMain.handle('get-user-data', () => currentUser ? { ...currentUser } : null);

ipcMain.on('user-logout', () => {
  console.log('[Main Process] Logout solicitado.');
  currentUser = null;
  if (mainWindow) mainWindow.loadFile('src/pages/auth/login.html');
});

ipcMain.on('navigate-to', (_, page) => {
  console.log('[Main Process] Navegando para:', page);
  if (!mainWindow) return;
  const [pathPart, queryPart] = page.split('?');
  const targetPagePath = `src/pages/${pathPart}.html`;
  
  mainWindow.loadFile(targetPagePath).then(() => {
    if (queryPart && queryPart.includes('fresh=true')) {
      console.log('[Main Process] Forçando recarregamento de:', targetPagePath);
      mainWindow.webContents.reloadIgnoringCache();
    }
  }).catch(err => console.error(`[Main Process] Falha ao carregar a página ${targetPagePath}:`, err));
});

// --- Handlers para Dashboards ---
ipcMain.handle('get-all-patients-for-doctor-view', async () => {
  // ... (código existente)
  if (!currentUser || currentUser.userType !== 'doctor') {
    return { success: false, message: 'Acesso não autorizado', patients: [] };
  }
  try {
    const allPatients = await new Promise((resolve, reject) => {
      db.patients.find({}).sort({ name: 1 }).exec((err, docs) => err ? reject(err) : resolve(docs));
    });
    return { success: true, patients: allPatients };
  } catch (error) {
    console.error('[Main Process] Erro ao buscar todos os pacientes:', error);
    return { success: false, message: 'Erro ao buscar pacientes no servidor', patients: [] };
  }
});

ipcMain.handle('get-scheduled-appointments', async (_, patientUserIdFromRequest) => {
  // ... (código existente)
  if (!currentUser || (currentUser.userType === 'patient' && currentUser._id !== patientUserIdFromRequest)) {
     if (currentUser.userType !== 'doctor') { 
          return { success: false, message: 'Não autorizado a ver estes agendamentos', appointments: [] };
      }
  }
  try {
    const appointments = await new Promise((resolve, reject) => {
      db.appointments.find({ patientUserId: patientUserIdFromRequest }).sort({ appointmentDate: 1 }).exec((err, docs) => err ? reject(err) : resolve(docs));
    });
    const appointmentsWithDoctorData = await Promise.all(appointments.map(async (appt) => {
      const doctorDetails = await new Promise((resolve, reject) => {
        db.doctors.findOne({ userId: appt.doctorUserId }, (err, doctorDoc) => err ? reject(err) : resolve(doctorDoc));
      });
      return { ...appt, doctorName: doctorDetails ? doctorDetails.name : 'Médico Desconhecido' };
    }));
    return { success: true, appointments: appointmentsWithDoctorData };
  } catch (error) {
    console.error('[Main Process] Erro ao buscar agendamentos do paciente:', error);
    return { success: false, message: 'Erro no servidor ao buscar agendamentos', appointments: [] };
  }
});

ipcMain.handle('schedule-appointment', async (_, appointmentData) => {
  // ... (código existente)
  const { doctorUserId, patientRecordId, appointmentDate, reason, urgent } = appointmentData;
  if (!currentUser || currentUser.userType !== 'doctor' || currentUser._id !== doctorUserId) {
    return { success: false, message: 'Não autorizado a realizar esta ação.' };
  }
  try {
    const patientRecord = await new Promise((resolve, reject) => {
      db.patients.findOne({ _id: patientRecordId }, (err, patDoc) => err ? reject(err) : resolve(patDoc));
    });
    if (!patientRecord || !patientRecord.userId) {
      return { success: false, message: 'Paciente não encontrado ou dados incompletos.' };
    }
    const patientUsersId = patientRecord.userId;
    const parsedDate = new Date(appointmentDate);
    if (isNaN(parsedDate.getTime())) return { success: false, message: 'Formato de data inválido.' };

    const newAppointment = {
      doctorUserId, patientUserId: patientUsersId, appointmentDate: parsedDate,
      reason: reason || 'Não especificado', notes: '', urgent: !!urgent,
      status: 'Marcada', createdAt: new Date()
    };
    const createdAppointment = await new Promise((resolve, reject) => {
      db.appointments.insert(newAppointment, (err, doc) => err ? reject(err) : resolve(doc));
    });
    return { success: true, message: 'Consulta agendada com sucesso!', appointment: createdAppointment };
  } catch (error) {
    console.error('[Main Process] Erro ao agendar consulta:', error);
    return { success: false, message: 'Erro no servidor ao agendar consulta' };
  }
});


// --- HANDLERS PARA UPLOAD DE ARQUIVOS (BÁSICO/PLACEHOLDER) ---
ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return { success: false, files: [] };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'], // Pode adicionar filtros de arquivo aqui
        // filters: [ { name: 'Documentos PDF', extensions: ['pdf'] } ]
    });
    if (canceled || filePaths.length === 0) {
        return { success: false, files: [] };
    }
    return { success: true, filePath: filePaths[0] }; // Retorna o caminho do primeiro arquivo selecionado
});

ipcMain.handle('upload-patient-file', async (_, fileData) => {
  console.log('[Main Process] Pedido de upload de arquivo recebido:', fileData.fileName);
  if (!currentUser || currentUser.userType !== 'doctor') {
    return { success: false, message: 'Acesso não autorizado para upload.' };
  }
  
  const { patientRecordId, fileName, fileType, filePathFromRenderer, description } = fileData;

  if (!patientRecordId || !fileName || !fileType || !filePathFromRenderer) {
    return { success: false, message: 'Dados do arquivo incompletos.' };
  }

  try {
    const patient = await new Promise((resolve, reject) => {
        db.patients.findOne({ _id: patientRecordId }, (err, doc) => err ? reject(err) : resolve(doc));
    });
    if (!patient || !patient.userId) return { success: false, message: 'Paciente não encontrado ou ID de usuário do paciente ausente.' };

    const patientDir = path.join(patientFilesDir, patient.userId); 
    if (!fs.existsSync(patientDir)) {
      fs.mkdirSync(patientDir, { recursive: true });
    }
    const uniqueFileName = `${Date.now()}_${path.basename(fileName)}`; 
    const destinationPath = path.join(patientDir, uniqueFileName);

    // No Electron, o filePathFromRenderer já é o caminho real do arquivo selecionado pelo usuário.
    // Não é um "caminho temporário" no sentido de upload web.
    await fs.promises.copyFile(filePathFromRenderer, destinationPath);

    const fileMetadata = {
      patientUserId: patient.userId, 
      patientRecordId: patient._id,  
      originalFileName: fileName,
      storedFileName: uniqueFileName, 
      // filePath: destinationPath, // Decidir se armazena o caminho completo no DB. Por segurança, pode ser melhor não.
      fileType: fileType,
      fileSize: (await fs.promises.stat(destinationPath)).size, 
      uploadDate: new Date(),
      uploadedByDoctorId: currentUser._id, 
      description: description || '' 
    };

    const savedFileRecord = await new Promise((resolve, reject) => {
      db.medical_files.insert(fileMetadata, (err, newDoc) => err ? reject(err) : resolve(newDoc));
    });
    console.log('[Main Process] Arquivo salvo e metadados registrados:', savedFileRecord._id);
    return { success: true, message: 'Arquivo enviado com sucesso!', fileRecord: savedFileRecord };

  } catch (error) {
    console.error('[Main Process] Erro ao fazer upload do arquivo:', error);
    return { success: false, message: 'Erro no servidor ao processar o upload do arquivo.' };
  }
});

ipcMain.handle('get-patient-files', async (_, patientUserId) => {
  // ... (código existente, mas vamos refinar a verificação de permissão)
  console.log(`[Main Process] Buscando arquivos para patientUserId: ${patientUserId}`);
  if (!currentUser) return { success: false, message: 'Usuário não autenticado.', files: [] };

  let canAccess = false;
  if (currentUser.userType === 'patient' && currentUser._id === patientUserId) {
      canAccess = true;
  } else if (currentUser.userType === 'doctor') {
      // Lógica de permissão para médico:
      // Por agora, permitir acesso a todos os arquivos de pacientes se for médico.
      // Em um sistema real, isso seria restrito (ex: apenas pacientes do médico).
      canAccess = true; 
      console.warn(`[Main Process] Médico ${currentUser.email} acessando arquivos do paciente ${patientUserId}. Em produção, restrinja este acesso.`);
  }

  if (!canAccess) {
      console.warn(`[Main Process] Acesso negado para ${currentUser.email} visualizar arquivos de ${patientUserId}.`);
      return { success: false, message: 'Acesso não autorizado.', files: [] };
  }

  try {
    const files = await new Promise((resolve, reject) => {
      db.medical_files.find({ patientUserId: patientUserId }).sort({ uploadDate: -1 }).exec((err, docs) => {
        if (err) return reject(err);
        // Omitir informações de caminho do arquivo físico por segurança
        resolve(docs.map(doc => {
            const { filePath, storedFileName, ...rest } = doc; // eslint-disable-line no-unused-vars
            return rest;
        }));
      });
    });
    console.log(`[Main Process] Encontrados ${files.length} arquivos para ${patientUserId}.`);
    return { success: true, files: files };
  } catch (error) {
    console.error('[Main Process] Erro ao buscar arquivos do paciente:', error);
    return { success: false, message: 'Erro no servidor ao buscar arquivos.', files: [] };
  }
});

// --- Ciclo de Vida do App Electron ---
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

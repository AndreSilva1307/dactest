// Importa os módulos necessários
const Datastore = require('nedb') 
const path = require('path') 
const bcrypt = require('bcryptjs') 

// Configuração do banco de dados NeDB
const db = {
  users: new Datastore({ 
    filename: path.join(app.getPath('userData'), 'databases', 'users.db'), // Salvar dentro da pasta de dados do app
    autoload: true 
  }),
  patients: new Datastore({ 
    filename: path.join(app.getPath('userData'), 'databases', 'patients.db'),
    autoload: true 
  }),
  doctors: new Datastore({ 
    filename: path.join(app.getPath('userData'), 'databases', 'doctors.db'),
    autoload: true 
  }),
  appointments: new Datastore({
    filename: path.join(app.getPath('userData'), 'databases', 'appointments.db'),
    autoload: true
  }),
  medical_files: new Datastore({
    filename: path.join(app.getPath('userData'), 'databases', 'medical_files.db'),
    autoload: true
  })
};

// Função para garantir que o diretório de bancos de dados exista
function ensureDatabaseDirectory() {
    const dbDir = path.join(app.getPath('userData'), 'databases');
    if (!require('fs').existsSync(dbDir)) {
        require('fs').mkdirSync(dbDir, { recursive: true });
        console.log('Diretório de bancos de dados criado em:', dbDir);
    }
}

// Chamar a função para garantir o diretório ANTES de carregar os Datastores
// Isso precisa ser feito de uma forma que 'app' esteja disponível.
// A melhor forma é fazer isso após o 'app.whenReady()', mas os Datastores são inicializados globalmente.
// Uma alternativa é inicializar os Datastores dentro de uma função chamada após app.whenReady().
// Por simplicidade aqui, vamos assumir que o diretório será criado se não existir
// na primeira vez que o NeDB tentar escrever. Mas o ideal é garantir antes.
// Para este exemplo, vamos manter a criação do diretório aqui, mas note que app.getPath
// pode não estar disponível imediatamente na carga do módulo se este arquivo for importado muito cedo.
// Uma solução mais robusta seria inicializar os DBs em uma função chamada de main.js após 'app.isReady'.

// No entanto, para NeDB, ele cria o arquivo (e diretório se necessário) no primeiro 'insert' se não existir.
// Então, a criação explícita do diretório pode não ser estritamente necessária para NeDB, mas é boa prática.
// Vamos remover a chamada a `ensureDatabaseDirectory()` daqui para evitar problemas com `app.getPath()`
// e confiar que NeDB criará os arquivos. Se houver problemas de permissão, isso precisará ser revisto.


// Cria índices para otimização e integridade dos dados
// É bom chamar ensureIndex após o autoload ter completado.
// Pode-se envolver isso em callbacks ou Promises se o autoload for assíncrono e demorado.
db.users.ensureIndex({ fieldName: 'email', unique: true }, (err) => {
    if (err) console.error("Erro ao criar índice em users.email:", err);
});
db.patients.ensureIndex({ fieldName: 'userId', unique: true }, (err) => {
    if (err) console.error("Erro ao criar índice em patients.userId:", err);
});
db.doctors.ensureIndex({ fieldName: 'userId', unique: true }, (err) => {
    if (err) console.error("Erro ao criar índice em doctors.userId:", err);
});

// Índices para appointments
db.appointments.ensureIndex({ fieldName: 'doctorUserId' }, (err) => {
    if (err) console.error("Erro ao criar índice em appointments.doctorUserId:", err);
});
db.appointments.ensureIndex({ fieldName: 'patientUserId' }, (err) => {
    if (err) console.error("Erro ao criar índice em appointments.patientUserId:", err);
});
db.appointments.ensureIndex({ fieldName: 'appointmentDate' }, (err) => {
    if (err) console.error("Erro ao criar índice em appointments.appointmentDate:", err);
});

// Índices para medical_files
db.medical_files.ensureIndex({ fieldName: 'patientUserId' }, (err) => {
    if (err) console.error("Erro ao criar índice em medical_files.patientUserId:", err);
});
db.medical_files.ensureIndex({ fieldName: 'uploadedByDoctorId' }, (err) => {
    if (err) console.error("Erro ao criar índice em medical_files.uploadedByDoctorId:", err);
});
db.medical_files.ensureIndex({ fieldName: 'uploadDate' }, (err) => {
    if (err) console.error("Erro ao criar índice em medical_files.uploadDate:", err);
});


// Função para criptografar senhas
const hashPassword = async (password) => {
  if (!password) throw new Error("Senha não pode ser vazia para hash.");
  return bcrypt.hash(password, 10); // bcrypt.hash é assíncrono
};

// Função para comparar senhas
const comparePassword = async (candidatePassword, hash) => {
  if (!candidatePassword || !hash) return false; // Evita erro se um dos valores for nulo/undefined
  return bcrypt.compare(candidatePassword, hash); // bcrypt.compare é assíncrono
};

// Exporta as configurações e funções para uso em outros módulos
module.exports = { 
  db, 
  hashPassword, 
  comparePassword 
};

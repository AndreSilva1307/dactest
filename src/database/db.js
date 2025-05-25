// Importa os módulos necessários
const Datastore = require('nedb') // Banco de dados embutido
const path = require('path') // Para manipulação de caminhos de arquivos
const bcrypt = require('bcryptjs') // Para criptografia de senhas

// Configuração do banco de dados NeDB
const db = {
  // Coleção de usuários (armazena credenciais de login)
  users: new Datastore({ 
    filename: path.join(__dirname, 'users.db'), // Arquivo de armazenamento
    autoload: true // Carrega automaticamente o banco de dados
  }),
  
  // Coleção de pacientes (armazena dados específicos)
  patients: new Datastore({ 
    filename: path.join(__dirname, 'patients.db'),
    autoload: true 
  }),
  
  // Coleção de médicos (armazena dados específicos)
  doctors: new Datastore({ 
    filename: path.join(__dirname, 'doctors.db'),
    autoload: true 
  }),

  // Nova coleção para agendamentos
  appointments: new Datastore({
    filename: path.join(__dirname, 'appointments.db'),
    autoload: true
  }),

  // Nova coleção para arquivos de pacientes
  patientFiles: new Datastore({
    filename: path.join(__dirname, 'patientFiles.db'),
    autoload: true
  })
}

// Cria índices únicos para otimização e integridade dos dados
db.users.ensureIndex({ fieldName: 'email', unique: true }) // Email único para usuários
db.patients.ensureIndex({ fieldName: 'userId', unique: true }) // Relação 1:1 com users
db.doctors.ensureIndex({ fieldName: 'userId', unique: true }) // Relação 1:1 com users
db.appointments.ensureIndex({ fieldName: 'patientId' }) // Para buscar consultas por paciente
db.appointments.ensureIndex({ fieldName: 'doctorId' })  // Para buscar consultas por médico
db.patientFiles.ensureIndex({ fieldName: 'patientId' }) // Para buscar arquivos por paciente
db.patientFiles.ensureIndex({ fieldName: 'doctorId' })  // Para buscar arquivos por médico

// Função para criptografar senhas (usando salt automático com custo 10)
const hashPassword = (password) => bcrypt.hash(password, 10)

// Função para comparar senhas (verifica se a senha bate com o hash)
const comparePassword = (candidatePassword, hash) => bcrypt.compare(candidatePassword, hash)

// Exporta as configurações e funções para uso em outros módulos
module.exports = { 
  db, // Banco de dados configurado
  hashPassword, // Função de criptografia
  comparePassword // Função de verificação
}
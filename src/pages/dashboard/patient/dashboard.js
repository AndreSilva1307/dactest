document.addEventListener('DOMContentLoaded', async () => {
  // Elementos do DOM
  const userNameEl = document.getElementById('userName');
  const patientInfoEl = document.getElementById('patientInfo');
  const appointmentsListEl = document.getElementById('appointmentsList');
  const patientFilesListEl = document.getElementById('patientFilesList');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshAppointmentsBtn = document.getElementById('refreshAppointmentsBtn');
  const refreshFilesBtn = document.getElementById('refreshFilesBtn');

  let currentPatient = null;

  try {
    // Verificação de autenticação
    const userData = await window.electronAPI.getUserData();
    
    if (!userData || userData.userType !== 'patient') {
      window.electronAPI.navigateTo('auth/login');
      return;
    }
    currentPatient = userData;

    // Preencher informações do paciente
    userNameEl.textContent = currentPatient.name;
    
    patientInfoEl.innerHTML = `
      <div class="info-item">
        <span class="info-label">Email:</span>
        <span class="info-value">${currentPatient.email}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data de Nascimento:</span>
        <span class="info-value">${formatDate(currentPatient.birthDate)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Idade:</span>
        <span class="info-value">${calculateAge(currentPatient.birthDate)} anos</span>
      </div>
      <div class="info-item">
        <span class="info-label">Plano de Saúde:</span>
        <span class="info-value">${currentPatient.healthPlan || 'Particular'}</span>
      </div>
    `;

    // Carregar consultas
    const loadAppointments = async () => {
      appointmentsListEl.innerHTML = '<p class="loading">Carregando consultas...</p>';
      try {
        // currentPatient.patientId should be the _id from the patients collection
        // currentPatient._id from users collection, currentPatient.patientId from patients collection
        const patientSpecificId = currentPatient.patientId || currentPatient._id; // Fallback if patientId isn't set as expected
        const result = await window.electronAPI.getPatientAppointments(patientSpecificId);
        
        if (result.success && result.appointments) {
          if (result.appointments.length === 0) {
            appointmentsListEl.innerHTML = '<p class="no-data">Nenhuma consulta agendada.</p>';
            return;
          }
          appointmentsListEl.innerHTML = result.appointments.map(appt => `
            <div class="list-item appointment-card ${appt.status === 'urgent' ? 'urgent' : ''}"> 
              <div class="list-item-info">
                <h3>Consulta com Dr(a). ${appt.doctorName || 'Nome do Médico Indisponível'}</h3>
                <p><strong>Data e Hora:</strong> ${formatDateTime(appt.date)}</p>
                <p><strong>Motivo:</strong> ${appt.reason || 'Não especificado'}</p>
                <p><strong>Status:</strong> ${appt.status || 'Não especificado'}</p>
                ${appt.notes ? `<p class="notes"><strong>Observações:</strong> ${appt.notes}</p>` : ''}
              </div>
            </div>
          `).join('');
        } else {
          appointmentsListEl.innerHTML = `<p class="error">${result.message || 'Erro ao carregar consultas.'}</p>`;
        }
      } catch (error) {
        appointmentsListEl.innerHTML = '<p class="error">Erro crítico ao carregar consultas.</p>';
        console.error('Erro ao carregar consultas:', error);
      }
    };

    // Carregar arquivos do paciente
    const loadPatientFiles = async () => {
      patientFilesListEl.innerHTML = '<p class="loading">Carregando arquivos...</p>';
      try {
        const patientSpecificId = currentPatient.patientId || currentPatient._id;
        const result = await window.electronAPI.getPatientFiles(patientSpecificId);

        if (result.success && result.files) {
          if (result.files.length === 0) {
            patientFilesListEl.innerHTML = '<p class="no-data">Nenhum arquivo encontrado.</p>';
            return;
          }
          patientFilesListEl.innerHTML = result.files.map(file => `
            <div class="list-item file-card">
              <div class="list-item-info">
                <h3>${file.fileName}</h3>
                <p><strong>Enviado por:</strong> Dr(a). ${file.doctorName || 'Não especificado'}</p>
                <p><strong>Data do Upload:</strong> ${formatDate(file.uploadDate)}</p>
                ${file.description ? `<p><strong>Descrição:</strong> ${file.description}</p>` : ''}
              </div>
              <div class="list-item-actions file-actions">
                <button class="btn btn-success small-btn view-file-btn" data-filepath="${file.originalPath}">Ver Arquivo</button>
              </div>
            </div>
          `).join('');
          addEventListenersToFileButtons();
        } else {
          patientFilesListEl.innerHTML = `<p class="error">${result.message || 'Erro ao carregar arquivos.'}</p>`;
        }
      } catch (error) {
        patientFilesListEl.innerHTML = '<p class="error">Erro crítico ao carregar arquivos.</p>';
        console.error('Erro ao carregar arquivos do paciente:', error);
      }
    };
    
    function addEventListenersToFileButtons() {
        document.querySelectorAll('.view-file-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const filePath = e.target.dataset.filepath;
                if (filePath) {
                    window.electronAPI.openFileExternally(filePath);
                } else {
                    alert('Caminho do arquivo não encontrado.');
                }
            });
        });
    }


    // Event Listeners
    logoutBtn.addEventListener('click', () => {
      window.electronAPI.logout();
    });

    refreshAppointmentsBtn.addEventListener('click', loadAppointments);
    refreshFilesBtn.addEventListener('click', loadPatientFiles);

    // Listener for file open errors
    window.electronAPI.onFileOpenError((message) => {
        alert(`Erro ao abrir arquivo: ${message}`);
    });

    // Carregar dados iniciais
    await loadAppointments();
    await loadPatientFiles();

  } catch (error) {
    console.error('Erro no dashboard do paciente:', error);
    // alert('Erro ao carregar dados do paciente. Redirecionando para login.');
    window.electronAPI.navigateTo('auth/login');
  }
});

// Funções auxiliares
function formatDate(dateString) {
  if (!dateString) return '--/--/----';
  const date = new Date(dateString);
  // Adiciona verificação se a data é válida
  if (isNaN(date.getTime())) return 'Data inválida';
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
  if (!dateString) return '--/--/---- --:--';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Data/Hora inválida';
  return date.toLocaleString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function calculateAge(birthDateString) {
  if (!birthDateString) return '--';
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return '--'; // Invalid date

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : '--'; // Ensure age is not negative
}
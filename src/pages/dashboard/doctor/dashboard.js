document.addEventListener('DOMContentLoaded', async () => {
  // Elementos do DOM para informações do médico
  const doctorNameEl = document.getElementById('doctorName');
  const doctorSpecialtyEl = document.getElementById('doctorSpecialty');
  const doctorInfoEl = document.getElementById('doctorInfo');
  
  // Elementos do DOM para a lista de pacientes
  const allPatientsListEl = document.getElementById('allPatientsList');
  const refreshPatientsBtn = document.getElementById('refreshPatientsBtn');
  
  // Botão de logout
  const logoutBtn = document.getElementById('logoutBtn');

  let currentDoctorData = null; // Armazena dados completos do médico logado

  try {
    currentDoctorData = await window.electronAPI.getUserData();

    if (!currentDoctorData || currentDoctorData.userType !== 'doctor') {
      window.electronAPI.navigateTo('auth/login');
      return;
    }

    // Preencher informações do médico no topo
    doctorNameEl.textContent = currentDoctorData.name || 'N/A';
    doctorSpecialtyEl.textContent = currentDoctorData.specialty || 'Especialidade não definida';
    doctorInfoEl.innerHTML = `
      <div class="info-item">
        <span class="info-label">CRM:</span>
        <span class="info-value">${currentDoctorData.crm || 'Não registrado'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email:</span>
        <span class="info-value">${currentDoctorData.email}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Membro Desde:</span>
        <span class="info-value">${currentDoctorData.createdAt ? new Date(currentDoctorData.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
      </div>
    `;

    // Função para carregar todos os pacientes cadastrados
    const loadAllRegisteredPatients = async () => {
      allPatientsListEl.innerHTML = '<p class="loading-text">Carregando pacientes...</p>';
      try {
        const result = await window.electronAPI.getAllPatientsForDoctorView();

        if (!result.success || !result.patients || result.patients.length === 0) {
          allPatientsListEl.innerHTML = `<p class="no-data">${result.message || 'Nenhum paciente cadastrado no sistema.'}</p>`;
          return;
        }
        
        const patients = result.patients;
        allPatientsListEl.innerHTML = patients.map(patient => `
          <div class="patient-list-item">
            <span class="patient-name">${patient.name} (Email: ${patient.email || 'N/A'})</span>
            <div class="patient-actions">
              <button class="btn small-btn schedule-appointment-btn" data-patient-id="${patient._id}" data-patient-name="${patient.name}">Cadastrar Consulta</button>
              <button class="btn small-btn btn-secondary upload-files-btn" data-patient-id="${patient._id}" data-patient-name="${patient.name}">Upload Arquivos</button>
            </div>
          </div>
        `).join('');
        
        // Adicionar event listeners para os botões de cada paciente
        document.querySelectorAll('.schedule-appointment-btn').forEach(button => {
            button.addEventListener('click', handleScheduleAppointmentClick);
        });
        document.querySelectorAll('.upload-files-btn').forEach(button => {
            button.addEventListener('click', handleUploadFilesClick);
        });

      } catch (error) {
        allPatientsListEl.innerHTML = '<p class="error-text">Erro ao carregar a lista de pacientes.</p>';
        console.error('Erro ao carregar pacientes:', error);
      }
    };

    // Event Listeners
    logoutBtn.addEventListener('click', () => window.electronAPI.logout());
    refreshPatientsBtn.addEventListener('click', loadAllRegisteredPatients);

    // Carregar dados iniciais
    await loadAllRegisteredPatients();

  } catch (error) {
    console.error('Erro crítico no dashboard do médico:', error);
    // Tenta redirecionar para login em caso de erro grave na inicialização
    const mainContainer = document.querySelector('.dashboard-container');
    if (mainContainer) {
        mainContainer.innerHTML = `<p class="error-text">Erro ao carregar o dashboard. Redirecionando para login...</p>`;
    }
    setTimeout(() => window.electronAPI.navigateTo('auth/login'), 3000);
  }
});

// Funções auxiliares de formatação (se necessárias, podem ser movidas para um arquivo util.js)
function formatDate(dateString) {
  if (!dateString) return '--/--/----';
  const date = new Date(dateString);
  const utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return utcDate.toLocaleDateString('pt-BR');
}

function calculateAge(birthDate) {
  if (!birthDate) return '--';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age < 0 ? 0 : age; // Evita idade negativa se data de nascimento for futura
}

// Handler para o clique no botão "Cadastrar Consulta"
async function handleScheduleAppointmentClick(event) {
    const patientRecordId = event.target.dataset.patientId; // Este é o _id da coleção 'patients'
    const patientName = event.target.dataset.patientName;
    
    const doctorData = await window.electronAPI.getUserData();
    if (!doctorData || doctorData.userType !== 'doctor') {
        alert('Erro: Não foi possível identificar o médico logado.');
        return;
    }
    const doctorUserId = doctorData._id; // _id do médico da coleção 'users'

    const appointmentDateTimeStr = prompt(`Agendar consulta para ${patientName}.\nDigite a data e hora (AAAA-MM-DD HH:MM):`);
    if (!appointmentDateTimeStr) {
        alert('Agendamento cancelado.');
        return;
    }

    // Validação simples do formato da data/hora
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    if (!dateTimeRegex.test(appointmentDateTimeStr)) {
        alert('Formato de data/hora inválido. Use AAAA-MM-DD HH:MM.');
        return;
    }
    
    // Tentar converter para objeto Date para verificar validade
    const appointmentDateObj = new Date(appointmentDateTimeStr);
    if (isNaN(appointmentDateObj.getTime())) {
        alert('Data ou hora inválida. Verifique os valores inseridos.');
        return;
    }


    const reason = prompt(`Digite o motivo da consulta para ${patientName}:`, "Consulta de rotina");
    // Não cancelar se o motivo for deixado em branco, pode ser opcional ou ter um padrão.

    const isUrgent = confirm(`A consulta para ${patientName} é urgente?`);

    try {
        const result = await window.electronAPI.scheduleAppointment({
            doctorUserId: doctorUserId,
            patientRecordId: patientRecordId, 
            appointmentDate: appointmentDateTimeStr, // Enviar como string, o backend converterá para Date
            reason: reason,
            urgent: isUrgent
        });

        if (result.success) {
            alert(result.message || 'Consulta agendada com sucesso!');
            // Idealmente, atualizar apenas a parte da UI relevante ou adicionar o agendamento a uma lista de "próximos agendamentos do médico"
            // Por simplicidade, pode-se recarregar a lista de pacientes ou uma seção de agendamentos.
        } else {
            alert(`Erro ao agendar: ${result.message || 'Não foi possível agendar a consulta.'}`);
        }
    } catch (error) {
        console.error('Erro ao tentar agendar consulta:', error);
        alert('Falha ao conectar com o servidor para agendar a consulta.');
    }
}

// Handler para o clique no botão "Upload Arquivos" (Placeholder)
function handleUploadFilesClick(event) {
    const patientId = event.target.dataset.patientId;
    const patientName = event.target.dataset.patientName;
    alert(`FUNCIONALIDADE PLACEHOLDER:\n\nUpload de Arquivos para ${patientName} (ID: ${patientId}).\n\nEsta funcionalidade permitiria ao médico enviar laudos, receitas e outros documentos para o paciente.\nRequer implementação de backend para armazenamento seguro e frontend para seleção e envio de arquivos, respeitando a LGPD.`);
}

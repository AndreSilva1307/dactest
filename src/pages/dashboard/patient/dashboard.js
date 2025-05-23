document.addEventListener('DOMContentLoaded', async () => {
  // Elementos do DOM para informações do paciente
  const patientNameEl = document.getElementById('patientName');
  const patientInfoEl = document.getElementById('patientInfo');
  
  // Elementos do DOM para consultas
  const appointmentsListEl = document.getElementById('appointmentsList');
  const refreshAppointmentsBtn = document.getElementById('refreshAppointmentsBtn');

  // Elemento do DOM para laudos e receitas (placeholder)
  const medicalFilesListEl = document.getElementById('medicalFilesList');
  
  // Botão de logout
  const logoutBtn = document.getElementById('logoutBtn');

  let currentPatientData = null; // Armazena dados completos do paciente logado

  try {
    currentPatientData = await window.electronAPI.getUserData();
    
    if (!currentPatientData || currentPatientData.userType !== 'patient') {
      window.electronAPI.navigateTo('auth/login');
      return;
    }

    // Preencher informações do paciente no topo
    patientNameEl.textContent = currentPatientData.name || 'N/A';
    patientInfoEl.innerHTML = `
      <div class="info-item">
        <span class="info-label">Email:</span>
        <span class="info-value">${currentPatientData.email}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data de Nascimento:</span>
        <span class="info-value">${currentPatientData.birthDate ? formatDate(currentPatientData.birthDate) : 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Idade:</span>
        <span class="info-value">${currentPatientData.birthDate ? calculateAge(currentPatientData.birthDate) + ' anos' : 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Plano de Saúde:</span>
        <span class="info-value">${currentPatientData.healthPlan || 'Particular'}</span>
      </div>
    `;

    // Função para carregar consultas agendadas
    const loadAppointments = async () => {
      appointmentsListEl.innerHTML = '<p class="loading-text">Carregando suas consultas...</p>';
      try {
        // currentPatientData._id é o users._id do paciente
        const result = await window.electronAPI.getScheduledAppointments(currentPatientData._id); 
        
        if (!result.success || !result.appointments || result.appointments.length === 0) {
          appointmentsListEl.innerHTML = `<p class="no-data">${result.message || 'Você não possui nenhuma consulta agendada no momento.'}</p>`;
          return;
        }

        const appointments = result.appointments;
        // Ordenar por data mais recente primeiro, se o backend não fizer isso
        // appointments.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

        appointmentsListEl.innerHTML = appointments.map(appt => `
          <div class="appointment-card ${appt.urgent ? 'urgent' : ''}">
            <h3>Consulta com Dr(a). ${appt.doctorName || 'Não especificado'}</h3>
            <p><strong>Data e Hora:</strong> ${appt.appointmentDate ? formatDateTime(appt.appointmentDate) : 'N/A'}</p> 
            <p><strong>Motivo:</strong> ${appt.reason || 'Não especificado'}</p>
            <p><strong>Status:</strong> ${appt.status || 'Não informado'}</p>
            ${appt.notes ? `<p class="notes"><strong>Observações do Médico:</strong> ${appt.notes}</p>` : ''}
          </div>
        `).join('');
      } catch (error) {
        appointmentsListEl.innerHTML = '<p class="error-text">Erro ao carregar suas consultas.</p>';
        console.error('Erro ao carregar consultas:', error);
      }
    };

    // Lógica para a seção "Meus Laudos e Receitas" (Placeholder)
    // Atualmente, apenas exibe uma mensagem estática.
    // No futuro, chamaria uma API como window.electronAPI.getPatientFiles(currentPatientData._id)
    // e renderizaria os arquivos recebidos.
    // medicalFilesListEl.innerHTML = '<p class="no-data">Nenhum laudo ou receita disponível. (Funcionalidade em desenvolvimento)</p>';


    // Event Listeners
    logoutBtn.addEventListener('click', () => {
      window.electronAPI.logout();
    });

    refreshAppointmentsBtn.addEventListener('click', loadAppointments);

    // Carregar dados iniciais
    await loadAppointments();

  } catch (error) {
    console.error('Erro crítico no dashboard do paciente:', error);
    const mainContainer = document.querySelector('.dashboard-container');
    if (mainContainer) {
        mainContainer.innerHTML = `<p class="error-text">Erro ao carregar o dashboard. Redirecionando para login...</p>`;
    }
    setTimeout(() => window.electronAPI.navigateTo('auth/login'), 3000);
  }
});

// Funções auxiliares de formatação
function formatDate(dateString) {
  if (!dateString) return '--/--/----';
  const date = new Date(dateString);
  // Ajuste para UTC para exibir corretamente a data independente do fuso local de entrada
  const utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return utcDate.toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
  if (!dateString) return '--/--/---- --:--';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', { 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', hour12: false 
  });
}

function calculateAge(birthDateString) {
  if (!birthDateString) return '--';
  const birthDate = new Date(birthDateString);
  // Garante que a data de nascimento seja interpretada como UTC para evitar problemas de fuso
  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  let age = todayYear - birthYear;
  // Ajusta a idade se o aniversário deste ano ainda não ocorreu
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) {
    age--;
  }
  return age < 0 ? 0 : age; // Evita idade negativa
}

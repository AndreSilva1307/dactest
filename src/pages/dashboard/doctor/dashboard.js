document.addEventListener('DOMContentLoaded', async () => {
  const doctorNameEl = document.getElementById('doctorName');
  const doctorSpecialtyEl = document.getElementById('doctorSpecialty');
  const doctorInfoEl = document.getElementById('doctorInfo');
  const allPatientsListEl = document.getElementById('allPatientsList');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshAllPatientsBtn = document.getElementById('refreshAllPatientsBtn');

  // Modal elements for Appointment
  const appointmentModal = document.getElementById('appointmentModal');
  const closeAppointmentModalBtn = document.getElementById('closeAppointmentModalBtn');
  const saveAppointmentBtn = document.getElementById('saveAppointmentBtn');
  const cancelAppointmentBtn = document.getElementById('cancelAppointmentBtn');
  const modalPatientNameApptEl = document.getElementById('modalPatientNameAppt');
  const appointmentDateInput = document.getElementById('appointmentDate');
  const appointmentReasonInput = document.getElementById('appointmentReason');

  // Modal elements for File Upload
  const fileUploadModal = document.getElementById('fileUploadModal');
  const closeFileUploadModalBtn = document.getElementById('closeFileUploadModalBtn');
  const saveFileUploadBtn = document.getElementById('saveFileUploadBtn');
  const cancelFileUploadBtn = document.getElementById('cancelFileUploadBtn');
  const modalPatientNameFileEl = document.getElementById('modalPatientNameFile');
  const selectedFilePathInput = document.getElementById('selectedFilePath');
  const browseFileBtn = document.getElementById('browseFileBtn');
  const fileDescriptionInput = document.getElementById('fileDescription');

  let currentDoctor = null;
  let currentPatientForModal = null; // Store patient data for modal actions

  try {
    const userData = await window.electronAPI.getUserData();
    if (!userData || userData.userType !== 'doctor') {
      window.electronAPI.navigateTo('auth/login');
      return;
    }
    currentDoctor = userData; // Store doctor's data

    doctorNameEl.textContent = currentDoctor.name;
    doctorSpecialtyEl.textContent = currentDoctor.specialty || 'Especialidade não definida';

    doctorInfoEl.innerHTML = `
      <div class="info-item">
        <span class="info-label">CRM:</span>
        <span class="info-value">${currentDoctor.crm || 'Não registrado'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email:</span>
        <span class="info-value">${currentDoctor.email}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Membro Desde:</span>
        <span class="info-value">${new Date(currentDoctor.createdAt).toLocaleDateString('pt-BR')}</span>
      </div>
    `;

    const loadAllPatients = async () => {
      allPatientsListEl.innerHTML = '<p class="loading">Carregando pacientes...</p>';
      try {
        const result = await window.electronAPI.getAllPatients();
        if (result.success && result.patients) {
          if (result.patients.length === 0) {
            allPatientsListEl.innerHTML = '<p class="no-data">Nenhum paciente cadastrado no sistema.</p>';
            return;
          }
          allPatientsListEl.innerHTML = result.patients.map(patient => `
            <div class="list-item patient-item">
              <div class="patient-details list-item-info">
                <p><strong>Nome:</strong> ${patient.name}</p>
                <p><strong>Email:</strong> ${patient.email || 'Email não disponível'}</p>
              </div>
              <div class="patient-actions list-item-actions action-btn-group">
                <button class="btn btn-primary small-btn schedule-appointment-btn" data-patient-id="${patient._id}" data-patient-name="${patient.name}">Marcar Consulta</button>
                <button class="btn btn-info small-btn upload-file-btn" data-patient-id="${patient._id}" data-patient-name="${patient.name}">Upload Arquivo</button>
              </div>
            </div>
          `).join('');
          addEventListenersToPatientButtons();
        } else {
          allPatientsListEl.innerHTML = `<p class="error">${result.message || 'Erro ao carregar pacientes.'}</p>`;
        }
      } catch (error) {
        allPatientsListEl.innerHTML = '<p class="error">Erro crítico ao carregar pacientes.</p>';
        console.error('Erro ao carregar todos os pacientes:', error);
      }
    };

    logoutBtn.addEventListener('click', () => window.electronAPI.logout());
    refreshAllPatientsBtn.addEventListener('click', loadAllPatients);

    await loadAllPatients();

  } catch (error) {
    console.error('Erro no dashboard do médico:', error);
    // alert('Erro ao carregar dados do médico. Redirecionando para login.');
    window.electronAPI.navigateTo('auth/login');
  }

  function addEventListenersToPatientButtons() {
    document.querySelectorAll('.schedule-appointment-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const patientId = e.target.dataset.patientId;
        const patientName = e.target.dataset.patientName;
        currentPatientForModal = { _id: patientId, name: patientName };
        openAppointmentModal(patientName);
      });
    });

    document.querySelectorAll('.upload-file-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const patientId = e.target.dataset.patientId;
        const patientName = e.target.dataset.patientName;
        currentPatientForModal = { _id: patientId, name: patientName };
        openFileUploadModal(patientName);
      });
    });
  }

  // --- Appointment Modal Logic ---
  function openAppointmentModal(patientName) {
    modalPatientNameApptEl.textContent = patientName;
    appointmentDateInput.value = '';
    appointmentReasonInput.value = '';
    appointmentModal.style.display = 'block';
  }

  closeAppointmentModalBtn.onclick = () => appointmentModal.style.display = 'none';
  cancelAppointmentBtn.onclick = () => appointmentModal.style.display = 'none';

  saveAppointmentBtn.addEventListener('click', async () => {
    const appointmentDate = appointmentDateInput.value;
    const reason = appointmentReasonInput.value.trim();

    if (!appointmentDate || !reason) {
      alert('Por favor, preencha a data e o motivo da consulta.');
      return;
    }
    if (!currentPatientForModal || !currentDoctor) {
        alert('Erro: Dados do paciente ou médico não encontrados.');
        return;
    }

    try {
      const result = await window.electronAPI.scheduleAppointment({
        patientId: currentPatientForModal._id,
        doctorId: currentDoctor.doctorId, // Assuming doctorId is the _id from doctors collection
        doctorName: currentDoctor.name,
        patientName: currentPatientForModal.name,
        appointmentDate: appointmentDate,
        reason: reason
      });

      if (result.success) {
        alert('Consulta marcada com sucesso!');
        appointmentModal.style.display = 'none';
        // Optionally refresh parts of the UI if needed
      } else {
        alert(`Erro ao marcar consulta: ${result.message}`);
      }
    } catch (error) {
      console.error('Erro ao marcar consulta:', error);
      alert('Erro de comunicação ao marcar consulta.');
    }
  });

  // --- File Upload Modal Logic ---
  function openFileUploadModal(patientName) {
    modalPatientNameFileEl.textContent = patientName;
    selectedFilePathInput.value = '';
    fileDescriptionInput.value = '';
    fileUploadModal.style.display = 'block';
  }

  closeFileUploadModalBtn.onclick = () => fileUploadModal.style.display = 'none';
  cancelFileUploadBtn.onclick = () => fileUploadModal.style.display = 'none';

  browseFileBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.openFileDialog();
    if (result.success && !result.canceled) {
      selectedFilePathInput.value = result.filePath;
    }
  });

  saveFileUploadBtn.addEventListener('click', async () => {
    const filePath = selectedFilePathInput.value;
    const description = fileDescriptionInput.value.trim();

    if (!filePath) {
      alert('Por favor, selecione um arquivo.');
      return;
    }
     if (!currentPatientForModal || !currentDoctor) {
        alert('Erro: Dados do paciente ou médico não encontrados.');
        return;
    }


    const fileName = filePath.split(/[\\/]/).pop(); // Extract filename from path

    try {
      const result = await window.electronAPI.uploadPatientFile({
        patientId: currentPatientForModal._id,
        doctorId: currentDoctor.doctorId,
        doctorName: currentDoctor.name,
        patientName: currentPatientForModal.name,
        filePath: filePath,
        fileName: fileName,
        description: description
      });

      if (result.success) {
        alert('Arquivo enviado com sucesso!');
        fileUploadModal.style.display = 'none';
        // Optionally refresh UI
      } else {
        alert(`Erro ao enviar arquivo: ${result.message}`);
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      alert('Erro de comunicação ao enviar arquivo.');
    }
  });

  // Close modals if clicked outside content
  window.onclick = function(event) {
    if (event.target == appointmentModal) {
      appointmentModal.style.display = "none";
    }
    if (event.target == fileUploadModal) {
      fileUploadModal.style.display = "none";
    }
  }
});
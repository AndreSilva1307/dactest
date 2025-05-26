document.addEventListener('DOMContentLoaded', async () => {
  const doctorNameEl = document.getElementById('doctorName');
  const doctorSpecialtyEl = document.getElementById('doctorSpecialty');
  const doctorInfoEl = document.getElementById('doctorInfo');
  const allPatientsListEl = document.getElementById('allPatientsList');
  const logoutBtn = document.getElementById('logoutBtn');
  const refreshAllPatientsBtn = document.getElementById('refreshAllPatientsBtn');

  // Modal elements for Appointment (Marcar/Alterar)
  const appointmentModal = document.getElementById('appointmentModal');
  const closeAppointmentModalBtn = document.getElementById('closeAppointmentModalBtn');
  const saveAppointmentBtn = document.getElementById('saveAppointmentBtn');
  const cancelAppointmentBtn = document.getElementById('cancelAppointmentBtn');
  const modalPatientNameApptEl = document.getElementById('modalPatientNameAppt');
  const appointmentDateInput = document.getElementById('appointmentDate');
  const appointmentReasonInput = document.getElementById('appointmentReason');
  const editingAppointmentIdInput = document.getElementById('editingAppointmentId');
  const appointmentModalTitleEl = document.getElementById('appointmentModalTitle');

  // Modal elements for File Upload
  const fileUploadModal = document.getElementById('fileUploadModal');
  const closeFileUploadModalBtn = document.getElementById('closeFileUploadModalBtn');
  const saveFileUploadBtn = document.getElementById('saveFileUploadBtn');
  const cancelFileUploadBtn = document.getElementById('cancelFileUploadBtn');
  const modalPatientNameFileEl = document.getElementById('modalPatientNameFile');
  const selectedFilePathInput = document.getElementById('selectedFilePath');
  const browseFileBtn = document.getElementById('browseFileBtn');
  const fileDescriptionInput = document.getElementById('fileDescription');

  // New Modal for Selecting Appointment to Edit/Delete
  const selectAppointmentModal = document.getElementById('selectAppointmentModal');
  const closeSelectAppointmentModalBtn = document.getElementById('closeSelectAppointmentModalBtn');
  const appointmentsForSelectionEl = document.getElementById('appointmentsForSelection');
  const modalPatientNameSelectApptEl = document.getElementById('modalPatientNameSelectAppt');
  const confirmSelectAppointmentBtn = document.getElementById('confirmSelectAppointmentBtn');
  const cancelSelectAppointmentBtn = document.getElementById('cancelSelectAppointmentBtn');
  const selectAppointmentTitleEl = document.getElementById('selectAppointmentTitle');

  // New Modal for Selecting File to Delete
  const selectFileModal = document.getElementById('selectFileModal');
  const closeSelectFileModalBtn = document.getElementById('closeSelectFileModalBtn');
  const filesForSelectionEl = document.getElementById('filesForSelection');
  const modalPatientNameSelectFileEl = document.getElementById('modalPatientNameSelectFile');
  const confirmDeleteFileBtn = document.getElementById('confirmDeleteFileBtn');
  const cancelSelectFileBtn = document.getElementById('cancelSelectFileBtn');


  let currentDoctor = null;
  let currentPatientForModal = null;
  let currentActionContext = null; // To store { patientId, patientName, actionType, selectedItemId }

  try {
    const userData = await window.electronAPI.getUserData(); //
    if (!userData || userData.userType !== 'doctor') { //
      window.electronAPI.navigateTo('auth/login'); //
      return;
    }
    currentDoctor = userData; //

    doctorNameEl.textContent = currentDoctor.name; //
    doctorSpecialtyEl.textContent = currentDoctor.specialty || 'Especialidade não definida'; //

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
    `; //

    const loadAllPatients = async () => {
      allPatientsListEl.innerHTML = '<p class="loading">Carregando pacientes...</p>'; //
      try {
        const result = await window.electronAPI.getAllPatients(); //
        if (result.success && result.patients) { //
          if (result.patients.length === 0) { //
            allPatientsListEl.innerHTML = '<p class="no-data">Nenhum paciente cadastrado no sistema.</p>'; //
            return;
          }
          allPatientsListEl.innerHTML = result.patients.map(patient => `
            <div class="list-item patient-item" data-patient-id="${patient._id}" data-patient-name="${patient.name}">
              <div class="patient-details list-item-info">
                <p><strong>Nome:</strong> ${patient.name}</p>
                <p><strong>Email:</strong> ${patient.email || 'Email não disponível'}</p>
              </div>
              <div class="patient-actions-column list-item-actions">
                <div class="action-group">
                  <select class="form-control input-sm appointment-action-select">
                    <option value="schedule">Marcar Consulta</option>
                    <option value="edit">Alterar Consulta</option>
                    <option value="cancel">Remover Consulta</option>
                  </select>
                  <button class="btn btn-primary btn-sm execute-appointment-action-btn">Avançar</button>
                </div>
                <div class="action-group">
                  <select class="form-control input-sm file-action-select">
                    <option value="upload">Upload Arquivo</option>
                    <option value="delete_single">Remover Arquivo</option>
                    <option value="delete_all">Remover Todos os Arquivos</option>
                  </select>
                  <button class="btn btn-info btn-sm execute-file-action-btn">Avançar</button>
                </div>
              </div>
            </div>
          `).join(''); //
          addEventListenersToPatientActions();
        } else {
          allPatientsListEl.innerHTML = `<p class="error">${result.message || 'Erro ao carregar pacientes.'}</p>`; //
        }
      } catch (error) {
        allPatientsListEl.innerHTML = '<p class="error">Erro crítico ao carregar pacientes.</p>'; //
        console.error('Erro ao carregar todos os pacientes:', error); //
      }
    };

    logoutBtn.addEventListener('click', () => window.electronAPI.logout()); //
    refreshAllPatientsBtn.addEventListener('click', loadAllPatients); //

    await loadAllPatients(); //

  } catch (error) {
    console.error('Erro no dashboard do médico:', error); //
    window.electronAPI.navigateTo('auth/login'); //
  }

  function addEventListenersToPatientActions() {
    document.querySelectorAll('.execute-appointment-action-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const patientItem = e.target.closest('.patient-item');
        const patientId = patientItem.dataset.patientId;
        const patientName = patientItem.dataset.patientName;
        const select = patientItem.querySelector('.appointment-action-select');
        const action = select.value;
        handleAppointmentAction(action, patientId, patientName);
      });
    });

    document.querySelectorAll('.execute-file-action-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const patientItem = e.target.closest('.patient-item');
        const patientId = patientItem.dataset.patientId;
        const patientName = patientItem.dataset.patientName;
        const select = patientItem.querySelector('.file-action-select');
        const action = select.value;
        handleFileAction(action, patientId, patientName);
      });
    });
  }

  async function handleAppointmentAction(action, patientId, patientName) {
    currentPatientForModal = { _id: patientId, name: patientName };
    modalPatientNameApptEl.textContent = patientName; //
    editingAppointmentIdInput.value = ''; // Clear any previous editing ID
    appointmentModalTitleEl.textContent = "Marcar Consulta";

    switch (action) {
      case 'schedule':
        appointmentDateInput.value = ''; //
        appointmentReasonInput.value = ''; //
        appointmentModal.style.display = 'block'; //
        break;
      case 'edit':
        selectAppointmentTitleEl.textContent = "Selecionar Consulta para Alterar";
        modalPatientNameSelectApptEl.textContent = patientName;
        currentActionContext = { patientId, patientName, actionType: 'editAppointment' };
        await populateAppointmentsForSelection(patientId, 'edit');
        selectAppointmentModal.style.display = 'block';
        break;
      case 'cancel':
        selectAppointmentTitleEl.textContent = "Selecionar Consulta para Remover";
        modalPatientNameSelectApptEl.textContent = patientName;
        currentActionContext = { patientId, patientName, actionType: 'cancelAppointment' };
        await populateAppointmentsForSelection(patientId, 'cancel');
        selectAppointmentModal.style.display = 'block';
        break;
    }
  }

  async function populateAppointmentsForSelection(patientId, mode) { // mode can be 'edit' or 'cancel'
      appointmentsForSelectionEl.innerHTML = '<p class="loading">Carregando consultas...</p>';
      try {
          const result = await window.electronAPI.getPatientAppointments(patientId); //
          if (result.success && result.appointments && result.appointments.length > 0) { //
              appointmentsForSelectionEl.innerHTML = result.appointments.map(appt => `
                  <div class="list-item">
                      <label>
                          <input type="radio" name="selectedAppointment" value="${appt._id}" data-date="${appt.date}" data-reason="${appt.reason}">
                          Consulta em ${new Date(appt.date).toLocaleString('pt-BR')} - ${appt.reason.substring(0,30)}...
                      </label>
                  </div>
              `).join('');
          } else {
              appointmentsForSelectionEl.innerHTML = '<p class="no-data">Nenhuma consulta encontrada para este paciente.</p>';
          }
      } catch (error) {
          console.error("Erro ao buscar consultas para seleção:", error);
          appointmentsForSelectionEl.innerHTML = '<p class="error">Erro ao buscar consultas.</p>';
      }
  }
  
  confirmSelectAppointmentBtn.addEventListener('click', async () => {
    const selectedRadio = appointmentsForSelectionEl.querySelector('input[name="selectedAppointment"]:checked');
    if (!selectedRadio) {
        alert("Por favor, selecione uma consulta.");
        return;
    }
    const appointmentId = selectedRadio.value;
    const appointmentDate = selectedRadio.dataset.date;
    const appointmentReason = selectedRadio.dataset.reason;

    selectAppointmentModal.style.display = 'none';

    if (currentActionContext.actionType === 'editAppointment') {
        appointmentModalTitleEl.textContent = "Alterar Consulta";
        editingAppointmentIdInput.value = appointmentId;
        appointmentDateInput.value = new Date(new Date(appointmentDate).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        appointmentReasonInput.value = appointmentReason;
        modalPatientNameApptEl.textContent = currentActionContext.patientName;
        appointmentModal.style.display = 'block';
    } else if (currentActionContext.actionType === 'cancelAppointment') {
        if (confirm(`Tem certeza que deseja remover a consulta selecionada para ${currentActionContext.patientName}?`)) {
            try {
                const result = await window.electronAPI.deleteAppointment(appointmentId);
                if (result.success) {
                    alert('Consulta removida com sucesso!');
                    // Optionally, refresh the patient list or relevant part of UI
                } else {
                    alert(`Erro ao remover consulta: ${result.message || 'Erro desconhecido.'}`);
                }
            } catch (error) {
                console.error("Erro ao remover consulta:", error);
                alert('Erro de comunicação ao remover consulta.');
            }
        }
    }
  });


  async function handleFileAction(action, patientId, patientName) {
    currentPatientForModal = { _id: patientId, name: patientName }; //
    modalPatientNameFileEl.textContent = patientName; //

    switch (action) {
      case 'upload':
        selectedFilePathInput.value = ''; //
        fileDescriptionInput.value = ''; //
        fileUploadModal.style.display = 'block'; //
        break;
      case 'delete_single':
        modalPatientNameSelectFileEl.textContent = patientName;
        currentActionContext = { patientId, patientName, actionType: 'deleteSingleFile' };
        await populateFilesForSelection(patientId);
        selectFileModal.style.display = 'block';
        break;
      case 'delete_all':
        if (confirm(`Tem certeza que deseja remover TODOS os arquivos para o paciente ${patientName}? Esta ação não pode ser desfeita.`)) {
          try {
            const result = await window.electronAPI.deleteAllPatientFiles(patientId);
            if (result.success) {
              alert(`Todos os arquivos de ${patientName} foram removidos.`);
            } else {
              alert(`Erro ao remover todos os arquivos: ${result.message || 'Erro desconhecido'}`);
            }
          } catch (error) {
            console.error('Erro ao remover todos os arquivos:', error);
            alert('Erro de comunicação ao remover todos os arquivos.');
          }
        }
        break;
    }
  }

  async function populateFilesForSelection(patientId) {
      filesForSelectionEl.innerHTML = '<p class="loading">Carregando arquivos...</p>';
      try {
          const result = await window.electronAPI.getPatientFiles(patientId); //
          if (result.success && result.files && result.files.length > 0) { //
              filesForSelectionEl.innerHTML = result.files.map(file => `
                  <div class="list-item">
                      <label>
                          <input type="radio" name="selectedFile" value="${file._id}">
                          ${file.fileName} (${new Date(file.uploadDate).toLocaleDateString('pt-BR')})
                          ${file.description ? ` - <em>${file.description.substring(0,30)}...</em>` : ''}
                      </label>
                  </div>
              `).join('');
          } else {
              filesForSelectionEl.innerHTML = '<p class="no-data">Nenhum arquivo encontrado para este paciente.</p>';
          }
      } catch (error) {
          console.error("Erro ao buscar arquivos para seleção:", error);
          filesForSelectionEl.innerHTML = '<p class="error">Erro ao buscar arquivos.</p>';
      }
  }

  confirmDeleteFileBtn.addEventListener('click', async () => {
    const selectedRadio = filesForSelectionEl.querySelector('input[name="selectedFile"]:checked');
    if (!selectedRadio) {
        alert("Por favor, selecione um arquivo para remover.");
        return;
    }
    const fileId = selectedRadio.value;

    if (confirm(`Tem certeza que deseja remover o arquivo selecionado de ${currentActionContext.patientName}?`)) {
        try {
            const result = await window.electronAPI.deletePatientFile(fileId);
            if (result.success) {
                alert('Arquivo removido com sucesso!');
                selectFileModal.style.display = 'none';
                // Optionally, refresh files list or UI
            } else {
                alert(`Erro ao remover arquivo: ${result.message || 'Erro desconhecido.'}`);
            }
        } catch (error) {
            console.error("Erro ao remover arquivo:", error);
            alert('Erro de comunicação ao remover arquivo.');
        }
    }
  });


  // --- Appointment Modal Logic (Save Button) ---
  saveAppointmentBtn.addEventListener('click', async () => { //
    const appointmentDate = appointmentDateInput.value; //
    const reason = appointmentReasonInput.value.trim(); //
    const appointmentIdToEdit = editingAppointmentIdInput.value;

    if (!appointmentDate || !reason) { //
      alert('Por favor, preencha a data e o motivo da consulta.'); //
      return;
    }
    if (!currentPatientForModal || !currentDoctor) { //
        alert('Erro: Dados do paciente ou médico não encontrados.'); //
        return;
    }

    try {
      let result;
      if (appointmentIdToEdit) { // Editing existing appointment
        result = await window.electronAPI.updateAppointment({
          appointmentId: appointmentIdToEdit,
          updates: {
            date: new Date(appointmentDate),
            reason: reason,
            // You might want to add doctorId, patientId if they could change, or ensure they are part of updates
            // Also, doctorName, patientName if they are denormalized and could change
          }
        });
        if (result.success) alert('Consulta alterada com sucesso!');

      } else { // Scheduling new appointment
        result = await window.electronAPI.scheduleAppointment({ //
          patientId: currentPatientForModal._id, //
          doctorId: currentDoctor.doctorId, //
          doctorName: currentDoctor.name, //
          patientName: currentPatientForModal.name, //
          appointmentDate: appointmentDate, //
          reason: reason //
        });
        if (result.success) alert('Consulta marcada com sucesso!'); //
      }
      
      if (result.success) {
        appointmentModal.style.display = 'none'; //
        editingAppointmentIdInput.value = ''; // Clear editing ID
        // Optionally refresh parts of the UI if needed
      } else {
        alert(`Erro ao salvar consulta: ${result.message}`); //
      }
    } catch (error) {
      console.error('Erro ao salvar consulta:', error); //
      alert('Erro de comunicação ao salvar consulta.'); //
    }
  });

  // --- File Upload Modal Logic (Save Button) ---
  saveFileUploadBtn.addEventListener('click', async () => { //
    const filePath = selectedFilePathInput.value; //
    const description = fileDescriptionInput.value.trim(); //

    if (!filePath) { //
      alert('Por favor, selecione um arquivo.'); //
      return;
    }
     if (!currentPatientForModal || !currentDoctor) { //
        alert('Erro: Dados do paciente ou médico não encontrados.'); //
        return;
    }
    const fileName = filePath.split(/[\\/]/).pop(); //

    try {
      const result = await window.electronAPI.uploadPatientFile({ //
        patientId: currentPatientForModal._id, //
        doctorId: currentDoctor.doctorId, //
        doctorName: currentDoctor.name, //
        patientName: currentPatientForModal.name, //
        filePath: filePath, //
        fileName: fileName, //
        description: description //
      });

      if (result.success) { //
        alert('Arquivo enviado com sucesso!'); //
        fileUploadModal.style.display = 'none'; //
      } else {
        alert(`Erro ao enviar arquivo: ${result.message}`); //
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error); //
      alert('Erro de comunicação ao enviar arquivo.'); //
    }
  });


  // --- Modal Close Buttons & Outside Click ---
  closeAppointmentModalBtn.onclick = () => { appointmentModal.style.display = 'none'; editingAppointmentIdInput.value = ''; } //
  cancelAppointmentBtn.onclick = () => { appointmentModal.style.display = 'none'; editingAppointmentIdInput.value = ''; } //
  closeFileUploadModalBtn.onclick = () => fileUploadModal.style.display = 'none'; //
  cancelFileUploadBtn.onclick = () => fileUploadModal.style.display = 'none'; //
  
  closeSelectAppointmentModalBtn.onclick = () => selectAppointmentModal.style.display = 'none';
  cancelSelectAppointmentBtn.onclick = () => selectAppointmentModal.style.display = 'none';
  closeSelectFileModalBtn.onclick = () => selectFileModal.style.display = 'none';
  cancelSelectFileBtn.onclick = () => selectFileModal.style.display = 'none';

  browseFileBtn.addEventListener('click', async () => { //
    const result = await window.electronAPI.openFileDialog(); //
    if (result.success && !result.canceled) { //
      selectedFilePathInput.value = result.filePath; //
    }
  });

  window.onclick = function(event) { //
    if (event.target == appointmentModal) { //
      appointmentModal.style.display = "none"; //
      editingAppointmentIdInput.value = '';
    }
    if (event.target == fileUploadModal) { //
      fileUploadModal.style.display = "none"; //
    }
    if (event.target == selectAppointmentModal) {
      selectAppointmentModal.style.display = "none";
    }
    if (event.target == selectFileModal) {
      selectFileModal.style.display = "none";
    }
  }
});
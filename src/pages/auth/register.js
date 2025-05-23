document.addEventListener('DOMContentLoaded', () => {
  console.log('Página de registro carregada.');

  // Elementos do DOM
  const userTypeSelect = document.getElementById('userType');
  const registerForm = document.getElementById('registerForm');
  const loginLink = document.getElementById('loginLink');
  
  // Criação dinâmica da mensagem de erro
  const errorMessageEl = document.createElement('div');
  errorMessageEl.className = 'error-message'; // Classe para estilização CSS
  errorMessageEl.style.display = 'none'; // Começa escondido
  if (registerForm.firstChild) {
    registerForm.insertBefore(errorMessageEl, registerForm.firstChild);
  } else {
    registerForm.appendChild(errorMessageEl);
  }

  // Elementos para campos específicos
  const patientFieldsEl = document.getElementById('patientFields');
  const doctorFieldsEl = document.getElementById('doctorFields');

  if (!userTypeSelect || !registerForm || !loginLink || !patientFieldsEl || !doctorFieldsEl) {
    console.error('Erro: Um ou mais elementos essenciais do DOM não foram encontrados na página de registro.');
    showError('Erro interno na página. Por favor, recarregue.');
    return;
  }

  // Alterna campos específicos com base no tipo de usuário
  userTypeSelect.addEventListener('change', (e) => {
    console.log('Tipo de usuário alterado para:', e.target.value);
    patientFieldsEl.style.display = 'none';
    doctorFieldsEl.style.display = 'none';

    if (e.target.value === 'patient') {
      patientFieldsEl.style.display = 'block';
    } else if (e.target.value === 'doctor') {
      doctorFieldsEl.style.display = 'block';
    }
  });

  // Função para exibir mensagens de erro
  function showError(message) {
    errorMessageEl.textContent = message;
    errorMessageEl.style.display = 'block';
    console.error('Erro no formulário:', message);
    // setTimeout(() => { // Ocultar automaticamente pode não ser ideal para todos os erros
    //   errorMessageEl.style.display = 'none';
    // }, 7000);
  }
  function clearError() {
    errorMessageEl.textContent = '';
    errorMessageEl.style.display = 'none';
  }

  // Validação do formulário
  const validateForm = () => {
    clearError(); // Limpa erros anteriores
    const userType = userTypeSelect.value;
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!userType) {
      showError('Por favor, selecione o tipo de usuário.');
      return false;
    }
    if (!name) {
      showError('Por favor, informe o nome completo.');
      return false;
    }
    if (!email) {
      showError('Por favor, informe o email.');
      return false;
    }
    // Validação simples de email
    if (!email.includes('@') || !email.includes('.')) {
        showError('Formato de email inválido.');
        return false;
    }
    if (!password) {
      showError('Por favor, informe a senha.');
      return false;
    }
    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    if (password !== confirmPassword) {
      showError('As senhas não coincidem.');
      return false;
    }

    if (userType === 'doctor') {
      const crm = document.getElementById('crm').value.trim();
      if (!crm) {
        showError('CRM é obrigatório para médicos.');
        return false;
      }
    }
    // Adicionar validação para data de nascimento se for paciente e for obrigatório
    if (userType === 'patient') {
        const birthDate = document.getElementById('birthDate').value;
        if (!birthDate) { // Exemplo: tornando data de nascimento obrigatória
            showError('Data de nascimento é obrigatória para pacientes.');
            return false;
        }
    }


    console.log('Formulário validado com sucesso.');
    return true;
  };

  // Manipulador de submit do formulário
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Previne o comportamento padrão de submissão do formulário
    console.log('Tentativa de submissão do formulário de registro.');

    if (!validateForm()) {
      console.log('Validação do formulário falhou.');
      return; // Interrompe se a validação falhar
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';
    clearError();

    try {
      const userType = userTypeSelect.value;
      const userData = {
        userType,
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value // A senha não deve ter .trim()
      };

      // Adiciona campos específicos baseados no tipo de usuário
      if (userType === 'patient') {
        userData.birthDate = document.getElementById('birthDate').value; // O backend espera uma string de data
        userData.healthPlan = document.getElementById('healthPlan').value.trim();
      } else if (userType === 'doctor') {
        userData.crm = document.getElementById('crm').value.trim();
        userData.specialty = document.getElementById('specialty').value.trim();
      }

      console.log('Dados a serem enviados para registro:', userData);

      // Verifica se a API do Electron está disponível
      if (!window.electronAPI || typeof window.electronAPI.register !== 'function') {
          console.error('electronAPI.register não está disponível. Verifique o preload.js.');
          showError('Erro de comunicação com o sistema. Tente novamente mais tarde.');
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
          return;
      }

      const result = await window.electronAPI.register(userData);
      console.log('Resultado do registro:', result);
      
      if (result.success) {
        alert('Registro realizado com sucesso! Você será redirecionado para a página de login.'); // Feedback para o usuário
        registerForm.reset(); // Limpa o formulário
        // Reseta a visibilidade dos campos específicos
        patientFieldsEl.style.display = 'none';
        doctorFieldsEl.style.display = 'none';
        userTypeSelect.value = ""; // Reseta o select
        
        window.electronAPI.navigateTo('auth/login?fresh=true'); // Navega para login com parâmetro para limpar o form de login
      } else {
        showError(result.message || 'Erro desconhecido no registro. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro catastrófico durante o registro:', error);
      showError('Erro ao conectar com o servidor de registro. Verifique sua conexão ou tente mais tarde.');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  });

  // Navegação para a página de login
  loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Navegando para a página de login.');
    if (window.electronAPI && typeof window.electronAPI.navigateTo === 'function') {
        window.electronAPI.navigateTo('auth/login');
    } else {
        console.error('electronAPI.navigateTo não está disponível.');
        alert('Não foi possível navegar para a página de login.');
    }
  });
});

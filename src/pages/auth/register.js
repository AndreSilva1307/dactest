document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const userTypeSelect = document.getElementById('userType');
  const registerForm = document.getElementById('registerForm');
  const loginLink = document.getElementById('loginLink');
  const errorMessage = document.createElement('div');
  errorMessage.className = 'error-message'; // Make sure .error-message is styled in CSS
  // Style error message dynamically or via CSS
  errorMessage.style.color = 'var(--danger-color)';
  errorMessage.style.backgroundColor = '#fdd';
  errorMessage.style.border = '1px solid var(--danger-color)';
  errorMessage.style.padding = '10px';
  errorMessage.style.marginBottom = '15px';
  errorMessage.style.borderRadius = 'var(--border-radius)';
  registerForm.insertBefore(errorMessage, registerForm.firstChild);

  // Estado inicial
  errorMessage.style.display = 'none';

  // Alterna campos específicos
  userTypeSelect.addEventListener('change', (e) => {
    document.querySelectorAll('.user-type-fields').forEach(el => {
      el.style.display = 'none';
    });

    if (e.target.value === 'patient') {
      document.getElementById('patientFields').style.display = 'block';
    } else if (e.target.value === 'doctor') {
      document.getElementById('doctorFields').style.display = 'block';
    }
  });

  // Validação do formulário
  const validateForm = () => {
    const userType = document.getElementById('userType').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!userType || !name || !email || !password || !confirmPassword) {
      showError('Todos os campos básicos são obrigatórios');
      return false;
    }

    if (password !== confirmPassword) {
      showError('As senhas não coincidem');
      return false;
    }

    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres');
      return false;
    }

    if (userType === 'doctor' && !document.getElementById('crm').value) {
      showError('CRM é obrigatório para médicos');
      return false;
    }
     if (userType === 'patient' && !document.getElementById('birthDate').value) {
      showError('Data de nascimento é obrigatória para pacientes.');
      return false;
    }


    return true;
  };

  // Exibe mensagens de erro
  const showError = (message) => {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  };

  // Manipulador de submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';

    try {
      const userType = document.getElementById('userType').value;
      const userData = {
        userType,
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      };

      // Campos específicos
      if (userType === 'patient') {
        userData.birthDate = document.getElementById('birthDate').value;
        userData.healthPlan = document.getElementById('healthPlan').value;
      } else { // doctor
        userData.crm = document.getElementById('crm').value;
        userData.specialty = document.getElementById('specialty').value;
      }

      const result = await window.electronAPI.register(userData);
      
      if (result.success) {
        // Reset completo antes de navegar
        registerForm.reset();
        document.querySelectorAll('.user-type-fields').forEach(el => {
          el.style.display = 'none';
        });
        
        // Navega com parâmetro fresh
        alert('Registro bem-sucedido! Você será redirecionado para a página de login.');
        window.electronAPI.navigateTo('auth/login?fresh=true');
      } else {
        showError(result.message || 'Erro no registro');
      }
    } catch (error) {
      console.error('Erro no registro:', error);
      showError('Erro ao conectar com o servidor');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });

  // Navegação para login
  loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.navigateTo('auth/login');
  });
});
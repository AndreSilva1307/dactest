document.addEventListener('DOMContentLoaded', () => {
  // Verifica se é um carregamento fresco
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('fresh')) {
    // Limpa o formulário
    document.getElementById('loginForm').reset();
    
    // Remove o parâmetro da URL sem recarregar
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Elementos do DOM
  const loginForm = document.getElementById('loginForm');
  const registerLink = document.getElementById('registerLink');
  const errorMessage = document.createElement('div');
  errorMessage.className = 'error-message';
  loginForm.insertBefore(errorMessage, loginForm.firstChild);

  // Configuração inicial
  errorMessage.style.display = 'none';

  // Validação do formulário
  const validateForm = () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const userType = document.getElementById('userType').value;

    if (!email || !password || !userType) {
      showError('Todos os campos são obrigatórios');
      return false;
    }

    if (!email.includes('@') || !email.includes('.')) {
      showError('Email inválido');
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
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Autenticando...';

    try {
      const credentials = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        userType: document.getElementById('userType').value
      };

      const result = await window.electronAPI.login(credentials);
      
      if (result.success) {
        window.electronAPI.navigateTo(`dashboard/${credentials.userType}/dashboard`);
      } else {
        showError(result.message || 'Credenciais inválidas');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      showError('Erro na conexão com o servidor');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });

  // Navegação para registro
  registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.navigateTo('auth/register');
  });
});
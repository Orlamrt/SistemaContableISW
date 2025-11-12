const API_BASE = 'http://localhost:4000/api';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) {
                    alert(data.message || 'Error al iniciar sesión');
                    return;
                }
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor');
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            try {
                const res = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) {
                    alert(data.message || 'Error al registrarse');
                    return;
                }
                alert('Registro exitoso. Revisa tu correo y ahora inicia sesión.');
                window.location.href = 'index.html';
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor');
            }
        });
    }

    const recoverForm = document.getElementById('recover-form');
    if (recoverForm) {
        recoverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recover-email').value;
            try {
                const res = await fetch(`${API_BASE}/auth/recover`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();
                alert(data.message || 'Solicitud procesada.');
                window.location.href = 'index.html';
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor');
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-form');
    if (!resetForm) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
        alert('Token de recuperación no válido.');
        window.location.href = 'index.html';
        return;
    }
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('reset-password').value;
        if (!password || password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.message || 'No se pudo restablecer la contraseña.');
                return;
            }
            alert(data.message || 'Contraseña actualizada correctamente.');
            window.location.href = 'index.html';
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor');
        }
    });
});

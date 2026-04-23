/* ============================================================
   AUTH PAGE — auth.js
   ============================================================ */

function switchTab(tab) {
    document.getElementById('tabLogin').classList.toggle('active',  tab === 'login');
    document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
    document.getElementById('formLogin').classList.toggle('active',  tab === 'login');
    document.getElementById('formSignup').classList.toggle('active', tab === 'signup');
    clearErrors();
}

function clearErrors() {
    document.getElementById('loginError').style.display  = 'none';
    document.getElementById('signupError').style.display = 'none';
}

function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
}

function setLoading(btnId, loading) {
    const btn    = document.getElementById(btnId);
    const label  = btn.querySelector('.btn-auth-label');
    const spinner = btn.querySelector('.btn-spinner');
    btn.disabled          = loading;
    label.style.display   = loading ? 'none' : 'inline';
    spinner.style.display = loading ? 'block' : 'none';
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    input.type  = input.type === 'password' ? 'text' : 'password';
}

// Check if welcome page set a preferred tab
document.addEventListener('DOMContentLoaded', function () {
    const preferredMode = sessionStorage.getItem('authMode');
    if (preferredMode === 'signup') {
        switchTab('signup');
        document.getElementById('signupUsername').focus();
    } else {
        document.getElementById('loginEmail').focus();
    }
    sessionStorage.removeItem('authMode');
});

// Password strength
document.addEventListener('DOMContentLoaded', function () {
    const pwInput = document.getElementById('signupPassword');
    if (pwInput) {
        pwInput.addEventListener('input', function () {
            const val = pwInput.value;
            const strengthBox  = document.getElementById('passwordStrength');
            const strengthFill = document.getElementById('strengthFill');
            const strengthLbl  = document.getElementById('strengthLabel');

            if (!val) { strengthBox.style.display = 'none'; return; }
            strengthBox.style.display = 'flex';

            let score = 0;
            if (val.length >= 6)  score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val))           score++;
            if (/[0-9]/.test(val))           score++;
            if (/[^a-zA-Z0-9]/.test(val))    score++;

            const levels = [
                { width: '20%',  color: '#f87171', label: 'Weak'      },
                { width: '40%',  color: '#fb923c', label: 'Fair'      },
                { width: '60%',  color: '#facc15', label: 'Good'      },
                { width: '80%',  color: '#34d399', label: 'Strong'    },
                { width: '100%', color: '#22c55e', label: 'Excellent' }
            ];
            const lvl = levels[Math.min(score, 4)];
            strengthFill.style.width      = lvl.width;
            strengthFill.style.background = lvl.color;
            strengthLbl.textContent       = lvl.label;
            strengthLbl.style.color       = lvl.color;
        });
    }
});

async function handleLogin(e) {
    e.preventDefault();
    clearErrors();

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    setLoading('loginSubmit', true);

    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            window.location.href = '/app';
        } else {
            showError('loginError', data.error || 'Login failed');
        }
    } catch (err) {
        showError('loginError', 'Connection error. Is Flask running?');
    } finally {
        setLoading('loginSubmit', false);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('signupUsername').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm  = document.getElementById('signupConfirm').value;

    if (password !== confirm) {
        showError('signupError', 'Passwords do not match');
        return;
    }

    setLoading('signupSubmit', true);

    try {
        const res  = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            window.location.href = '/app';
        } else {
            showError('signupError', data.error || 'Signup failed');
        }
    } catch (err) {
        showError('signupError', 'Connection error. Is Flask running?');
    } finally {
        setLoading('signupSubmit', false);
    }
}

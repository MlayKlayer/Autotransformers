document.addEventListener('DOMContentLoaded', function () {

    function setMessage(target, text, type) {
        if (!target) return;
        target.textContent = text;
        target.className = type ? 'form-message ' + type : 'form-message';
    }

    async function apiRequest(url, options) {
        var response = await fetch(url, {
            method: options && options.method ? options.method : 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: options && options.body ? JSON.stringify(options.body) : undefined
        });

        if (response.status === 204) return null;

        var data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || 'Request failed.');
        }

        return data;
    }

    async function getCurrentUser() {
        try {
            var result = await apiRequest('/api/auth/me');
            return result.user;
        } catch (e) {
            return null;
        }
    }

    async function logout() {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    }

    async function updateAuthUI() {
        var currentUser = await getCurrentUser();
        var navAuthLink = document.querySelector('nav .nav-links a[href="login.html"], nav .nav-links a[href="#logout"]');

        if (!navAuthLink) return;

        if (currentUser && currentUser.email) {
            navAuthLink.href = '#logout';
            navAuthLink.textContent = 'Logout';
            navAuthLink.classList.add('active');
            navAuthLink.title = 'Signed in as ' + currentUser.email;

            navAuthLink.onclick = async function (e) {
                e.preventDefault();
                await logout();
                window.location.href = 'index.html';
            };
        } else {
            navAuthLink.href = 'login.html';
            navAuthLink.textContent = 'Sign In';
            navAuthLink.title = '';
            navAuthLink.onclick = null;
        }
    }

    // ===== MOBILE NAV TOGGLE =====
    var navToggle = document.querySelector('.nav-toggle');
    var navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () {
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                navToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    // ===== AUTH TABS =====
    var authTabs = document.querySelectorAll('.auth-tab');
    var authForms = document.querySelectorAll('.auth-form');

    authTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var target = this.getAttribute('data-tab');

            authTabs.forEach(function (t) { t.classList.remove('active'); });
            authForms.forEach(function (f) { f.classList.remove('active'); });

            this.classList.add('active');
            var targetForm = document.querySelector('[data-form="' + target + '"]');
            if (targetForm) {
                targetForm.classList.add('active');
            }
        });
    });

    // ===== LOGIN FORM =====
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            var email = document.getElementById('login-email').value.trim().toLowerCase();
            var password = document.getElementById('login-password').value;
            var msg = document.getElementById('loginMessage');

            if (!email || !password) {
                setMessage(msg, 'Please fill in all fields.', 'error');
                return;
            }

            setMessage(msg, 'Signing in...');

            try {
                await apiRequest('/api/auth/login', {
                    method: 'POST',
                    body: { email: email, password: password }
                });
                setMessage(msg, 'Welcome back! Redirecting...', 'success');
                setTimeout(function () {
                    window.location.href = 'car-deals.html';
                }, 700);
            } catch (error) {
                setMessage(msg, error.message, 'error');
            }
        });
    }

    // ===== REGISTER FORM =====
    var registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            var firstName = document.getElementById('reg-first').value.trim();
            var lastName = document.getElementById('reg-last').value.trim();
            var email = document.getElementById('reg-email').value.trim().toLowerCase();
            var phone = document.getElementById('reg-phone').value.trim();
            var password = document.getElementById('reg-password').value;
            var confirm = document.getElementById('reg-confirm').value;
            var msg = document.getElementById('registerMessage');

            if (!firstName || !lastName || !email || !phone || !password || !confirm) {
                setMessage(msg, 'Please fill in all fields.', 'error');
                return;
            }

            if (password !== confirm) {
                setMessage(msg, 'Passwords do not match.', 'error');
                return;
            }

            if (password.length < 8) {
                setMessage(msg, 'Password must be at least 8 characters.', 'error');
                return;
            }

            setMessage(msg, 'Creating account...');

            try {
                await apiRequest('/api/auth/register', {
                    method: 'POST',
                    body: {
                        firstName: firstName,
                        lastName: lastName,
                        email: email,
                        phone: phone,
                        password: password
                    }
                });

                setMessage(msg, 'Account created! Redirecting to inventory...', 'success');
                setTimeout(function () {
                    window.location.href = 'car-deals.html';
                }, 700);
            } catch (error) {
                setMessage(msg, error.message, 'error');
            }
        });
    }

    // ===== CONTACT DEALER AUTH CHECK =====
    document.querySelectorAll('.contact-dealer-btn').forEach(function (btn) {
        btn.addEventListener('click', async function (e) {
            var currentUser = await getCurrentUser();
            if (!currentUser) {
                e.preventDefault();
                window.location.href = 'login.html';
                return;
            }

            e.preventDefault();
            alert('Thanks ' + currentUser.firstName + '! A dealer will contact you shortly at ' + currentUser.email + '.');
        });
    });

    updateAuthUI();

    // ===== SORT FUNCTIONALITY =====
    var sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function () {
            var cards = Array.from(document.querySelectorAll('.car-card'));
            var container = document.querySelector('.car-cards');
            if (!container || cards.length === 0) return;

            var sortBy = this.value;

            cards.sort(function (a, b) {
                switch (sortBy) {
                    case 'price-low':
                        return parseInt(a.dataset.price) - parseInt(b.dataset.price);
                    case 'price-high':
                        return parseInt(b.dataset.price) - parseInt(a.dataset.price);
                    case 'year-new':
                        return parseInt(b.dataset.year) - parseInt(a.dataset.year);
                    case 'mileage-low':
                        return parseInt(a.dataset.mileage) - parseInt(b.dataset.mileage);
                    default:
                        return 0;
                }
            });

            cards.forEach(function (card) {
                container.appendChild(card);
            });
        });
    }

    // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;

            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ===== FINANCING CALCULATOR =====
    var downPaymentInput = document.getElementById('downPayment');
    var loanTermSelect = document.getElementById('loanTerm');
    var interestRateInput = document.getElementById('interestRate');
    var monthlyPaymentDisplay = document.getElementById('monthlyPayment');

    function calculateMonthlyPayment() {
        if (!downPaymentInput || !loanTermSelect || !interestRateInput || !monthlyPaymentDisplay) {
            return; // Calculator not on this page
        }

        var carPrice = 25000; // Ford Mustang price
        var downPayment = parseFloat(downPaymentInput.value) || 0;
        var loanAmount = carPrice - downPayment;
        var loanTerm = parseInt(loanTermSelect.value) || 48;
        var annualRate = parseFloat(interestRateInput.value) || 5.9;
        var monthlyRate = annualRate / 100 / 12;

        if (loanAmount <= 0) {
            monthlyPaymentDisplay.textContent = '$0';
            return;
        }

        var monthlyPayment;
        if (monthlyRate === 0) {
            monthlyPayment = loanAmount / loanTerm;
        } else {
            monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) /
                            (Math.pow(1 + monthlyRate, loanTerm) - 1);
        }

        monthlyPaymentDisplay.textContent = '$' + Math.round(monthlyPayment).toLocaleString();
    }

    if (downPaymentInput) {
        downPaymentInput.addEventListener('input', calculateMonthlyPayment);
        loanTermSelect.addEventListener('change', calculateMonthlyPayment);
        interestRateInput.addEventListener('input', calculateMonthlyPayment);
        calculateMonthlyPayment(); // Initial calculation
    }

});

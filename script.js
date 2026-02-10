document.addEventListener('DOMContentLoaded', function () {

    // ===== MOBILE NAV TOGGLE =====
    var navToggle = document.querySelector('.nav-toggle');
    var navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () {
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close nav when clicking a link
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
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('login-email').value;
            var password = document.getElementById('login-password').value;
            var msg = document.getElementById('loginMessage');

            if (!email || !password) {
                msg.textContent = 'Please fill in all fields.';
                msg.className = 'form-message error';
                return;
            }

            msg.textContent = 'Signing in...';
            msg.className = 'form-message';

            // Simulate login (no backend)
            setTimeout(function () {
                msg.textContent = 'Welcome back! Redirecting...';
                msg.className = 'form-message success';
                setTimeout(function () {
                    window.location.href = 'car-deals.html';
                }, 1000);
            }, 800);
        });
    }

    // ===== REGISTER FORM =====
    var registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var password = document.getElementById('reg-password').value;
            var confirm = document.getElementById('reg-confirm').value;
            var msg = document.getElementById('registerMessage');

            if (password !== confirm) {
                msg.textContent = 'Passwords do not match.';
                msg.className = 'form-message error';
                return;
            }

            if (password.length < 8) {
                msg.textContent = 'Password must be at least 8 characters.';
                msg.className = 'form-message error';
                return;
            }

            msg.textContent = 'Creating account...';
            msg.className = 'form-message';

            setTimeout(function () {
                msg.textContent = 'Account created! You can now sign in.';
                msg.className = 'form-message success';

                // Switch to login tab
                setTimeout(function () {
                    var loginTab = document.querySelector('[data-tab="login"]');
                    if (loginTab) loginTab.click();
                }, 1500);
            }, 800);
        });
    }

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

});

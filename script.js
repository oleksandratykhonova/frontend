document.addEventListener('DOMContentLoaded', function() {

    initServerData();

    initHeader();

    initThemeToggle();

    initSubscribeForm();
    initPriceRange();
    initFilterForm();
    initSortSelect();
    initAuthTabs();
    initRegisterForm();
    initLoginForm();
    initPasswordToggle();
    initPasswordStrength();
    initReviewForm();
    initCommentsLoader();
    initAdminPanel();
    initSupportBubble();
    initPlayButton();
});

function initServerData() {
    var data = window.__SERVER_DATA__;
    if (!data) return;

    var saved = localStorage.getItem('theme');
    if (saved) {
        if (saved === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    } else {

        if (data.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }

    if (data.message) {
        var banner = document.getElementById('server-banner');
        if (banner) {
            banner.textContent = data.message;
            banner.style.display = 'block';
        }
    }
}

function initThemeToggle() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        btn.textContent = '☀️';
    } else {
        btn.textContent = '🌙';
    }

    btn.addEventListener('click', function() {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            btn.textContent = '🌙';
        } else {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            btn.textContent = '☀️';
        }
    });
}

function initHeader() {
    var userNav = document.getElementById('user-nav');
    if (!userNav) return;

    var serverData = window.__SERVER_DATA__;
    if (serverData && serverData.user) {
        renderLoggedIn(userNav, serverData.user);
        return;
    }

    fetch('/api/me')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.user) {
                renderLoggedIn(userNav, data.user);
            } else {
                renderLoggedOut(userNav);
            }
        })
        .catch(function() {
            userNav.style.display = 'none';
        });
}

function renderLoggedIn(container, user) {
    container.innerHTML =
        '<span class="header-username">👤 ' + safeText(user.name) + '</span>' +
        (user.role === 'admin'
            ? '<a href="admin.html" class="btn-secondary">Адмін</a>'
            : '') +
        '<button id="logout-btn" class="btn-outline">Вийти</button>';

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            fetch('/api/logout')
                .then(function() { window.location.reload(); })
                .catch(function() { window.location.reload(); });
        });
    }
}

function renderLoggedOut(container) {
    container.innerHTML = '<a href="register.html" class="btn-primary">Увійти</a>';
}

function initSubscribeForm() {
    var form = document.getElementById('subscribe-form');
    if (!form) return;

    var emailInput = document.getElementById('sub-email');
    var msg = document.getElementById('sub-msg');

    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value !== '' && !isEmail(this.value)) {
                this.classList.add('is-error');
            } else {
                this.classList.remove('is-error');
            }
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var email = emailInput ? emailInput.value.trim() : '';

        if (!email) {
            showMsg(msg, 'Введіть ваш email.', 'error');
            return;
        }
        if (!isEmail(email)) {
            showMsg(msg, 'Некоректний формат email. Приклад: name@domain.com', 'error');
            emailInput.classList.add('is-error');
            return;
        }

        showMsg(msg, '✓ Дякуємо! Ви підписались на новини PawGuard.', 'success');
        emailInput.classList.remove('is-error');
        form.reset();
    });
}

function initPriceRange() {
    var range = document.getElementById('price');       
    var label = document.getElementById('price-val');  
    if (!range || !label) return;

    range.addEventListener('input', function() {
        label.textContent = this.value;
    });
}

function initFilterForm() {
    var form = document.getElementById('filter-form');
    if (!form) return;

    function applyFilters() {
        var query      = (form.querySelector('input[type="search"]') || {}).value || '';
        query = query.trim().toLowerCase();

        var discSelect = document.getElementById('discipline');
        var disc       = discSelect ? discSelect.value : '';

        var levelChecked = form.querySelector('input[name="level"]:checked');
        var level        = levelChecked ? levelChecked.value : 'all';

        var priceRange = document.getElementById('price');
        var maxPrice   = priceRange ? parseInt(priceRange.value) : 999999;

        var cards   = document.querySelectorAll('.course-card');
        var visible = 0;

        cards.forEach(function(card) {

            var titleEl  = card.querySelector('h3');
            var titleTxt = titleEl ? titleEl.textContent.toLowerCase() : '';
            var cardDisc  = (card.dataset.disc  || '').toLowerCase();
            var cardLevel = (card.dataset.level || '').toLowerCase();
            var cardPrice = parseInt(card.dataset.price) || 0;

            var matchQuery = !query || titleTxt.indexOf(query) !== -1 || cardDisc.indexOf(query) !== -1;
            var matchDisc  = !disc  || cardDisc === disc.toLowerCase();
            var matchLevel = level === 'all' || cardLevel === level;
            var matchPrice = cardPrice <= maxPrice;

            var show = matchQuery && matchDisc && matchLevel && matchPrice;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        var countEl = document.getElementById('course-count');
        if (countEl) countEl.textContent = visible;

        var noResults = document.getElementById('no-results');
        if (noResults) {
            noResults.style.display = visible === 0 ? 'block' : 'none';
        }
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        applyFilters();
    });

    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {

            setTimeout(applyFilters, 0);
        });
    }
}

function initSortSelect() {
    var select = document.getElementById('sort-select');
    var grid   = document.getElementById('courses-grid');
    if (!select || !grid) return;

    select.addEventListener('change', function() {
        var cards = Array.prototype.slice.call(grid.querySelectorAll('.course-card'));

        cards.sort(function(a, b) {
            var priceA = parseInt(a.dataset.price) || 0;
            var priceB = parseInt(b.dataset.price) || 0;

            if (select.value === 'price-asc')  return priceA - priceB;
            if (select.value === 'price-desc') return priceB - priceA;
            return 0;
        });

        cards.forEach(function(card) { grid.appendChild(card); });
    });
}

function initAuthTabs() {
    var tabBtns = document.querySelectorAll('.tab-btn');
    if (!tabBtns.length) return;

    tabBtns.forEach(function(btn) {
        btn.addEventListener('click', function() { showTab(this.dataset.tab); });
    });

    var switchBtns = document.querySelectorAll('.link-btn[data-show]');
    switchBtns.forEach(function(btn) {
        btn.addEventListener('click', function() { showTab(this.dataset.show); });
    });
}

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(function(panel) {
        if (panel.id === 'tab-' + tabName) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
}

function initRegisterForm() {
    var form = document.getElementById('register-form');
    if (!form) return;

    var nameInput    = document.getElementById('reg-name');
    var emailInput   = document.getElementById('reg-email');
    var passInput    = document.getElementById('reg-pass');
    var confirmInput = document.getElementById('reg-confirm');

    if (nameInput) {
        nameInput.addEventListener('blur', function() {
            if (this.value.trim().length < 2) {
                showError('err-reg-name', "Введіть ім'я (мінімум 2 символи)");
                this.classList.add('is-error');
            } else {
                clearError('err-reg-name');
                this.classList.remove('is-error');
            }
        });
    }

    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !isEmail(this.value)) {
                showError('err-reg-email', 'Некоректний формат email');
                this.classList.add('is-error');
            } else {
                clearError('err-reg-email');
                this.classList.remove('is-error');
            }
        });
    }

    if (confirmInput && passInput) {
        confirmInput.addEventListener('blur', function() {
            if (this.value !== passInput.value) {
                showError('err-reg-confirm', 'Паролі не співпадають');
                this.classList.add('is-error');
            } else {
                clearError('err-reg-confirm');
                this.classList.remove('is-error');
            }
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var name    = nameInput    ? nameInput.value.trim()    : '';
        var email   = emailInput   ? emailInput.value.trim()   : '';
        var pass    = passInput    ? passInput.value            : '';
        var confirm = confirmInput ? confirmInput.value         : '';
        var terms   = document.getElementById('reg-terms');
        var msgEl   = document.getElementById('reg-msg');
        var submit  = document.getElementById('reg-submit');

        var valid = true;

        if (name.length < 2) {
            showError('err-reg-name', "Введіть ваше ім'я"); valid = false;
        }
        if (!email || !isEmail(email)) {
            showError('err-reg-email', 'Введіть коректний email'); valid = false;
        }
        if (pass.length < 8) {
            showError('err-reg-pass', 'Пароль мінімум 8 символів'); valid = false;
        }
        if (pass !== confirm) {
            showError('err-reg-confirm', 'Паролі не співпадають'); valid = false;
        }
        if (terms && !terms.checked) {
            showError('err-reg-terms', 'Необхідно прийняти умови'); valid = false;
        }

        if (!valid) {
            showMsg(msgEl, '✗ Виправте помилки у формі.', 'error');
            return;
        }

        if (submit) { submit.disabled = true; submit.textContent = 'Зачекайте...'; }

        fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name:     name,
                email:    email,
                password: pass,
                city:     (document.getElementById('reg-city')  || {}).value  || '',
                about:    (document.getElementById('reg-about') || {}).value  || ''
            })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
            if (result.ok) {
                showMsg(msgEl, '✓ Реєстрація успішна! Вітаємо, ' + result.data.user.name + '!', 'success');
                form.reset();
                var fill = document.getElementById('strength-fill');
                var lbl  = document.getElementById('strength-label');
                if (fill) fill.style.width = '0%';
                if (lbl)  lbl.textContent = 'Введіть пароль';
                setTimeout(function() { window.location.reload(); }, 1500);
            } else {
                showMsg(msgEl, '✗ ' + result.data.error, 'error');
                if (result.data.error.indexOf('email') !== -1) {
                    showError('err-reg-email', result.data.error);
                }
            }
        })
        .catch(function() {
            showMsg(msgEl, '✓ Реєстрація збережена локально. Запустіть сервер для збереження даних.', 'success');
            form.reset();
        })
        .finally(function() {
            if (submit) { submit.disabled = false; submit.textContent = 'Зареєструватися'; }
        });
    });
}

function initLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return;

    var emailInput = document.getElementById('log-email');
    var passInput  = document.getElementById('log-pass');
    var submitBtn  = document.getElementById('log-submit');

    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !isEmail(this.value)) {
                showError('err-log-email', 'Некоректний формат email');
                this.classList.add('is-error');
            } else {
                clearError('err-log-email');
                this.classList.remove('is-error');
            }
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var email = emailInput ? emailInput.value.trim() : '';
        var pass  = passInput  ? passInput.value          : '';
        var msgEl = document.getElementById('log-msg');

        if (!email || !pass) {
            showMsg(msgEl, '✗ Заповніть email та пароль.', 'error');
            return;
        }
        if (!isEmail(email)) {
            showError('err-log-email', 'Некоректний email');
            showMsg(msgEl, '✗ Перевірте формат email.', 'error');
            return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Вхід...'; }

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pass })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
            if (result.ok) {
                showMsg(msgEl, '✓ Вхід успішний! Вітаємо, ' + result.data.user.name + '!', 'success');
                setTimeout(function() { window.location.href = 'index.html'; }, 1000);
            } else {
                showMsg(msgEl, '✗ ' + result.data.error, 'error');
            }
        })
        .catch(function() {
            showMsg(msgEl,
                '⚠ Сервер недоступний. Запустіть: npm start. ' +
                'Або відкрийте файл напряму (без реальної авторизації).',
                'error'
            );
        })
        .finally(function() {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Увійти'; }
        });
    });
}

function initPasswordToggle() {
    document.addEventListener('click', function(e) {
        if (!e.target.classList.contains('show-pass')) return;

        var targetId = e.target.dataset.target;
        var input    = document.getElementById(targetId);
        if (!input) return;

        if (input.type === 'password') {
            input.type       = 'text';
            e.target.textContent = '🙈';
        } else {
            input.type       = 'password';
            e.target.textContent = '👁';
        }
    });
}

function initPasswordStrength() {
    var input = document.getElementById('reg-pass');
    var fill  = document.getElementById('strength-fill');
    var label = document.getElementById('strength-label');
    if (!input || !fill || !label) return;

    input.addEventListener('input', function() {
        var score  = getStrength(this.value);
        var levels = [
            { width: '0%',   color: '',        text: 'Введіть пароль' },
            { width: '25%',  color: '#e53e3e', text: '✗ Дуже слабкий' },
            { width: '50%',  color: '#dd6b20', text: '⚠ Слабкий' },
            { width: '75%',  color: '#d69e2e', text: '✓ Добрий' },
            { width: '100%', color: '#38a169', text: '✓ Надійний' }
        ];

        fill.style.width           = levels[score].width;
        fill.style.backgroundColor = levels[score].color;
        label.textContent          = levels[score].text;
    });
}

function getStrength(password) {
    if (!password) return 0;
    var score = 0;
    if (password.length >= 8)            score++;
    if (/[A-Z]/.test(password))          score++;
    if (/[0-9]/.test(password))          score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;
    return score;
}

function initReviewForm() {
    var form = document.getElementById('review-form');
    if (!form) return;

    var nameInput = document.getElementById('r-name');
    var textInput = document.getElementById('r-text');

    if (textInput) {
        textInput.addEventListener('blur', function() {
            if (this.value.trim().length > 0 && this.value.trim().length < 10) {
                showError('err-r-text', 'Відгук повинен містити мінімум 10 символів');
            } else {
                clearError('err-r-text');
            }
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var name   = nameInput ? nameInput.value.trim() : '';
        var rating = (document.getElementById('r-rating') || {}).value || '';
        var text   = textInput ? textInput.value.trim() : '';
        var msgEl  = document.getElementById('review-msg');
        var btn    = form.querySelector('button[type="submit"]');

        if (!name || !rating || text.length < 10) {
            showMsg(msgEl, '✗ Заповніть всі поля. Текст мінімум 10 символів.', 'error');
            return;
        }

        if (btn) btn.disabled = true;

        fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, rating: parseInt(rating), text: text })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var comment = data.comment || { author: name, rating: parseInt(rating), text: text };
            addReviewToDOM(comment);
            showMsg(msgEl, '✓ Дякуємо за відгук! Збережено на сервері.', 'success');
            form.reset();
        })
        .catch(function() {

            addReviewToDOM({ author: name, rating: parseInt(rating), text: text });
            showMsg(msgEl, '✓ Відгук додано локально (сервер недоступний).', 'success');
            form.reset();
        })
        .finally(function() {
            if (btn) btn.disabled = false;
        });
    });
}

function addReviewToDOM(comment) {
    var stars = '';
    for (var i = 0; i < (comment.rating || 5); i++) { stars += '⭐'; }

    var card = document.createElement('div');
    card.className = 'review-card';

    var strong = document.createElement('strong');
    strong.appendChild(document.createTextNode(comment.author + ' ' + stars));

    var p = document.createElement('p');
    p.appendChild(document.createTextNode(comment.text));

    card.appendChild(strong);
    card.appendChild(p);

    var list = document.getElementById('reviews-list');
    if (list) list.insertBefore(card, list.firstChild);
}

function initCommentsLoader() {
    var loadMoreBtn = document.getElementById('load-more-comments');
    if (!loadMoreBtn) return;

    var currentPage = 1;
    var isLoading   = false;

    loadComments(currentPage);

    loadMoreBtn.addEventListener('click', function() {
        if (isLoading) return;
        currentPage++;
        loadComments(currentPage);
    });

    function loadComments(page) {
        isLoading = true;
        loadMoreBtn.disabled     = true;
        loadMoreBtn.textContent  = 'Завантаження...';

        fetch('/api/comments?page=' + page)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                renderComments(data.comments);

                if (!data.hasMore) {
                    loadMoreBtn.style.display = 'none';
                } else {
                    loadMoreBtn.disabled    = false;
                    loadMoreBtn.textContent = 'Завантажити ще відгуки';
                }
            })
            .catch(function() {
                loadMoreBtn.disabled    = false;
                loadMoreBtn.textContent = 'Сервер недоступний';
                loadMoreBtn.style.backgroundColor = '#ccc';
            })
            .finally(function() {
                isLoading = false;
            });
    }

    function renderComments(comments) {
        var list = document.getElementById('server-reviews-list');
        if (!list) return;

        comments.forEach(function(comment) {
            var stars = '';
            for (var i = 0; i < comment.rating; i++) { stars += '⭐'; }

            var date = new Date(comment.date).toLocaleDateString('uk-UA');

            var card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML =
                '<strong>' + safeText(comment.author) + ' ' + stars + '</strong>' +
                '<span class="review-date">' + date + '</span>' +
                '<p>' + safeText(comment.text) + '</p>';

            list.appendChild(card);
        });
    }
}

function initAdminPanel() {
    var adminContent = document.getElementById('admin-content');
    var adminCheck   = document.getElementById('admin-check');
    if (!adminContent) return;

    fetch('/api/me')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.user || data.user.role !== 'admin') {
                if (adminCheck) adminCheck.textContent = '⛔ Доступ заборонено. Увійдіть як адміністратор.';
                return;
            }
            if (adminCheck) adminCheck.style.display = 'none';
            adminContent.classList.remove('hidden');
            loadAdminStats();
            loadAdminUsers();
            loadAdminComments();
        })
        .catch(function() {
            if (adminCheck) adminCheck.textContent = '⚠ Сервер недоступний. Запустіть: npm start';
        });

    function loadAdminStats() {
        var grid = document.getElementById('stats-grid');
        if (!grid) return;

        fetch('/api/stats')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                grid.innerHTML =
                    '<div class="stat-card"><strong>' + (data.users  || 0) + '</strong><span>Користувачів</span></div>' +
                    '<div class="stat-card"><strong>' + (data.comments || 0) + '</strong><span>Відгуків</span></div>' +
                    '<div class="stat-card"><strong>' + (data.courses  || 0) + '</strong><span>Курсів</span></div>';
            })
            .catch(function() {
                if (grid) grid.textContent = 'Не вдалося завантажити статистику.';
            });
    }

    function loadAdminUsers() {
        var tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        fetch('/api/users')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var users = data.users || [];
                if (!users.length) {
                    tbody.innerHTML = '<tr><td colspan="5">Немає користувачів</td></tr>';
                    return;
                }
                tbody.innerHTML = '';
                users.forEach(function(u, idx) {
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' + (idx + 1) + '</td>' +
                        '<td>' + safeText(u.email) + '</td>' +
                        '<td>' + safeText(u.name)  + '</td>' +
                        '<td>' + safeText(u.role || 'user') + '</td>' +
                        '<td>' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('uk-UA') : '—') + '</td>';
                    tbody.appendChild(tr);
                });
            })
            .catch(function() {
                if (tbody) tbody.innerHTML = '<tr><td colspan="5">Помилка завантаження</td></tr>';
            });
    }

    function loadAdminComments() {
        var list = document.getElementById('comments-list');
        if (!list) return;

        fetch('/api/comments')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var comments = data.comments || [];
                if (!comments.length) {
                    list.textContent = 'Відгуків поки немає.';
                    return;
                }
                list.innerHTML = '';
                comments.forEach(function(c) {
                    var stars = '';
                    for (var i = 0; i < (c.rating || 0); i++) { stars += '⭐'; }

                    var card = document.createElement('div');
                    card.className = 'review-card';
                    card.style.position = 'relative';

                    var content = document.createElement('div');
                    content.innerHTML =
                        '<strong>' + safeText(c.author) + ' ' + stars + '</strong>' +
                        '<p>' + safeText(c.text) + '</p>';
                    card.appendChild(content);

                    var delBtn = document.createElement('button');
                    delBtn.textContent = '🗑 Видалити';
                    delBtn.className   = 'btn btn-outline btn-sm';
                    delBtn.style.marginTop = '6px';
                    delBtn.addEventListener('click', function() {
                        if (!confirm('Видалити цей відгук?')) return;
                        fetch('/api/comments/' + c.id, { method: 'DELETE' })
                            .then(function() { card.remove(); })
                            .catch(function() { alert('Помилка видалення'); });
                    });
                    card.appendChild(delBtn);
                    list.appendChild(card);
                });
            })
            .catch(function() {
                if (list) list.textContent = 'Не вдалося завантажити відгуки.';
            });
    }
}

function initSupportBubble() {
    var btn     = document.getElementById('support-btn');
    var tooltip = document.getElementById('support-tooltip');
    if (!btn || !tooltip) return;

    var isOpen = false;

    btn.addEventListener('click', function() {
        isOpen = !isOpen;
        if (isOpen) {
            tooltip.classList.remove('hidden');
            btn.textContent = '✕';
        } else {
            tooltip.classList.add('hidden');
            btn.textContent = '💬';
        }
    });
}

function initPlayButton() {
    var btn = document.getElementById('play-btn');
    if (!btn) return;

    btn.addEventListener('click', function() {
        var preview = document.getElementById('video-preview');
        var wrap    = btn.closest('.video-wrap');
        if (!wrap) return;

        if (preview) preview.style.display = 'none';
        btn.style.display = 'none';

        var iframe    = document.createElement('iframe');
        iframe.src    = 'https://www.youtube.com/embed/rl0Yg6fqwOQ?autoplay=1';
        iframe.width  = '100%';
        iframe.height = '230';
        iframe.style.cssText = 'border:none; border-radius:8px 8px 0 0; display:block;';
        iframe.allow  = 'autoplay; fullscreen';
        wrap.insertBefore(iframe, wrap.firstChild);

        var closeBtn       = document.createElement('button');
        closeBtn.textContent = '✕ Закрити відео';
        closeBtn.className = 'play-btn';
        closeBtn.style.backgroundColor = '#444';
        wrap.appendChild(closeBtn);

        closeBtn.addEventListener('click', function() {
            iframe.remove();
            closeBtn.remove();
            if (preview) preview.style.display = 'block';
            btn.style.display = 'block';
        });
    });
}

function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str);
}

function showError(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearError(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '';
}

function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className   = 'form-msg ' + (type || '');
}

function safeText(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str || '')));
    return div.innerHTML;
}

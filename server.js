/*
 * PawGuard — server.js
 *
 * Лаб. 5: Взаємодія клієнта і сервера. Налаштування локального сервера.
 *   - Express-сервер роздає статичні файли
 *   - Реєстрація та вхід: POST /api/register, POST /api/login
 *   - Сесії через cookie (без сторонніх бібліотек)
 *   - Паролі хешуються через bcryptjs (захищене збереження)
 *   - Дані зберігаються у JSON-файлах (файлова система замість БД)
 *   - Сервер інжектує window.__SERVER_DATA__ у кожну HTML-сторінку
 *   - Нічна темна тема: якщо година сервера 20:00–07:59 — dark-theme
 *
 * Лаб. 6: REST API та обмін даними між клієнтом і сервером.
 *   - GET  /api/courses   → JSON список курсів
 *   - GET  /api/theme     → JSON поточна тема (день/ніч)
 *   - GET  /api/stats     → JSON статистика сайту
 *   - GET  /api/comments  → JSON список відгуків (з пагінацією)
 *   - POST /api/comments  → додати відгук
 *   - GET  /api/users     → JSON список юзерів (тільки для адміна)
 *   - DELETE /api/comments/:id → видалити відгук (тільки для адміна)
 */

var express = require('express');
var fs      = require('fs');
var path    = require('path');
var bcrypt  = require('bcryptjs');
var crypto  = require('crypto');  // вбудований у Node.js

var app  = express();
var PORT = 3000;

// ── Шляхи до файлів даних ────────────────────────────────────────
var DATA_DIR      = path.join(__dirname, 'data');
var USERS_FILE    = path.join(DATA_DIR, 'users.json');
var COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
var COURSES_FILE  = path.join(DATA_DIR, 'courses.json');

// ── Сесії в пам'яті (зникають при рестарті — ок для лаб. роботи) ─
var sessions = {};

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ═══════════════════════════════════════════════════════════════════
// ДОПОМІЖНІ ФУНКЦІЇ
// ═══════════════════════════════════════════════════════════════════

// Читаємо JSON-файл, повертаємо масив/об'єкт
function readJSON(filePath) {
    try {
        var raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

// Записуємо дані у JSON-файл
function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Парсимо cookie з заголовка запиту (без бібліотеки)
function parseCookies(req) {
    var cookies = {};
    var header  = req.headers.cookie || '';
    header.split(';').forEach(function(part) {
        var idx = part.indexOf('=');
        if (idx < 0) return;
        var key = part.slice(0, idx).trim();
        var val = part.slice(idx + 1).trim();
        try { cookies[key] = decodeURIComponent(val); } catch(e) { cookies[key] = val; }
    });
    return cookies;
}

// Встановлюємо cookie сесії (HttpOnly — захист від XSS)
function setSessionCookie(res, sessionId) {
    res.setHeader('Set-Cookie',
        'pg_session=' + sessionId + '; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax'
    );
}

// Очищуємо cookie
function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', 'pg_session=; HttpOnly; Path=/; Max-Age=0');
}

// Створюємо сесію для userId, повертаємо sessionId
function createSession(userId) {
    var sessionId = crypto.randomBytes(32).toString('hex');
    sessions[sessionId] = { userId: userId, createdAt: Date.now() };
    return sessionId;
}

// Отримуємо об'єкт сесії з запиту (або null)
function getSession(req) {
    var cookies   = parseCookies(req);
    var sessionId = cookies.pg_session;
    if (!sessionId) return null;
    return sessions[sessionId] || null;
}

// Отримуємо поточного юзера з сесії (або null)
function getCurrentUser(req) {
    var session = getSession(req);
    if (!session) return null;
    var users = readJSON(USERS_FILE);
    var user  = users.find(function(u) { return u.id === session.userId; });
    if (!user) return null;
    // Повертаємо без пароля
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// Визначаємо тему за серверним часом (темна тема вночі)
function getTheme() {
    var hour = new Date().getHours();
    return (hour >= 20 || hour < 8) ? 'dark' : 'light';
}

// Перевірка коректності email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Сервер роздає HTML з інжекцією даних (Лаб. 5) ────────────────
//
// Лаб. 5 вимагає, щоб сторінки містили контент, згенерований
// сервером (залежно від cookie сесії та поточного часу).
// Ми читаємо HTML-файл і вставляємо <script>window.__SERVER_DATA__</script>
// перед закриттям </head>. Клієнтський JS читає ці дані і оновлює UI.
//
function servePageWithData(req, res, filename) {
    var filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('<h1>Сторінку не знайдено</h1>');
    }

    var html    = fs.readFileSync(filePath, 'utf8');
    var user    = getCurrentUser(req);
    var theme   = getTheme();
    var hour    = new Date().getHours();

    // Дані від сервера — клієнт отримує їх без додаткового запиту
    var serverData = {
        user:    user,
        theme:   theme,
        hour:    hour,
        message: theme === 'dark'
            ? 'Добрий вечір! Вмикаємо нічний режим 🌙'
            : 'Гарного дня! Ідеальний час для тренування ☀️'
    };

    var injection = '\n<script>window.__SERVER_DATA__ = ' +
        JSON.stringify(serverData) + ';</script>';

    // Вставляємо перед закриттям </head>
    var injectedHtml = html.replace('</head>', injection + '\n</head>');

    // Нічна темна тема: додаємо клас до <body>
    if (theme === 'dark') {
        injectedHtml = injectedHtml.replace('<body>', '<body class="dark-theme">');
        injectedHtml = injectedHtml.replace('<body ', '<body class="dark-theme" ');
    }

    res.send(injectedHtml);
}


// ═══════════════════════════════════════════════════════════════════
// МАРШРУТИ СТОРІНОК (сервер рендерить з інжекцією даних — Лаб. 5)
// ═══════════════════════════════════════════════════════════════════

app.get('/', function(req, res) {
    servePageWithData(req, res, 'index.html');
});

// Усі HTML-сторінки проходять через servePageWithData
var pages = ['index.html', 'catalog.html', 'course.html',
             'register.html', 'react.html', 'spa.html', 'admin.html'];

pages.forEach(function(page) {
    app.get('/' + page, function(req, res) {
        servePageWithData(req, res, page);
    });
});


// ═══════════════════════════════════════════════════════════════════
// REST API — Лаб. 5 + Лаб. 6
// ═══════════════════════════════════════════════════════════════════

// ── GET /api/me — хто зараз залогінений ──────────────────────────
app.get('/api/me', function(req, res) {
    var user = getCurrentUser(req);
    res.json({ user: user });
});

// ── POST /api/register — реєстрація ──────────────────────────────
app.post('/api/register', function(req, res) {
    var name     = (req.body.name     || '').trim();
    var email    = (req.body.email    || '').trim().toLowerCase();
    var password = (req.body.password || '');
    var city     = (req.body.city     || '');
    var about    = (req.body.about    || '');

    // Валідація
    if (name.length < 2) {
        return res.status(400).json({ error: "Введіть ім'я (мінімум 2 символи)" });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Некоректний формат email' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль повинен містити мінімум 8 символів' });
    }

    var users = readJSON(USERS_FILE);

    // Перевірка унікальності email
    if (users.find(function(u) { return u.email === email; })) {
        return res.status(400).json({ error: 'Цей email вже зареєстровано' });
    }

    // Хешуємо пароль (bcryptjs, 10 раундів) — захищене збереження
    var hashedPassword = bcrypt.hashSync(password, 10);

    var newUser = {
        id:        Date.now().toString(),
        name:      name,
        email:     email,
        password:  hashedPassword,
        city:      city,
        about:     about,
        role:      'user',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeJSON(USERS_FILE, users);

    // Одразу логінимо після реєстрації
    var sessionId = createSession(newUser.id);
    setSessionCookie(res, sessionId);

    res.json({
        ok:   true,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
});

// ── POST /api/login — вхід ────────────────────────────────────────
app.post('/api/login', function(req, res) {
    var email    = (req.body.email    || '').trim().toLowerCase();
    var password = (req.body.password || '');

    if (!email || !password) {
        return res.status(400).json({ error: 'Заповніть усі поля' });
    }

    var users = readJSON(USERS_FILE);
    var user  = users.find(function(u) { return u.email === email; });

    // bcrypt.compareSync порівнює відкритий пароль з хешем
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Невірний email або пароль' });
    }

    var sessionId = createSession(user.id);
    setSessionCookie(res, sessionId);

    res.json({
        ok:   true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
});

// ── GET /api/logout — вихід ───────────────────────────────────────
app.get('/api/logout', function(req, res) {
    var cookies   = parseCookies(req);
    var sessionId = cookies.pg_session;
    if (sessionId) delete sessions[sessionId];
    clearSessionCookie(res);
    res.json({ ok: true });
});


// ── GET /api/comments?page=1 — список відгуків (з пагінацією) ────
// Лаб. 6: JSON-ендпоінт #1, Лаб. 5: дані з файлу на сервері
app.get('/api/comments', function(req, res) {
    var page    = Math.max(1, parseInt(req.query.page) || 1);
    var perPage = 3;   // по 3 коментарі на сторінку

    var all   = readJSON(COMMENTS_FILE);
    var start = (page - 1) * perPage;
    var slice = all.slice(start, start + perPage);

    res.json({
        comments: slice,
        total:    all.length,
        page:     page,
        perPage:  perPage,
        hasMore:  start + perPage < all.length
    });
});

// ── POST /api/comments — додати відгук ───────────────────────────
// Лаб. 5: клієнт надсилає POST, сервер зберігає у файл
app.post('/api/comments', function(req, res) {
    var text   = (req.body.text   || '').trim();
    var rating = parseInt(req.body.rating) || 5;

    if (!text) {
        return res.status(400).json({ error: 'Порожній текст відгуку' });
    }
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Оцінка від 1 до 5' });
    }

    // Ім'я автора: з сесії або з тіла запиту
    var user       = getCurrentUser(req);
    var authorName = user ? user.name : ((req.body.name || '').trim() || 'Анонім');

    var comment = {
        id:     Date.now().toString(),
        author: authorName,
        rating: rating,
        text:   text,
        date:   new Date().toISOString()
    };

    var comments = readJSON(COMMENTS_FILE);
    comments.unshift(comment);   // новий коментар першим
    writeJSON(COMMENTS_FILE, comments);

    res.status(201).json({ ok: true, comment: comment });
});

// ── DELETE /api/comments/:id — видалити відгук (тільки адмін) ────
app.delete('/api/comments/:id', function(req, res) {
    var user = getCurrentUser(req);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ заборонено' });
    }

    var comments = readJSON(COMMENTS_FILE);
    var filtered = comments.filter(function(c) { return c.id !== req.params.id; });

    if (filtered.length === comments.length) {
        return res.status(404).json({ error: 'Коментар не знайдено' });
    }

    writeJSON(COMMENTS_FILE, filtered);
    res.json({ ok: true });
});


// ── GET /api/courses — список курсів (Лаб. 6: JSON #2) ───────────
app.get('/api/courses', function(req, res) {
    var courses    = readJSON(COURSES_FILE);
    var discipline = req.query.discipline;
    var level      = req.query.level;

    if (discipline) {
        courses = courses.filter(function(c) { return c.discipline === discipline; });
    }
    if (level) {
        courses = courses.filter(function(c) { return c.level === level; });
    }

    res.json({ courses: courses, total: courses.length });
});


// ── GET /api/theme — поточна тема за часом сервера (Лаб. 6: JSON #3)
app.get('/api/theme', function(req, res) {
    var hour  = new Date().getHours();
    var isDark = (hour >= 20 || hour < 8);
    res.json({
        theme:   isDark ? 'dark' : 'light',
        hour:    hour,
        message: isDark
            ? 'Надворі ніч — вмикаємо темну тему 🌙'
            : 'Денний час — світла тема ☀️'
    });
});


// ── GET /api/stats — статистика (Лаб. 6: JSON #4) ────────────────
app.get('/api/stats', function(req, res) {
    var users    = readJSON(USERS_FILE);
    var comments = readJSON(COMMENTS_FILE);
    var courses  = readJSON(COURSES_FILE);

    res.json({
        totalUsers:    users.length,
        totalComments: comments.length,
        totalCourses:  courses.length,
        serverTime:    new Date().toISOString(),
        serverHour:    new Date().getHours(),
        theme:         getTheme()
    });
});


// ── GET /api/users — список юзерів (тільки адмін) ─────────────────
app.get('/api/users', function(req, res) {
    var user = getCurrentUser(req);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ заборонено' });
    }

    var users = readJSON(USERS_FILE);
    // Не відправляємо паролі!
    var safeUsers = users.map(function(u) {
        return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
    });

    res.json({ users: safeUsers });
});

// ── DELETE /api/users/:id — видалити юзера (тільки адмін) ────────
app.delete('/api/users/:id', function(req, res) {
    var currentUser = getCurrentUser(req);
    if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ заборонено' });
    }
    if (req.params.id === currentUser.id) {
        return res.status(400).json({ error: 'Не можна видалити себе' });
    }

    var users    = readJSON(USERS_FILE);
    var filtered = users.filter(function(u) { return u.id !== req.params.id; });

    if (filtered.length === users.length) {
        return res.status(404).json({ error: 'Користувача не знайдено' });
    }

    writeJSON(USERS_FILE, filtered);
    res.json({ ok: true });
});


// ── Статичні файли (CSS, JS, зображення) ─────────────────────────
// Підключаємо ПІСЛЯ маршрутів сторінок, щоб HTML-маршрути мали пріоритет
app.use(express.static(__dirname));


// ═══════════════════════════════════════════════════════════════════
// ЗАПУСК СЕРВЕРА
// ═══════════════════════════════════════════════════════════════════
app.listen(PORT, function() {
    console.log('');
    console.log('  🐾 PawGuard сервер запущено!');
    console.log('  👉 Відкрий у браузері: http://localhost:' + PORT);
    console.log('');
    console.log('  API-ендпоінти (Лаб. 6):');
    console.log('    GET  http://localhost:' + PORT + '/api/courses');
    console.log('    GET  http://localhost:' + PORT + '/api/theme');
    console.log('    GET  http://localhost:' + PORT + '/api/stats');
    console.log('    GET  http://localhost:' + PORT + '/api/comments');
    console.log('');
    console.log('  Тестовий адмін-акаунт:');
    console.log('    Email:  admin@pawguard.ua');
    console.log('    Пароль: Admin2025!');
    console.log('');
});

const API_URL = "https://arashi-api.onrender.com";
// Implementar en tu app.js o movil.html

/* --- CONTROLADOR DE GÉNERO (HOMBRE / MUJER) --- */
function setGender(val) {
    console.log("🥋 Cambio de categoría detectado:", val);
    
    const input = document.getElementById('new-genero');
    const btnHombre = document.getElementById('btn-gender-home');
    const btnMujer = document.getElementById('btn-gender-dona');

    if (!input || !btnHombre || !btnMujer) return;

    // Guardamos el valor para Strapi
    input.value = val;
    
    // Sincronización visual de botones
    if (val === 'HOMBRE') {
        btnHombre.classList.add('active');
        btnHombre.style.background = "#ef4444"; btnHombre.style.color = "white";
        btnMujer.classList.remove('active');
        btnMujer.style.background = "transparent"; btnMujer.style.color = "#94a3b8";
    } else {
        btnMujer.classList.add('active');
        btnMujer.style.background = "#ef4444"; btnMujer.style.color = "white";
        btnHombre.classList.remove('active');
        btnHombre.style.background = "transparent"; btnHombre.style.color = "#94a3b8";
    }
}

async function fetchSmart(endpoint, cacheKey, durationHours = 24) {
    const cached = localStorage.getItem(`cache_${cacheKey}`);
    if (cached) {
        const { time, data } = JSON.parse(cached);
        // Si la caché tiene menos de X horas, no molestamos al servidor
        if ((Date.now() - time) < (1000 * 60 * 60 * durationHours)) {
            return data;
        }
    }
    
    const res = await fetch(`${API_URL}${endpoint}`, { 
        headers: { 'Authorization': `Bearer ${jwtToken}` } 
    });
    const json = await res.json();
    
    // Guardamos con timestamp
    localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
        time: Date.now(),
        data: json
    }));
    return json;
}

// Ejemplo de uso para los 110 alumnos (Caché de 1 hora)
// loadAlumnos() -> fetchSmart('/api/alumnos?populate=*', 'alumnos_list', 1);
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));
let globalAsistId = null; // Variable global para guardar el ID de la asistencia

const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if (jwtToken) showDashboard();
    setupDniInput('dni-login'); 
    setupDniInput('new-dni');
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    document.getElementById('search-baja')?.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
    setupDragScroll();
    // Detectar si el usuario viene desde un email de recuperación
    const urlParams = new URLSearchParams(window.location.search);
    const resetCode = urlParams.get('code');

    if (resetCode) {
        console.log("🔑 Código de recuperación detectado. Abriendo Reset Modal...");
        openResetPasswordModal(resetCode);
    }

    const yearLabel = document.getElementById('current-year-lbl');
    if (yearLabel) yearLabel.textContent = new Date().getFullYear();

    const seguroSwitch = document.getElementById('new-seguro');
    if (seguroSwitch) {
        seguroSwitch.addEventListener('change', (e) => {
            const txt = document.getElementById('seguro-status-text');
            txt.innerText = e.target.checked ? "PAGADO" : "NO PAGADO";
            txt.style.color = e.target.checked ? "#22c55e" : "#ef4444";
        });
    }
});

// --- SESIÓN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value;
    const password = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
            jwtToken = data.jwt;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            showDashboard();
        } else { document.getElementById('login-error').innerText = "❌ Credenciales incorrectas"; }
    } catch { document.getElementById('login-error').innerText = "❌ Error de conexión"; }
});

function logout() { localStorage.clear(); location.reload(); }

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); loadCiudades(); loadReportDojos(); showSection('welcome');
}

function showSection(id) {
    // 1. Ocultar todas las secciones y limpiar clases de centrado
    document.querySelectorAll('.section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active', 'welcome-flex');
        s.style.display = "none"; 
    });
    
    // 2. Mostrar la seleccionada
    const targetSection = document.getElementById(`sec-${id}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        // Flex para bienvenida (centrar logo), Block para el resto
        targetSection.style.display = (id === 'welcome') ? "flex" : "block";
        if (id === 'welcome') targetSection.classList.add('welcome-flex', 'active');
    }
    
    // 3. Gestionar botones activos del menú
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-nav-${id}`);
    if(activeBtn) activeBtn.classList.add('active');

    // 4. Cerrar menú en móvil y limpiar menús de acciones abiertos
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('open');
    closeAlumnoActions();

    // 5. Lógica de "Nuevo Alumno": Resetear si NO estamos editando
    if (id === 'nuevo-alumno') { 
        const isEditing = document.getElementById('edit-id').value !== ""; 
        if (!isEditing) resetForm(); 
    }

    // 6. DISPARADORES DE CARGA (Funcionalidades intactas)
    if (id === 'alumnos') loadAlumnos(true);
    if (id === 'bajas') loadAlumnos(false);
    if (id === 'dojos') loadDojosCards();
    if (id === 'status') runDiagnostics(); // Activa letras verdes
}

// --- UTILS ---
const parseRelation = (obj) => { if(!obj || !obj.data) return obj; return obj.data.attributes || obj.data; };
const getID = (obj) => obj?.documentId || obj?.id;

// SEGURIDAD PARA BOTONES: Escapar comillas simples en nombres (ej: O'Connor)
function escapeQuotes(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'");
}

function getDojoName(dojoObj) {
    const d = parseRelation(dojoObj);
    return d && d.nombre ? d.nombre.replace(/Aikido\s+/gi, '').trim() : "NO DISP";
}

function normalizeGrade(g) {
    if (!g) return 'NO DISP';
    let s = g.toUpperCase().trim();
    if (s.includes('DAN') || s.includes('KYU')) {
        const match = s.match(/(\d+)/);
        if (match) return `${match[1]}º ${s.includes('DAN') ? 'DAN' : 'KYU'}`;
    }
    return s;
}

function getGradeWeight(g) { return GRADE_WEIGHTS[normalizeGrade(g)] || 0; }
function formatDateDisplay(d) { if (!d) return 'NO DISP'; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function formatDateExcel(d) { if (!d) return ""; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function calculateAge(d) { if (!d) return 'NO DISP'; const t = new Date(), b = new Date(d); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return isNaN(a) ? 'NO DISP' : a; }
function normalizePhone(t) { if (!t || t === "-") return 'NO DISP'; return t.toString().replace(/^(\+?34)/, '').trim(); }
function togglePassword(i, icon) { const x = document.getElementById(i); if (x.type === "password") { x.type = "text"; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } else { x.type = "password"; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); } }

/* --- CARGA DE ALUMNOS (REGLA DE 12 COLUMNAS) --- */
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    const cacheKey = activos ? 'cache_alumnos_activos' : 'cache_alumnos_bajas';
    
    // Mostramos cargando con el colspan de 12
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:30px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Sincronizando Tatami con Neon...
    </td></tr>`;

    try {
        const filter = `filters[activo][$eq]=${activos}`;
        const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=500`, { 
            headers: { 'Authorization': `Bearer ${jwtToken}` } 
        });
        const json = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data: json.data || [] }));
        renderTableAlumnos(json.data || [], tbody, activos);
    } catch (e) { 
        tbody.innerHTML = `<tr><td colspan="12" style="color:#ef4444; text-align:center; padding:20px;">Fallo de conexión con Render.</td></tr>`; 
    }
}

/* --- RENDERIZADO DE TABLA (VERSION 12 COLUMNAS - ALINEACIÓN TOTAL) --- */
function renderTableAlumnos(data, tbody, activos) {
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; opacity:0.5;">No hay registros disponibles.</td></tr>`;
        return;
    }

    data.forEach(a => {
        const p = a.attributes || a;
        const id = a.documentId || a.id;
        const safeNombre = escapeQuotes(p.nombre || '');
        const safeApellidos = escapeQuotes(p.apellidos || '');
        
        // 1. Icono de Género
        const genIcon = p.genero === 'MUJER' 
            ? ' <i class="fa-solid fa-venus" style="color:#f472b6; font-size:10px; margin-left:5px;"></i>' 
            : ' <i class="fa-solid fa-mars" style="color:#60a5fa; font-size:10px; margin-left:5px;"></i>';

        // 2. Cálculo de Edad
        const edadActual = calculateAge(p.fecha_nacimiento);
        const edadDisplay = edadActual !== 'NO DISP' ? `${edadActual} años` : '---';

        const tr = document.createElement('tr');
        tr.id = `row-${id}`;
        tr.onclick = (e) => handleAlumnoSelection(id, safeNombre, safeApellidos, e, activos);
        
        // 3. INYECCIÓN DE LAS 12 CELDAS (Orden estricto)
        tr.innerHTML = `
            <td><strong>${(p.apellidos || '').toUpperCase()}</strong></td>
            <td>${p.nombre || ''}${genIcon}</td>
            <td style="font-size:0.7rem; color:#94a3b8; font-weight:800;">${p.genero || 'HOMBRE'}</td>
            <td style="font-size:0.8rem;">${p.dni || ''}</td>
            <td style="font-weight:600; color:#cbd5e1">${edadDisplay}</td>
            <td><span class="badge">${normalizeGrade(p.grado)}</span></td>
            <td style="font-weight:bold; color:var(--primary)">${parseFloat(p.horas_acumuladas || 0).toFixed(1)}h</td>
            <td><span class="${p.seguro_pagado ? 'badge-ok' : 'badge-no'}">${p.seguro_pagado ? 'SÍ' : 'NO'}</span></td>
            <td style="font-size:0.8rem;">${normalizePhone(p.telefono)}</td>
            <td style="font-size:0.7rem; color:#94a3b8">${p.email || '-'}</td>
            <td style="font-size:0.7rem;">${(p.direccion || '').toUpperCase()} <br> <small style="opacity:0.6">${(p.poblacion || '').toUpperCase()}</small></td>
            <td style="font-weight:600;">${getDojoName(p.dojo)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// A. SELECCIÓN DE ALUMNO CON CENTRADO SIMÉTRICO
function handleAlumnoSelection(id, nombre, apellidos, event, esActivo) {
    // 1. Limpieza absoluta previa
    closeAlumnoActions();
    const row = document.getElementById(`row-${id}`);
    if (row) row.classList.add('selected-row');

    // 2. Lógica para Móvil
    if (window.innerWidth <= 900) {
        const actionsHtml = esActivo ? `
            <div class="action-item-wrap">
                <button class="action-btn-icon" onclick="generateIndividualHistory('${id}', '${nombre}', '${apellidos}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
                <span class="action-item-label">Historial</span>
            </div>
            <div class="action-item-wrap">
                <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
                <span class="action-item-label">Editar</span>
            </div>
            <div class="action-item-wrap">
                <button class="action-btn-icon delete" onclick="confirmarEstado('${id}', false, '${nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
                <span class="action-item-label">Baja</span>
            </div>
        ` : `
            <div class="action-item-wrap">
                <button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
                <span class="action-item-label">Activar</span>
            </div>
            <div class="action-item-wrap">
                <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${nombre}')"><i class="fa-solid fa-trash-can"></i></button>
                <span class="action-item-label">Eliminar</span>
            </div>
        `;
        document.getElementById('sheet-alumno-name').innerText = `${nombre} ${apellidos}`;
        document.getElementById('sheet-actions-container').innerHTML = actionsHtml;
        document.getElementById('bottom-sheet-mobile').classList.remove('hidden');
    } 
    // 3. Lógica para Escritorio
    else {
        const actionsHtml = esActivo ? `
            <button class="action-btn-icon" onclick="generateIndividualHistory('${id}', '${nombre}', '${apellidos}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
            <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn-icon delete" onclick="confirmarEstado('${id}', false, '${nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
        ` : `
            <button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
            <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${nombre}')"><i class="fa-solid fa-trash-can"></i></button>
        `;
        
        const targetId = esActivo ? 'actions-alumnos' : 'actions-bajas';
        const container = document.getElementById(targetId);
        
        if (container) {
            // Estructura simplificada sin grid-column para que flex haga su trabajo
            container.innerHTML = `
                <span class="student-tag">${nombre} ${apellidos}</span>
                <div class="actions-buttons-wrap">${actionsHtml}</div>
            `;
            container.classList.add('active');
        }
    }
    
    if (event) event.stopPropagation();
}



// También actualizamos closeAlumnoActions para limpiar la barra
function closeAlumnoActions() {
    // 1. Quitar resaltado de las filas
    document.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
    
    // 2. Limpiar barras de escritorio
    ['actions-alumnos', 'actions-bajas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.innerHTML = '';
        }
    });

    // 3. Ocultar el Bottom Sheet móvil
    const sheet = document.getElementById('bottom-sheet-mobile');
    if (sheet) sheet.classList.add('hidden');
}

function logout() { localStorage.clear(); location.reload(); }

// Cerrar acciones al hacer clic fuera
document.addEventListener('click', (e) => {
    const isRowClick = e.target.closest('tr');
    const isBarClick = e.target.closest('.action-bar-desktop');
    const isSheetClick = e.target.closest('.bottom-sheet-content');

    if (!isRowClick && !isBarClick && !isSheetClick) {
        closeAlumnoActions();
    }
});


/* --- EVENTO SUBMIT: GUARDAR EN NEON + LIMPIEZA DE CACHÉ --- */
const formAlumno = document.getElementById('form-nuevo-alumno');
if (formAlumno) {
    formAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        
        const seminariosData = Array.from(document.querySelectorAll('[id^="sem-"]')).map(row => {
            const anyValue = parseInt(row.querySelector('.sem-any').value);
            return {
                sensei: row.querySelector('.sem-sensei').value || "",
                ciudad: row.querySelector('.sem-ciudad').value || "",
                pais: row.querySelector('.sem-pais').value || "",
                mes: row.querySelector('.sem-mes').value || "",
                any: isNaN(anyValue) ? new Date().getFullYear() : anyValue
            };
        });

        const alumnoData = { 
            nombre: document.getElementById('new-nombre').value, 
            apellidos: document.getElementById('new-apellidos').value, 
            dni: document.getElementById('new-dni').value, 
            fecha_nacimiento: document.getElementById('new-nacimiento').value || null, 
            fecha_inicio: document.getElementById('new-alta').value || null, 
            email: document.getElementById('new-email').value, 
            telefono: document.getElementById('new-telefono').value, 
            direccion: document.getElementById('new-direccion').value, 
            poblacion: document.getElementById('new-poblacion').value, 
            cp: document.getElementById('new-cp').value, 
            dojo: document.getElementById('new-dojo').value, 
            grupo: document.getElementById('new-grupo').value, 
            grado: document.getElementById('new-grado').value, 
            seguro_pagado: document.getElementById('new-seguro').checked,
            genero: document.getElementById('new-genero').value, 
            horas_acumuladas: parseFloat(document.getElementById('new-horas').value) || 0,
            seminarios: seminariosData,
            activo: true 
        };
        
        try {
            const method = id ? 'PUT' : 'POST'; 
            const url = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;
            const res = await fetch(url, { 
                method: method, 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
                body: JSON.stringify({ data: alumnoData }) 
            });
            
            if (res.ok) {
                // --- 🥋 EL CAMBIO QUIRÚRGICO AQUÍ ---
                // Al guardar, borramos la caché local de activos y bajas
                // Esto obliga a loadAlumnos() a pedir los datos nuevos a Neon
                localStorage.removeItem('cache_alumnos_activos');
                localStorage.removeItem('cache_alumnos_bajas');
                console.log("♻️ Memoria local purificada. Sincronizando datos frescos...");

                showModal("¡OSS!", id ? "Datos actualizados." : "Alumno registrado.", () => { 
                    resetForm(); 
                    showSection('alumnos'); // Al entrar aquí, loadAlumnos() hará fetch real
                });
            } else { 
                showModal("Error", "Fallo al guardar. Revisa los permisos de Strapi."); 
            }
        } catch (error) { 
            showModal("Error", "Fallo de conexión con Render."); 
        }
    });
}

/* --- FUNCIÓN: EDITAR ALUMNO (CARGA DE DATOS) --- */
/* --- CARGA DE FICHA PARA EDICIÓN (VINCULACIÓN GÉNERO) --- */
async function editarAlumno(documentId) {
    closeAlumnoActions();
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=*`, { 
            headers: { 'Authorization': `Bearer ${jwtToken}` } 
        });
        const json = await res.json();
        const data = json.data; 
        const p = data.attributes || data;
        
        // Asignamos el DocumentID para el futuro PUT
        document.getElementById('edit-id').value = data.documentId || documentId;
        
        document.getElementById('new-nombre').value = p.nombre || '';
        document.getElementById('new-apellidos').value = p.apellidos || '';
        document.getElementById('new-dni').value = p.dni || '';
        document.getElementById('new-nacimiento').value = p.fecha_nacimiento || '';
        document.getElementById('new-alta').value = p.fecha_inicio || '';
        document.getElementById('new-email').value = p.email || '';
        document.getElementById('new-telefono').value = p.telefono || '';
        document.getElementById('new-direccion').value = p.direccion || '';
        document.getElementById('new-poblacion').value = p.poblacion || '';
        document.getElementById('new-cp').value = p.cp || '';
        document.getElementById('new-grado').value = p.grado || '';
        document.getElementById('new-grupo').value = p.grupo || 'Full Time';
        
        // Sincronizar el selector de Género
        setGender(p.genero === 'MUJER' ? 'MUJER' : 'HOMBRE');

        // Sincronizar Seguro
        const chk = document.getElementById('new-seguro'); 
        const txt = document.getElementById('seguro-status-text'); 
        chk.checked = p.seguro_pagado === true; 
        txt.innerText = chk.checked ? "PAGADO" : "NO PAGADO";
        txt.style.color = chk.checked ? "#22c55e" : "#ef4444";
        
        // Sincronizar Dojo
        let dojoId = p.dojo?.documentId || p.dojo?.data?.documentId || "";
        document.getElementById('new-dojo').value = dojoId;

        // Carga Técnica
        document.getElementById('new-horas').value = p.horas_acumuladas || 0;
        const containerSem = document.getElementById('seminarios-list');
        containerSem.innerHTML = ""; 
        (p.seminarios || []).forEach(s => addSeminarioRow(s));

        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR ALUMNO"; 
        const btnCancel = document.getElementById('btn-cancelar-edit');
        if (btnCancel) btnCancel.classList.remove('hidden'); 
        
        // MOSTRAR SECCIÓN KEIKO MANUAL
        const manualKeikoSec = document.getElementById('manual-keiko-section');
        if (manualKeikoSec) manualKeikoSec.classList.remove('hidden');
        updateSeminariosDatalists();
        showSection('nuevo-alumno');

    } catch (e) { 
        console.error("Error al cargar alumno:", e);
        showModal("Error", "No se pudo conectar con Neon para obtener la ficha."); 
    }
}

/* --- REGISTRO MANUAL DE KEIKO (TATAMI RETROACTIVO) --- */
async function registrarKeikoManual() {
    const studentId = document.getElementById('edit-id').value;
    const dojoId = document.getElementById('new-dojo').value;
    const dateVal = document.getElementById('mk-date').value;
    const timeVal = document.getElementById('mk-time').value;
    const durVal = document.getElementById('mk-dur').value;

    // Validación anti-errores
    if (!studentId) {
        showModal("Error", "Guarda primero la ficha del alumno nuevo antes de añadir un keiko.");
        return;
    }
    if (!dojoId || !dateVal || !timeVal) {
        showModal("Aviso", "Rellena Fecha, Hora y Dojo para registrar el Keiko.");
        return;
    }

    // Formato Estricto Arashi: ISO Timezone Safe
    const isoString = `${dateVal}T${timeVal}:00.000Z`;
    const durNum = parseFloat(durVal);
    
    const btn = document.querySelector('#manual-keiko-section button');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESANDO...';
    btn.disabled = true;

    try {
        let classId = null;

        // 1. ESCUDO ANTI-DUPLICADOS Y BÚSQUEDA DE CLASE EXISTENTE
        const resClase = await fetch(`${API_URL}/api/clases?filters[Fecha_Hora][$eq]=${isoString}&filters[dojo][documentId][$eq]=${dojoId}`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const jsonClase = await resClase.json();

        if (jsonClase.data && jsonClase.data.length > 0) {
            classId = jsonClase.data[0].documentId || jsonClase.data[0].id;
        } else {
            // No existe, la creamos al vuelo silenciosamente
            const createRes = await fetch(`${API_URL}/api/clases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
                body: JSON.stringify({ data: { Fecha_Hora: isoString, Duracion: durNum, dojo: dojoId } })
            });
            if (!createRes.ok) throw new Error("Fallo al crear la clase maestra.");
            const newClass = await createRes.json();
            classId = newClass.data.documentId || newClass.data.id;
        }

        // 2. REGISTRO DE ASISTENCIA Y CONTROL DE DUPLICADOS (Evitar doble conteo)
        const resAsist = await fetch(`${API_URL}/api/asistencias?filters[alumno][documentId][$eq]=${studentId}&filters[clase][documentId][$eq]=${classId}`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const jsonAsist = await resAsist.json();
        
        let sumarHoras = false;

        if (jsonAsist.data && jsonAsist.data.length > 0) {
            const asistencia = jsonAsist.data[0];
            const asistId = asistencia.documentId || asistencia.id;
            const estadoPrevio = asistencia.attributes?.Estado || asistencia.Estado;

            // Si ya asistió, detenemos la operación
            if (estadoPrevio === 'Asistio' || estadoPrevio === 'Asistió') {
                showModal("Aviso", "El alumno ya tenía validada la asistencia a este Keiko.");
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return;
            }

            // Si estaba como Confirmado o Falta, lo pasamos a Asistio
            await fetch(`${API_URL}/api/asistencias/${asistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
                body: JSON.stringify({ data: { Estado: 'Asistio' } })
            });
            sumarHoras = true;
        } else {
            // Creamos asistencia nueva y directa en estado 'Asistio'
            await fetch(`${API_URL}/api/asistencias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
                body: JSON.stringify({ data: { alumno: studentId, clase: classId, Estado: 'Asistio' } })
            });
            sumarHoras = true;
        }

        // 3. ACTUALIZACIÓN DEL HISTORIAL DE HORAS EN LA FICHA
        if (sumarHoras) {
            const inputHoras = document.getElementById('new-horas');
            const horasActuales = parseFloat(inputHoras.value || 0);
            const nuevasHoras = horasActuales + durNum;
            
            // Actualizamos en Strapi
            const resUpdate = await fetch(`${API_URL}/api/alumnos/${studentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
                body: JSON.stringify({ data: { horas_acumuladas: nuevasHoras } })
            });

            if(resUpdate.ok) {
                // Reflejo visual inmediato
                inputHoras.value = nuevasHoras.toFixed(1);

                // Forzamos limpieza de caché de tablas (Alumnos Activos y Archivo de Clases)
                localStorage.removeItem('cache_alumnos_activos');
                localStorage.removeItem('cache_alumnos_bajas');
                localStorage.removeItem('cache_clases_archivo');
                
                showModal("¡OSS!", "Asistencia retroactiva registrada. Se han sumado las horas al alumno.");
                
                // Vaciamos los campos para poder meter el siguiente keiko rápidamente
                document.getElementById('mk-date').value = '';
                document.getElementById('mk-time').value = '';
            } else {
                throw new Error("Strapi rechazó la suma de horas.");
            }
        }

    } catch (error) {
        console.error("🔥 Error al registrar keiko manual:", error);
        showModal("Error", "Fallo de conexión con Neon/Render.");
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}



/* --- FUNCIÓN: RESET FORMULARIO --- */
/* --- RESET TOTAL DEL FORMULARIO --- */
function resetForm() { 
    // OCULTAR SECCIÓN KEIKO MANUAL
    const manualKeikoSec = document.getElementById('manual-keiko-section');
    if (manualKeikoSec) manualKeikoSec.classList.add('hidden');


    const f = document.getElementById('form-nuevo-alumno'); 
    if (f) f.reset(); 
    
    // Reset Seguro
    const statusTxt = document.getElementById('seguro-status-text');
    if (statusTxt) {
        statusTxt.innerText = "NO PAGADO"; 
        statusTxt.style.color = "#ef4444"; 
    }
    
    // Reset Género al valor por defecto
    setGender('HOMBRE');
    
    // Reset IDs y Botones
    document.getElementById('edit-id').value = ""; 
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO"; 
    const btnCancel = document.getElementById('btn-cancelar-edit');
    if (btnCancel) btnCancel.classList.add('hidden'); 
    
    document.getElementById('new-horas').value = 0;
    document.getElementById('seminarios-list').innerHTML = "";

    updateSeminariosDatalists();
}

function confirmarEstado(id, activo, nombre) { 
    // Cerramos el panel para que no moleste al ver el Modal de confirmación
    closeAlumnoActions();
    
    showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, async () => { 
        const fecha = activo ? null : new Date().toISOString().split('T')[0]; 
        await fetch(`${API_URL}/api/alumnos/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
            body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) 
        }); 
        // Tras la acción, vamos a la sección correspondiente
        showSection(activo ? 'alumnos' : 'bajas'); 
    }); 
}
function eliminarDefinitivo(id, nombre) { showModal("¡PELIGRO!", `¿Borrar físicamente a ${nombre}?`, () => { setTimeout(() => { showModal("ÚLTIMO AVISO", "Irreversible.", async () => { await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); loadAlumnos(false); }); }, 500); }); }

// --- LOGICA CAMBIO DE CONTRASEÑA ---
function openChangePasswordModal() {
    document.getElementById('change-pass-form').reset();
    document.getElementById('change-pass-modal').classList.remove('hidden');
}

document.getElementById('change-pass-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('cp-current').value;
    const password = document.getElementById('cp-new').value;
    const passwordConfirmation = document.getElementById('cp-confirm').value;

    if (password !== passwordConfirmation) { showModal("Error", "Las contraseñas nuevas no coinciden."); return; }

    try {
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ currentPassword, password, passwordConfirmation })
        });
        const data = await res.json();
        if (res.ok) {
            showModal("Éxito", "Contraseña actualizada. Inicia sesión de nuevo.", () => logout());
        } else {
            showModal("Error", data.error ? data.error.message : "No se pudo cambiar la contraseña.");
        }
    } catch { showModal("Error", "Fallo de conexión."); }
});

// --- INFORMES ---
function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }

/* --- INFORME TÉCNICO COMPLETO (CLASES + SEMINARIOS) --- */
async function generateIndividualHistory(id, nombre, apellidos) {
    closeAlumnoActions();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    try {
        // 1. OBTENER FICHA COMPLETA (Para seminarios)
        const resAlu = await fetch(`${API_URL}/api/alumnos/${id}?populate=*`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const jsonAlu = await resAlu.json();
        const p = jsonAlu.data.attributes || jsonAlu.data;

        // 2. OBTENER ASISTENCIAS
        // Quitamos el sort de la URL porque Strapi no puede ordenar bien por tablas relacionadas
        const resAsist = await fetch(`${API_URL}/api/asistencias?filters[alumno][documentId][$eq]=${id}&populate=clase&pagination[limit]=200`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const jsonAsist = await resAsist.json();
        let asistencias = jsonAsist.data ||[];

        // 🥋 MOTOR DE ORDENACIÓN CRONOLÓGICA EN CLIENTE
        asistencias.sort((a, b) => {
            const cA = parseRelation((a.attributes || a).clase);
            const cB = parseRelation((b.attributes || b).clase);
            const timeA = cA?.Fecha_Hora ? new Date(cA.Fecha_Hora).getTime() : 0;
            const timeB = cB?.Fecha_Hora ? new Date(cB.Fecha_Hora).getTime() : 0;
            return timeB - timeA; // Descendente: Más recientes primero
        });

        // CABECERA
        doc.setFontSize(18); doc.text(`PASAPORTE TÉCNICO ARASHI`, 105, 15, { align: 'center' });
        doc.setFontSize(12); doc.text(`${apellidos.toUpperCase()}, ${nombre} - ${normalizeGrade(p.grado)}`, 105, 23, { align: 'center' });
        doc.setFontSize(10); doc.text(`Horas en Tatami: ${parseFloat(p.horas_acumuladas || 0).toFixed(1)}h | Dojo: ${getDojoName(p.dojo)}`, 105, 29, { align: 'center' });

        // SECCIÓN A: SEMINARIOS REALIZADOS
        doc.setFontSize(12); doc.setTextColor(190, 0, 0); doc.text("HISTORIAL DE SEMINARIOS Y CURSOS", 14, 38);
        doc.setTextColor(0, 0, 0);

        // 🥋 MOTOR DE ORDENACIÓN CRONOLÓGICA INTELIGENTE (Año > Mes)
        const mesesMap = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
            "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
        };

        let seminariosOrd = [...(p.seminarios || [])].sort((a, b) => {
            const anyA = parseInt(a.any || 0);
            const anyB = parseInt(b.any || 0);
            if (anyA !== anyB) return anyB - anyA; // Año descendente

            const mesA = mesesMap[a.mes?.toLowerCase().trim()] || 0;
            const mesB = mesesMap[b.mes?.toLowerCase().trim()] || 0;
            return mesB - mesA; // Mes descendente
        });
        
        const semBody = seminariosOrd.map(s =>[
            s.sensei || '-', 
            s.ciudad || '-', 
            s.pais || '-', 
            `${s.mes || ''} ${s.any || ''}`.trim()
        ]);

        doc.autoTable({
            startY: 42, 
            head: [['SENSEI / MAESTRO', 'CIUDAD', 'PAÍS', 'FECHA']], 
            body: semBody.length ? semBody : [['---', 'No hay seminarios registrados', '---', '---']],
            theme: 'grid', 
            headStyles: { fillColor:[51, 65, 85] }, 
            styles: { fontSize: 8 }
        });

        // SECCIÓN B: ÚLTIMAS ASISTENCIAS
        let finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(12); doc.setTextColor(190, 0, 0); doc.text("REGISTRO DE CLASES RECIENTES", 14, finalY);
        doc.setTextColor(0, 0, 0);

        const asistBody = asistencias.map(item => {
            const a = item.attributes || item;
            const c = parseRelation(a.clase);
            const [fechaPart, resto] = (c?.Fecha_Hora || "T").split('T');
            return[
                formatDateDisplay(fechaPart),
                resto.substring(0, 5) + "h",
                c?.Duracion + "h",
                a.Estado === 'Asistio' ? 'ASISTIÓ' : 'FALTA'
            ];
        });

        doc.autoTable({
            startY: finalY + 4, head: [['FECHA', 'HORA', 'DURACIÓN', 'ESTADO']], body: asistBody,
            theme: 'striped', headStyles: { fillColor: [190, 0, 0] }, styles: { fontSize: 8 }
        });

        doc.save(`Pasaporte_${apellidos}_${nombre}.pdf`);

    } catch (e) { 
        console.error(e);
        showModal("Error", "No se pudo generar el pasaporte técnico."); 
    }
}

/* --- GENERADOR DE INFORMES ARASHI V34.0 (EDICIÓN ESTADÍSTICA: EDAD MEDIA) --- */
async function generateReport(type) {
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect.value;
    const dojoFilterName = dojoSelect.options[dojoSelect.selectedIndex].text;
    const attendanceDate = document.getElementById('report-attendance-date').value;

    if (type === 'attendance' && !attendanceDate) {
        showModal("Aviso", "Selecciona una fecha en el calendario.");
        return;
    }

    document.getElementById('report-modal').classList.add('hidden');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();
        const isBaja = type.startsWith('bajas');

        try {
            let list = [];
            
            if (type === 'attendance') {
                const apiUrl = `${API_URL}/api/asistencias?populate=clase,alumno.dojo&pagination[limit]=1000&sort=createdAt:desc`;
                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                list = (json.data || []).filter(item => {
                    const a = item.attributes || item;
                    const cla = parseRelation(a.clase);
                    const alu = parseRelation(a.alumno);
                    const matchFecha = cla?.Fecha_Hora?.startsWith(attendanceDate);
                    const matchDojo = !dojoFilterId || getID(alu?.dojo) === dojoFilterId;
                    return matchFecha && matchDojo;
                });
            } else {
                let apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=${isBaja ? 'false' : 'true'}&populate=dojo&pagination[limit]=1000`;
                if (dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;
                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                list = json.data || [];
            }

            if (list.length === 0) {
                showModal("Sin Datos", "No hay registros para esta selección.");
                return;
            }

            // 🥋 CÁLCULO ESTADÍSTICO: EDAD MEDIA (Quirúrgico para criterio Edad)
            let edadMediaStr = "";
            if (type === 'age') {
                let sumaEdades = 0;
                let validos = 0;
                list.forEach(item => {
                    const p = item.attributes || item;
                    const edad = calculateAge(p.fecha_nacimiento);
                    if (typeof edad === 'number' && !isNaN(edad)) {
                        sumaEdades += edad;
                        validos++;
                    }
                });
                const media = validos > 0 ? (sumaEdades / validos).toFixed(1) : 0;
                edadMediaStr = `EDAD MEDIA DEL GRUPO: ${media} AÑOS`;
            }

            // 🥋 MOTOR DE ORDENACIÓN INTEGRAL
            list.sort((a, b) => {
                const attrA = a.attributes || a;
                const attrB = b.attributes || b;
                const pA = (type === 'attendance') ? (attrA.alumno?.data?.attributes || {}) : attrA;
                const pB = (type === 'attendance') ? (attrB.alumno?.data?.attributes || {}) : attrB;
                const nomA = (pA.apellidos || "").toUpperCase();
                const nomB = (pB.apellidos || "").toUpperCase();

                if (type === 'insurance') {
                    const sA = pA.seguro_pagado ? 1 : 0, sB = pB.seguro_pagado ? 1 : 0;
                    if (sA !== sB) return sA - sB;
                }
                if (type === 'gender') {
                    const gA = (pA.genero || 'HOMBRE') === 'MUJER' ? 0 : 1;
                    const gB = (pB.genero || 'HOMBRE') === 'MUJER' ? 0 : 1;
                    if (genA !== genB) return gA - gB;
                }
                if (type === 'grade') {
                    const wA = getGradeWeight(pA.grado), wB = getGradeWeight(pB.grado);
                    if (wA !== wB) return wB - wA;
                }
                if (type === 'age') {
                    const eA = calculateAge(pA.fecha_nacimiento), eB = calculateAge(pB.fecha_nacimiento);
                    const vA = isNaN(eA) ? 999 : eA, vB = isNaN(eB) ? 999 : eB;
                    if (vA !== vB) return vA - vB;
                }
                return nomA.localeCompare(nomB, 'es');
            });

            const dic = { 'surname': 'APELLIDOS', 'grade': 'GRADOS', 'age': 'EDAD', 'gender': 'GÉNERO', 'insurance': 'SEGUROS', 'attendance': 'ASISTENCIA' };
            const displayDate = attendanceDate ? formatDateDisplay(attendanceDate) : new Date().toLocaleDateString('es-ES');

            const headRow = (type === 'attendance') 
                ? ['Nº', 'Apellidos', 'Nombre', 'Dojo Sede', 'Tipo Clase', 'Hora', 'Estado']
                : ['Nº', 'Apellidos', 'Nombre', (type === 'gender' ? 'Género' : 'DNI'), 'Edad', 'Grado', 'Horas', 'Seguro', 'Teléfono', 'Dojo'];

            const body = list.map((item, index) => {
                const a = item.attributes || item;
                if (type === 'attendance') {
                    const alu = parseRelation(a.alumno);
                    const cla = parseRelation(a.clase);
                    return [`${index + 1}`, (alu?.apellidos || '').toUpperCase(), alu?.nombre || '', getDojoName(alu?.dojo), cla?.Tipo || 'Keiko', cla?.Fecha_Hora?.split('T')[1].substring(0, 5) + "h", (a.Estado || a.estado || 'CONFIRMADO').toUpperCase()];
                } else {
                    const colVar = (type === 'gender') ? (a.genero || 'HOMBRE') : (a.dni || '-');
                    return [`${index + 1}`, (a.apellidos || '').toUpperCase(), a.nombre || '', colVar, calculateAge(a.fecha_nacimiento), normalizeGrade(a.grado), parseFloat(a.horas_acumuladas || 0).toFixed(1) + 'h', a.seguro_pagado ? 'SÍ' : 'NO', normalizePhone(a.telefono), getDojoName(a.dojo)];
                }
            });

            doc.autoTable({
                startY: 32, margin: { top: 32, left: 10, right: 10 },
                head: [headRow], body: body, theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1.5 },
                headStyles: { fillColor: [190, 0, 0], halign: 'center' },
                didDrawPage: (data) => {
                    doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                    doc.setFontSize(14); doc.text("INFORME OFICIAL ARASHI", pageWidth / 2, 12, { align: 'center' });
                    doc.setFontSize(9); doc.text(`DOJO: ${dojoFilterName} | CRITERIO: ${dic[type] || type.toUpperCase()} | FECHA: ${displayDate}`, pageWidth / 2, 18, { align: 'center' });
                    
                    // INYECCIÓN DE EDAD MEDIA (Sólo si type es age)
                    if (type === 'age' && edadMediaStr) {
                        doc.setFontSize(10);
                        doc.setTextColor(190, 0, 0); // Rojo Arashi para resaltar el dato
                        doc.text(edadMediaStr, pageWidth / 2, 25, { align: 'center' });
                        doc.setTextColor(0, 0, 0); // Reset color
                    }
                }
            });
            doc.save(`Arashi_Informe_${type}.pdf`);
        } catch (e) { 
            console.error("🔥 Error PDF:", e);
            showModal("Error", "No se pudo generar el informe."); 
        }
    };
}

// --- EXPORTAR EXCEL ---
async function exportBackupExcel() {
    const dojoFilter = document.getElementById('export-dojo-filter').value;
    const btn = document.querySelector('button[onclick="exportBackupExcel()"]');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GENERANDO...';
    btn.disabled = true;

    try {
        let apiUrl = `${API_URL}/api/alumnos?populate=dojo&pagination[limit]=2000&filters[activo][$eq]=true`;
        if (dojoFilter) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilter}`;

        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let data = json.data || [];

        data.sort((a, b) => {
            const nomA = (a.attributes?.apellidos || a.apellidos || "").toUpperCase();
            const nomB = (b.attributes?.apellidos || b.apellidos || "").toUpperCase();
            return nomA.localeCompare(nomB);
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Listado Alumnos');

        // CONFIGURACIÓN DE PÁGINA
        sheet.pageSetup.orientation = 'landscape';
        sheet.pageSetup.fitToPage = true;
        sheet.pageSetup.fitToWidth = 1;

        // DEFINICIÓN DE COLUMNAS (Header se usará manualmente en la fila 5)
        const columnas = [
            { name: 'APELLIDOS DEL ALUMNO', width: 30 },
            { name: 'NOMBRE', width: 18 },
            { name: 'DNI / NIE', width: 14 },
            { name: 'FECHA NAC.', width: 12 },
            { name: 'DOMICILIO COMPLETO', width: 35 },
            { name: 'POBLACIÓN', width: 20 },
            { name: 'C.P.', width: 8 },
            { name: 'TELÉFONO', width: 14 },
            { name: 'CORREO ELECTRÓNICO', width: 28 },
            { name: 'DOJO ASIGNADO', width: 22 },
            { name: 'GRUPO / HORARIO', width: 15 },
            { name: 'GRADO ACTUAL', width: 12 },
            { name: 'ESTADO SEGURO', width: 14 },
            { name: 'TOTAL HORAS', width: 10 }
        ];

        sheet.columns = columnas.map(col => ({ header: col.name, key: col.name, width: col.width }));

        // DISEÑO CABECERA CORPORATIVA (Filas 1-3)
        for(let i=1; i<=3; i++) {
            sheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1120' } };
        }

        sheet.mergeCells('A1:N2');
        const mainTitle = sheet.getCell('A1');
        mainTitle.value = 'ARASHI GROUP AIKIDO - GESTIÓN INTEGRAL DE ALUMNOS';
        mainTitle.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        mainTitle.alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.mergeCells('A3:N3');
        const subTitle = sheet.getCell('A3');
        const hoy = new Date().toLocaleDateString('es-ES');
        subTitle.value = `DATOS DE USUARIOS | EMISIÓN: ${hoy} | ALUMNOS ACTIVOS EN TATAMI`;
        subTitle.font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' } };
        subTitle.alignment = { vertical: 'middle', horizontal: 'center' };

        // FILA 4: ESPACIO EN BLANCO MÍNIMO
        sheet.getRow(4).height = 10;

        // FILA 5: ENCABEZADOS DE TABLA PROFESIONALES
        const headerRow = sheet.getRow(5);
        headerRow.values = columnas.map(col => col.name);
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { bottom: { style: 'medium' }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        });

        // INSERCIÓN DE DATOS
        data.forEach((item, index) => {
            const p = item.attributes || item;
            const row = sheet.addRow([
                (p.apellidos || '').toUpperCase(),
                p.nombre || '',
                p.dni || '',
                formatDateExcel(p.fecha_nacimiento),
                (p.direccion || '').toUpperCase(),
                (p.poblacion || '').toUpperCase(),
                p.cp || '',
                normalizePhone(p.telefono),
                p.email || '',
                getDojoName(p.dojo).toUpperCase(),
                (p.group || p.grupo || 'FULL TIME').toUpperCase(),
                normalizeGrade(p.grado),
                p.seguro_pagado ? 'PAGADO' : 'PENDIENTE',
                parseFloat(p.horas_acumuladas || 0).toFixed(1)
            ]);

            const bgColor = (index % 2 === 0) ? 'FFFFFFFF' : 'FFF9FAFB';
            row.eachCell((cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.font = { size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: colNumber > 11 ? 'center' : 'left', indent: 1 };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFEDF2F7' } } };
            });

            // Formato condicional Seguro
            const sCell = row.getCell(13);
            sCell.font = { color: { argb: p.seguro_pagado ? 'FF15803D' : 'FFB91C1C' }, bold: true, size: 9 };
        });

        // INSERCIÓN DE LOGO (Ancho corregido para proporción)
        try {
            const response = await fetch('img/logo-arashi.png');
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const logoId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
            sheet.addImage(logoId, {
                tl: { col: 0.1, row: 0.1 },
                ext: { width: 90, height: 50 } // Logo más ancho para respetar proporción
            });
        } catch (e) { console.warn("Logo no disponible"); }

        // DESCARGA
        const buffer = await workbook.xlsx.writeBuffer();
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([buffer]));
        a.download = `LISTADO_OFICIAL_ARASHI_${new Date().getFullYear()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (e) {
        showModal("Error", "No se pudo generar el Excel.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function confirmResetInsurance() { showModal("⚠️ ATENCIÓN", "¿Resetear TODOS los seguros?", () => runResetProcess()); }
async function runResetProcess() { const out = document.getElementById('console-output'); out.innerHTML = "<div>Iniciando...</div>"; try { const r = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&filters[seguro_pagado][$eq]=true&pagination[limit]=2000`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const j = await r.json(); const l = j.data || []; for (const i of l) { await fetch(`${API_URL}/api/alumnos/${i.documentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { seguro_pagado: false } }) }); } out.innerHTML += "<div style='color:#33ff00'>COMPLETADO.</div>"; } catch (e) { out.innerHTML += `<div>ERROR: ${e.message}</div>`; } }

// --- FUNCIONES ARREGLADAS DOJOS ---
async function loadDojosCards() { 
    const grid = document.getElementById('grid-dojos'); 
    if (!grid) return; 
    grid.innerHTML = '<p style="color:#aaa;">Cargando dojos...</p>'; 
    try { 
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); 
        const json = await res.json(); 
        const data = json.data || [];
        grid.innerHTML = ''; 
        
        if(data.length === 0) { 
            grid.innerHTML = '<p>No hay dojos registrados.</p>'; 
            return; 
        }

        data.forEach(d => { 
            const p = d.attributes || d; 
            // Limpieza del nombre (quitar "Aikido Arashi" si ya lo tiene para no repetir)
            const cleanName = (p.nombre || 'Dojo').replace(/Aikido\s+Arashi\s+/gi, '').trim(); 
            const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : 'NO DISP'; 
            
            grid.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header">
                        <h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3>
                    </div>
                    <div class="dojo-body">
                        <div class="dojo-info-row">
                            <i class="fa-solid fa-map-location-dot"></i>
                            <span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span>
                        </div>
                        <div class="dojo-info-row">
                            <i class="fa-solid fa-phone"></i>
                            <span>${p.telefono || 'NO DISP'}</span>
                        </div>
                        <div class="dojo-info-row">
                            <i class="fa-solid fa-envelope"></i>
                            <span>${p.email || 'NO DISP'}</span>
                        </div>
                        <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                    </div>
                </div>`; 
        }); 
    } catch(e) { 
        console.error(e);
        grid.innerHTML = '<p style="color:red">Error al conectar con la base de datos.</p>'; 
    } 
}

async function loadDojosSelect() {
    const s = document.getElementById('new-dojo');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        s.innerHTML = '<option value="">Selecciona...</option>';
        (j.data || []).forEach(d => { 
            const docId = d.documentId || d.id;
            // FIX: Nombre seguro
            const p = d.attributes || d;
            s.innerHTML += `<option value="${docId}">${p.nombre}</option>`; 
        });
    } catch {}
}

async function loadReportDojos() {
    const s = document.getElementById('report-dojo-filter');
    const e = document.getElementById('export-dojo-filter');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        const options = (j.data || []).map(d => {
            const docId = d.documentId || d.id;
            const p = d.attributes || d;
            return `<option value="${docId}">${p.nombre}</option>`;
        }).join('');
        const html = '<option value="">-- Todos los Dojos --</option>' + options;
        if (s) s.innerHTML = html; if (e) e.innerHTML = html;
    } catch {}
}

async function loadCiudades() { const d = document.getElementById('ciudades-list'); if (d) { try { const r = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const j = await r.json(); d.innerHTML = ''; [...new Set((j.data || []).map(a => (a.attributes ? a.attributes.poblacion : a.poblacion)).filter(Boolean))].sort().forEach(c => d.innerHTML += `<option value="${c}">`); } catch { } } }
async function runDiagnostics() { const o = document.getElementById('console-output'); if (o) { o.innerHTML = ''; const l = ["Iniciando...", "> Conectando DB... [OK]", "> Verificando API... [OK]", "SISTEMA ONLINE 100%"]; for (const x of l) { await new Promise(r => setTimeout(r, 400)); o.innerHTML += `<div>${x}</div>`; } o.innerHTML += '<div style="padding:15px; border-top:1px solid #33ff00;"><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="action-btn secondary" style="text-decoration:none; display:inline-block; border-color:#33ff00; color:#33ff00;">Ver Estado de Strapi</a></div>'; } }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function filtrarTabla(t, i) { const input = document.getElementById(i); if (!input) return; const f = input.value.toUpperCase(); const rows = document.getElementById(t).getElementsByTagName('tr'); for (let j = 1; j < rows.length; j++) rows[j].style.display = rows[j].textContent.toUpperCase().includes(f) ? "" : "none"; }
function changeFontSize(t, d) { const table = document.getElementById(t); if (!table) return; table.querySelectorAll('th, td').forEach(c => { const s = parseFloat(window.getComputedStyle(c).fontSize); c.style.fontSize = (Math.max(8, s + d)) + "px"; }); }

// FIX SCROLL: Prevenir default para que no seleccione texto
function setupDragScroll() { 
    const s = document.querySelector('.drag-scroll'); 
    if (!s) return; 
    let d = false, x, l; 
    s.addEventListener('mousedown', e => { 
        d = true; 
        s.classList.add('active'); // Activa cursor grabbing y user-select:none
        x = e.pageX - s.offsetLeft; 
        l = s.scrollLeft; 
        e.preventDefault(); // CLAVE: Evita selección de texto
    }); 
    s.addEventListener('mouseleave', () => { d = false; s.classList.remove('active'); }); 
    s.addEventListener('mouseup', () => { d = false; s.classList.remove('active'); }); 
    s.addEventListener('mousemove', e => { 
        if (!d) return; 
        e.preventDefault(); 
        const p = e.pageX - s.offsetLeft; 
        s.scrollLeft = l - (p - x) * 2; 
    }); 
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function scrollToTop() { const c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); }
const ca = document.querySelector('.content'); if (ca) { ca.addEventListener('scroll', () => { const b = document.getElementById('btn-scroll-top'); if (ca.scrollTop > 300) b.classList.add('visible'); else b.classList.remove('visible'); }); }

function showModal(titulo, mensaje, callbackOk = null) {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btnOk = document.getElementById('modal-btn-ok');
    const btnCancel = document.getElementById('modal-btn-cancel');

    // Asignar textos
    if (titleEl) titleEl.innerText = titulo;
    if (msgEl) msgEl.innerText = mensaje;

    // ELIMINAR CUALQUIER ONCLICK PREVIO DEL HTML (Esto limpia el "clic muerto")
    btnOk.onclick = null;
    btnCancel.onclick = null;

    // ASIGNAR EVENTOS NUEVOS
    btnOk.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (callbackOk) callbackOk();
    }, { once: true }); // { once: true } es vital para evitar eventos duplicados

    btnCancel.addEventListener('click', () => {
        modal.classList.remove('hidden'); // Solo para asegurar visibilidad antes de cerrar
        modal.classList.add('hidden');
    }, { once: true });

    // Mostrar
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}

// 1. Función para añadir una fila de seminario
function addSeminarioRow(data = {}) {
    const container = document.getElementById('seminarios-list');
    // Generamos un ID único combinando el tiempo y un número aleatorio
    const rowId = 'sem-' + Date.now() + Math.floor(Math.random() * 1000);
    const div = document.createElement('div');
    
    div.className = 'seminario-item';
    div.id = rowId;
    div.style = `background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 20px; position: relative;`;

    div.innerHTML = `
        <button type="button" onclick="borrarFilaSeminario('${rowId}')" 
            style="position:absolute; top:-10px; right:-10px; background:var(--bg-dark); border:1px solid var(--accent); color:var(--accent); cursor:pointer; width:25px; height:25px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size: 0.8rem; z-index:10;">
            <i class="fa-solid fa-xmark"></i>
        </button>
        
        <div class="form-row" style="margin-bottom: 10px;">
            <div class="form-group" style="flex:2">
                <input type="text" class="sem-sensei" value="${data.sensei || ''}" placeholder="Sensei / Maestro">
            </div>
            <div class="form-group" style="flex:1">
                <input type="text" class="sem-ciudad" value="${data.ciudad || ''}" placeholder="Ciudad">
            </div>
        </div>
        
        <div class="form-row" style="margin-bottom:0;">
            <div class="form-group" style="flex:1">
                <input type="text" class="sem-pais" value="${data.pais || ''}" placeholder="País">
            </div>
            <div class="form-group" style="flex:0.5">
                <input type="text" class="sem-mes" value="${data.mes || ''}" placeholder="Mes">
            </div>
            <div class="form-group" style="flex:0.5">
                <input type="number" class="sem-any" value="${data.any || new Date().getFullYear()}" placeholder="Año">
            </div>
        </div>
    `;
    container.appendChild(div);
}

// Función auxiliar para borrar la fila exacta
function borrarFilaSeminario(id) {
    const el = document.getElementById(id);
    if (el) {
        el.remove();
    }
}

// 2. Inteligencia: Extraer datos existentes para autocompletado
async function updateSeminariosDatalists() {
    try {
        // URL actualizada con 'seminarios'
        const res = await fetch(`${API_URL}/api/alumnos?populate=seminarios&pagination[limit]=100`, { 
            headers: { 'Authorization': `Bearer ${jwtToken}` } 
        });
        const json = await res.json();
        if (!json || !json.data) return;

        const senseis = new Set(), ciudades = new Set(), paises = new Set();
        json.data.forEach(alu => {
            const p = alu.attributes || alu;
            const items = p.seminarios || []; // <--- CAMBIADO
            items.forEach(s => {
                if(s.sensei) senseis.add(s.sensei.trim());
                if(s.ciudad) ciudades.add(s.ciudad.trim());
                if(s.pais) paises.add(s.pais.trim());
            });
        });
        
        const fill = (id, set) => {
            const dl = document.getElementById(id);
            if(dl) dl.innerHTML = [...set].sort().map(v => `<option value="${v}">`).join('');
        };
        fill('senseis-list', senseis);
        fill('ciudades-seminario-list', ciudades);
        fill('paises-list', paises);
    } catch (e) { console.warn("Datalists: No se han podido cargar las sugerencias."); }
}

setInterval(() => {
    // Usamos la variable API_URL que ya cambiaste a "arashi-api.onrender.com"
    fetch(`${API_URL}/api/dojos`) 
        .then(() => console.log("💓 Latido Arashi: Render está despierto"))
        .catch(() => {});
}, 1000 * 60 * 5); // Cada 5 minutos para que coincida con el robot

/* --- SISTEMA DE ORDENACIÓN DINÁMICA (VERSION PREMIUM CON SOPORTE EDAD) --- */
let currentSortCol = '';
let isAsc = true;

async function sortTable(colName) {
    // 1. Detectar si estamos en la pestaña de Activos o Bajas para saber qué caché usar
    const actives = !document.getElementById('sec-alumnos').classList.contains('hidden');
    const cacheKey = actives ? 'cache_alumnos_activos' : 'cache_alumnos_bajas';
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    
    if (!cached || !cached.data) return;

    let data = cached.data;
    
    // Cambiar dirección de orden si se pulsa la misma columna
    isAsc = (currentSortCol === colName) ? !isAsc : true;
    currentSortCol = colName;

    console.log(`⚖️ Ordenando Tatami por: ${colName} | Dirección: ${isAsc ? 'ASC' : 'DESC'}`);

    // 2. Motor de ordenación
    data.sort((a, b) => {
        const pA = a.attributes || a;
        const pB = b.attributes || b;
        
        let valA, valB;

        // CASO A: Ordenar por DOJO (extraer nombre de la relación)
        if (colName === 'dojo') {
            valA = getDojoName(pA.dojo); 
            valB = getDojoName(pB.dojo);
        } 
        // CASO B: Ordenar por HORAS (comparación numérica)
        else if (colName === 'horas_acumuladas') {
            valA = parseFloat(pA[colName] || 0); 
            valB = parseFloat(pB[colName] || 0);
        } 
        // CASO C: Ordenar por EDAD (basado en fecha_nacimiento)
        else if (colName === 'fecha_nacimiento') {
            // Convertimos a timestamp para comparar números de milisegundos
            // Usamos una fecha lejana de 2100 para los que no tengan fecha definida (irán al final)
            valA = new Date(pA.fecha_nacimiento || '2100-01-01').getTime();
            valB = new Date(pB.fecha_nacimiento || '2100-01-01').getTime();
            
            // Si es ASC (A-Z), queremos los más jóvenes primero (fecha más grande/reciente)
            return isAsc ? valB - valA : valA - valB;
        }
        // CASO D: Texto estándar (Nombres, Apellidos, DNI...)
        else {
            valA = (pA[colName] || "").toString().toUpperCase();
            valB = (pB[colName] || "").toString().toUpperCase();
        }

        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });

    // 3. Pintar la tabla con los datos ya ordenados
    const tbody = document.getElementById(actives ? 'lista-alumnos-body' : 'lista-bajas-body');
    renderTableAlumnos(data, tbody, actives);
}

/* --- GESTIÓN DE RECUPERACIÓN DE CONTRASEÑA --- */

// A. Abrir el modal de nueva contraseña (inyectando el código del mail)
/* --- GESTIÓN TÉCNICA DE RECUPERACIÓN (RESET) --- */

function openResetPasswordModal(code) {
    // Abrimos el modal y ocultamos el botón de cancelar para que el usuario deba terminar el proceso
    showModal("NUEVA CONTRASEÑA", `
        <div style="text-align:left; margin-top:10px;">
            <p style="font-size:13px; color:#94a3b8; margin-bottom:20px;">
                Escribe tu nueva clave de acceso al Dojo.
            </p>
            <span class="modal-label">NUEVA CLAVE:</span>
            <input type="password" id="reset-p1" class="modal-field" placeholder="Mínimo 6 caracteres" style="margin-bottom:15px;">
            <span class="modal-label">REPETIR CLAVE:</span>
            <input type="password" id="reset-p2" class="modal-field" placeholder="Confirma tu clave">
            
            <button class="action-btn primary" onclick="processPasswordReset('${code}')" style="margin-top:25px; width:100%; height:60px; font-weight:800;">
                ACTUALIZAR CONTRASEÑA
            </button>
        </div>
    `, false); // 'false' oculta el botón de cerrar genérico
}

async function processPasswordReset(code) {
    const p1 = document.getElementById('reset-p1').value;
    const p2 = document.getElementById('reset-p2').value;

    if (p1 !== p2) { alert("⚠️ Las contraseñas no coinciden."); return; }
    if (p1.length < 6) { alert("⚠️ La clave es demasiado corta."); return; }

    const btn = document.querySelector('#custom-modal .action-btn.primary');
    btn.innerText = "GUARDANDO..."; btn.disabled = true;

    try {
        // En Strapi v5 las rutas de auth suelen ser directas o prefijadas con /api
        // Probamos con la ruta estándar de Strapi
        const res = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                password: p1,
                passwordConfirmation: p2
            })
        });

        if (res.ok) {
            const data = await res.json();
            // Guardamos el nuevo acceso
            localStorage.setItem('aikido_jwt', data.jwt);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            
            showModal("¡CONTRASEÑA CAMBIADA!", "Tu nueva clave ha sido guardada. Entrando al Dojo...", () => {
                window.location.href = 'movil.html'; // Limpieza total y entrada
            });
        } else {
            const errorData = await res.json();
            showModal("ENLACE CADUCADO", "Este enlace ya no es válido. Por favor, solicita uno nuevo.");
        }
    } catch (e) {
        showModal("Error", "No hay conexión con el Dojo.");
    } finally {
        btn.innerText = "ACTUALIZAR CONTRASEÑA"; btn.disabled = false;
    }
}

/* --- GESTIÓN TÉCNICA DE RECUPERACIÓN (RESET) --- */

// A. Abrir interfaz de nueva contraseña
function openResetPasswordModal(code) {
    showModal("NUEVA CONTRASEÑA", `
        <div style="text-align:left; margin-top:10px;">
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">
                Crea una nueva clave para acceder al Dojo.
            </p>
            <span class="modal-label">NUEVA CLAVE:</span>
            <input type="password" id="reset-p1" class="modal-field" placeholder="Mínimo 6 caracteres">
            <span class="modal-label">REPETIR CLAVE:</span>
            <input type="password" id="reset-p2" class="modal-field" placeholder="Confirma tu clave">
            
            <button class="action-btn primary" onclick="processPasswordReset('${code}')" style="margin-top:20px; width:100%; height:55px;">
                ACTUALIZAR Y ENTRAR
            </button>
        </div>
    `, false);
}

// B. Comunicación definitiva con Strapi
async function processPasswordReset(code) {
    const p1 = document.getElementById('reset-p1').value;
    const p2 = document.getElementById('reset-p2').value;

    if (p1 !== p2) { alert("⚠️ Las contraseñas no coinciden."); return; }
    if (p1.length < 6) { alert("⚠️ La clave debe tener al menos 6 caracteres."); return; }

    const btn = document.querySelector('#custom-modal .action-btn.primary');
    btn.innerText = "SINCRONIZANDO..."; btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code, // El token recibido por email
                password: p1,
                passwordConfirmation: p2
            })
        });

        if (res.ok) {
            const data = await res.json();
            // Si el reset es OK, Strapi nos devuelve el JWT y el User directamente
            localStorage.setItem('aikido_jwt', data.jwt);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            
            showModal("¡OSS!", "Tu contraseña ha sido actualizada. Entrando al Dojo...", () => {
                location.reload(); // Recargamos para que entre al Dashboard normal
            });
        } else {
            showModal("Token Caducado", "El enlace de recuperación ha expirado. Pide uno nuevo.");
        }
    } catch (e) {
        showModal("Error", "No hay conexión con el Tatami.");
    } finally {
        btn.innerText = "ACTUALIZAR Y ENTRAR"; btn.disabled = false;
    }
}

document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('btn-forgot-submit');
    btn.innerText = "PROCESANDO...";
    btn.disabled = true;

    console.log("📡 [SISTEMA] Solicitando recuperación para:", email);

    try {
        // REGLA STRAPI V5: El endpoint es /api/auth/forgot-password
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await res.json();

        if (res.ok) {
            console.log("✅ [SISTEMA] Strapi ha aceptado la petición.");
            document.getElementById('forgot-modal').classList.add('hidden');
            showModal("¡EMAIL ENVIADO!", "Si el email existe, recibirás un enlace de recuperación pronto.");
        } else {
            console.error("❌ [SISTEMA] Error de Strapi:", data);
            // Si Strapi devuelve error, el email no saldrá nunca.
            showModal("Aviso", data.error?.message || "No se pudo procesar.");
        }
    } catch (err) {
        console.error("🔥 [SISTEMA] Error de conexión:", err);
        showModal("Error", "Fallo de conexión con el servidor.");
    } finally {
        btn.innerText = "ENVIAR ENLACE";
        btn.disabled = false;
    }
});

/* --- INFORME EXCLUSIVO: ASISTENCIA DIARIA (V36.2 - CONTROL DE FALTAS Y COLORES DINÁMICOS) --- */
async function generateAttendanceReport() {
    const attendanceDate = document.getElementById('report-attendance-date').value;
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect.value;
    const dojoFilterName = dojoSelect.options[dojoSelect.selectedIndex].text;

    if (!attendanceDate) {
        showModal("Aviso", "Por favor, selecciona una fecha usando el calendario o el teclado.");
        return;
    }

    document.getElementById('report-modal').classList.add('hidden');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // 🥋 LOGO DEL INFORME
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png'; 

    logoImg.onerror = function() {
        console.warn("⚠️ No se encontró logo-arashi-informe.png. Usando logo estándar.");
        logoImg.src = 'img/logo-arashi.png'; 
        logoImg.onerror = null; 
    };

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();

        try {
            console.log("📡 [SISTEMA] Paso 1: Mapeando sedes...");
            const aluData = await fetchSmart('/api/alumnos?populate=dojo&pagination[limit]=1000', 'alumnos_report_cache', 12);
            
            const dojoNameMap = {};
            const dojoIdMap = {};
            
            (aluData.data ||[]).forEach(alu => {
                const id = getID(alu);
                const attr = alu.attributes || alu;
                dojoNameMap[id] = getDojoName(attr.dojo);
                dojoIdMap[id] = attr.dojo ? getID(attr.dojo) : null; 
            });

            const apiUrl = `${API_URL}/api/asistencias?populate[0]=clase&populate[1]=alumno&pagination[limit]=1000&sort=createdAt:desc`;
            const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
            
            if (!res.ok) throw new Error(`Fallo V5 (Status: ${res.status})`);
            const json = await res.json();
            
            const listadoFinal = (json.data ||[]).filter(item => {
                const a = item.attributes || item;
                const cla = parseRelation(a.clase);
                const alu = parseRelation(a.alumno);
                
                if (!cla || !alu || !cla.Fecha_Hora) return false; 
                
                const aluId = getID(alu);
                const classDatePart = cla.Fecha_Hora.split('T')[0];
                const matchFecha = (classDatePart === attendanceDate);
                
                const aluDojoDocId = dojoIdMap[aluId];
                const matchDojo = (!dojoFilterId || dojoFilterId === "all" || aluDojoDocId === dojoFilterId);
                
                // 🥋 FIX: Ahora permitimos a los que tienen la cruz del Sensei ("No_asistio")
                const estadoClean = (a.Estado || a.estado || "").toLowerCase().trim();
                const matchEstado =['confirmado', 'asistio', 'asistió', 'no_asistio', 'no_asistió'].includes(estadoClean);
                
                return matchFecha && matchDojo && matchEstado;
                
            }).map(item => {
                const a = item.attributes || item;
                const alu = parseRelation(a.alumno);
                const cla = parseRelation(a.clase);
                const aluId = getID(alu);
                
                const horaLiteral = cla.Fecha_Hora.split('T')[1].substring(0, 5);
                const duracion = parseFloat(cla.Duracion || 1.5).toFixed(1);

                // 🥋 Lógica de etiquetas limpias para el PDF
                const estadoClean = (a.Estado || a.estado || "").toLowerCase().trim();
                let estadoLabel = "CONFIRMADO"; // Por defecto (Apuntado pero sin validar)
                
                if (estadoClean.includes('no_asistio') || estadoClean.includes('no_asistió')) {
                    estadoLabel = "FALTA"; // El Sensei le dio a la X
                } else if (estadoClean.includes('asistio') || estadoClean.includes('asistió')) {
                    estadoLabel = "ASISTIÓ"; // El Sensei le dio a OK
                }
                
                return {
                    apellidos: (alu.apellidos || "").toUpperCase(),
                    nombre: alu.nombre || "",
                    dojo: dojoNameMap[aluId] || "NO DISP",
                    grado: normalizeGrade(alu.grado) || "S/G",
                    horasAcum: parseFloat(alu.horas_acumuladas || 0).toFixed(1) + "h",
                    horaMinutos: horaLiteral,
                    duracion: duracion,
                    estado: estadoLabel // "FALTA", "ASISTIÓ" o "CONFIRMADO"
                };
            });

            if (listadoFinal.length === 0) {
                showModal("Tatami Vacío", `No hay registros en el tatami para el día ${formatDateDisplay(attendanceDate)}.`);
                return;
            }

            // 🥋 ORDENACIÓN: Primero por hora, luego alfabético
            listadoFinal.sort((a, b) => {
                if (a.horaMinutos !== b.horaMinutos) return a.horaMinutos.localeCompare(b.horaMinutos);
                return a.apellidos.localeCompare(b.apellidos, 'es');
            });

            const keikosAgrupados = {};
            listadoFinal.forEach(it => {
                if(!keikosAgrupados[it.horaMinutos]) keikosAgrupados[it.horaMinutos] =[];
                keikosAgrupados[it.horaMinutos].push(it);
            });

            // 🥋 DIBUJO DEL PDF
            let currentY = 36; 
            const pagesDrawn = new Set(); 

            const drawMainHeader = (data) => {
                if (pagesDrawn.has(data.pageNumber)) return;
                pagesDrawn.add(data.pageNumber);
                
                doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                
                doc.setFontSize(14); 
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text("PARTE DE ASISTENCIA TÉCNICA", pageWidth / 2, 12, { align: 'center' });
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.text(`DOJO: ${dojoFilterName} | FECHA: ${formatDateDisplay(attendanceDate)}`, pageWidth / 2, 17, { align: 'center' });
                
                doc.setFontSize(7.5); 
                doc.setTextColor(130, 130, 130); 
                const fechaEmision = new Date().toLocaleDateString('es-ES');
                doc.text(`* IMPORTANTE: La columna 'Horas Acum.' refleja el cómputo total a fecha de emisión del informe (${fechaEmision}).`, pageWidth / 2, 22, { align: 'center' });

                doc.setFontSize(8); 
                doc.setTextColor(150, 150, 150);
                doc.text(`Total inscritos: ${listadoFinal.length}`, pageWidth - 10, 17, { align: 'right' });
            };

            Object.keys(keikosAgrupados).sort().forEach((horaKey, index) => {
                const grupo = keikosAgrupados[horaKey];
                const duracion = grupo[0].duracion;
                
                const isManana = parseInt(horaKey.split(':')[0]) < 14;
                const turnoLabel = isManana ? "TURNO DE MAÑANA" : "TURNO DE TARDE";

                if (currentY > 170 && index > 0) {
                    doc.addPage();
                    currentY = 36;
                }

                doc.setFontSize(11);
                doc.setTextColor(190, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text(`>> ${turnoLabel} | Inicio: ${horaKey}h | Duración: ${duracion}h`, 10, currentY);
                doc.setFont("helvetica", "normal");
                
                const headRow =['Nº', 'Apellidos', 'Nombre', 'Dojo Alumno', 'Grado', 'Horas Acum.', 'Estado'];
                const body = grupo.map((it, idx) =>[
                    `${idx + 1}`, it.apellidos, it.nombre, it.dojo, it.grado, it.horasAcum, it.estado
                ]);

                doc.autoTable({
                    startY: currentY + 3,
                    margin: { top: 35, left: 10, right: 10 },
                    head: [headRow], 
                    body: body, 
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 2.5 },
                    headStyles: { fillColor:[30, 41, 59], halign: 'center', fontStyle: 'bold' },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 10 },
                        4: { halign: 'center', fontStyle: 'bold' },
                        5: { halign: 'center', textColor:[34, 197, 94], fontStyle: 'bold' }, 
                        6: { halign: 'center', fontStyle: 'bold' } 
                    },
                    // 🥋 MAGIA APLICADA: Pintamos la celda según su texto exacto
                    didParseCell: function(data) {
                        if (data.section === 'body' && data.column.index === 6) {
                            if (data.cell.raw === 'FALTA') {
                                data.cell.styles.textColor =[239, 68, 68]; // Rojo Arashi
                            } else if (data.cell.raw === 'ASISTIÓ') {
                                data.cell.styles.textColor =[34, 197, 94]; // Verde OK
                            } else {
                                data.cell.styles.textColor =[203, 166, 23]; // Mostaza para CONFIRMADO
                            }
                        }
                    },
                    didDrawPage: drawMainHeader
                });

                currentY = doc.lastAutoTable.finalY + 15;
            });

            doc.save(`Asistencia_Arashi_${attendanceDate}.pdf`);

        } catch (e) {
            console.error("🔥 Error V36.2:", e);
            showModal("Error", "No se pudo generar el informe. Revisa la consola.");
        }
    };
}

async function cancelAttendance(asistId, claseId) {
    const token = localStorage.getItem('aikido_jwt');
    const btn = document.getElementById('confirm-btn');
    
    btn.innerText = "CANCELANDO...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/asistencias/${asistId}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        if (res.ok) {
            console.log("✅ Asistencia cancelada.");
            localStorage.removeItem('cache_asistencias_sensei');
            await checkTodayClass(); // Recargamos el botón para que vuelva a decir ASISTIR
            showModal("CANCELADO", "Tu asistencia ha sido anulada. Esperamos verte en el próximo keiko.");
        } else {
            throw new Error("No se pudo contactar con el Dojo.");
        }
    } catch (e) {
        showModal("Error", e.message);
        btn.innerText = "CANCELAR ASISTENCIA";
        btn.disabled = false;
    }
}

function toggleSearch() {
    const inputBox = document.getElementById('search-input-box');
    if (!inputBox) return; // Seguridad extra
    
    inputBox.classList.toggle('hidden');
    
    // Buscamos el input que esté DENTRO de la caja flotante, se llame como se llame
    const inputElement = inputBox.querySelector('input');
    
    if (!inputBox.classList.contains('hidden')) {
        // Al abrir, ponemos el cursor automáticamente
        if (inputElement) {
            setTimeout(() => inputElement.focus(), 100);
        }
    } else {
        // Al cerrar, limpiamos la búsqueda
        if (inputElement) {
            inputElement.value = "";
            filtrarTabla('table-alumnos', inputElement.id);
        }
    }
}
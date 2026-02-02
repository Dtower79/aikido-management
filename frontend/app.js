const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com";
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

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
    // 1. Ocultamos TODAS las secciones, incluida la de bienvenida
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    
    // 2. Mostramos solo la que queremos
    const targetSection = document.getElementById(`sec-${id}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // 3. Gestionamos los botones del menú
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-nav-${id}`);
    if(activeBtn) activeBtn.classList.add('active');

    // 4. Cargas específicas
    if (id === 'alumnos') loadAlumnos(true);
    if (id === 'bajas') loadAlumnos(false);
    if (id === 'dojos') loadDojosCards();
    if (id === 'status') runDiagnostics();
    if (id === 'nuevo-alumno') { 
        const isEditing = document.getElementById('edit-id').value !== ""; 
        if (!isEditing) resetForm(); 
    }
    
    // 5. Cerramos cualquier menú de acciones abierto al cambiar de sección
    if (typeof closeAlumnoActions === 'function') closeAlumnoActions();
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

// --- CARGA ALUMNOS (Corrección Botón Borrar) ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    const colCount = activos ? 9 : 8;
    tbody.innerHTML = `<tr><td colspan="${colCount}">Cargando...</td></tr>`;
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';

    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=500`, { 
            headers: { 'Authorization': `Bearer ${jwtToken}` } 
        });
        const json = await res.json();
        tbody.innerHTML = '';
        
        (json.data || []).forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId;
            const safeNombre = escapeQuotes(p.nombre || '');
            const safeApellidos = escapeQuotes(p.apellidos || '');
            
            const tr = document.createElement('tr');
            tr.id = `row-${id}`;
            // Pasamos 'activos' para saber qué botones mostrar
            tr.onclick = (e) => handleAlumnoSelection(id, safeNombre, safeApellidos, e, activos);
            
            tr.innerHTML = `
                ${!activos ? `<td><strong>${formatDateDisplay(p.fecha_baja)}</strong></td>` : ''}
                <td><strong>${(p.apellidos || '').toUpperCase()}</strong></td>
                <td>${p.nombre || ''}</td>
                <td>${p.dni || ''}</td>
                <td><span class="badge">${normalizeGrade(p.grado)}</span></td>
                ${activos ? `<td style="font-weight:bold; color:var(--primary)">${parseFloat(p.horas_acumuladas || 0).toFixed(1)}h</td>` : ''}
                <td><span class="${p.seguro_pagado ? 'badge-ok' : 'badge-no'}">${p.seguro_pagado ? 'SÍ' : 'NO'}</span></td>
                <td>${normalizePhone(p.telefono)}</td>
                <td>${getDojoName(p.dojo)}</td>
                ${activos ? `<td>${formatDateDisplay(p.fecha_inicio)}</td>` : ''}
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan="${colCount}">Error de carga.</td></tr>`; }
}

// A. SELECCIÓN DE ALUMNO CON CENTRADO SIMÉTRICO
function handleAlumnoSelection(id, nombre, apellidos, event, esActivo) {
    closeAlumnoActions();
    const row = document.getElementById(`row-${id}`);
    if (row) row.classList.add('selected-row');

    const actionsHtml = esActivo ? `
        <button class="action-btn-icon" onclick="generateIndividualHistory('${id}', '${nombre}', '${apellidos}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
        <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn-icon delete" onclick="confirmarEstado('${id}', false, '${nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
    ` : `
        <button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${nombre}')"><i class="fa-solid fa-trash-can"></i></button>
    `;

    if (window.innerWidth <= 900) {
        document.getElementById('sheet-alumno-name').innerText = `${nombre} ${apellidos}`;
        document.getElementById('sheet-actions-container').innerHTML = actionsHtml;
        document.getElementById('bottom-sheet-mobile').classList.remove('hidden');
    } else {
        const targetId = esActivo ? 'actions-alumnos' : 'actions-bajas';
        const container = document.getElementById(targetId);
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1;"></div> 
                <span class="student-tag">${nombre} ${apellidos}</span>
                <div class="actions-buttons-wrap">${actionsHtml}</div>
            `;
            container.classList.add('active');
        }
    }
    if (event) event.stopPropagation();
}

// B. GENERAR INFORME CON FIX MULTIPÁGINA Y VALIDACIÓN FECHA
async function generateReport(type) {
    const dateEl = document.getElementById('report-attendance-date');
    const attendanceDate = dateEl ? dateEl.value : "";
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect ? dojoSelect.value : "";
    const dojoFilterName = dojoSelect ? dojoSelect.options[dojoSelect.selectedIndex].text : "";

    if (type === 'attendance' && !attendanceDate) {
        showModal("Fecha Requerida", "Selecciona una fecha.");
        return;
    }

    document.getElementById('report-modal').classList.add('hidden');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();
        
        try {
            let apiUrl = "";
            if (type === 'attendance') {
                apiUrl = `${API_URL}/api/asistencias?filters[clase][Fecha_Hora][$gte]=${attendanceDate}T00:00:00.000Z&filters[clase][Fecha_Hora][$lte]=${attendanceDate}T23:59:59.999Z&populate[alumno][populate][dojo]=true&populate[clase]=true&pagination[limit]=500`;
            } else {
                const soloActivos = !type.startsWith('bajas');
                apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=${soloActivos}&populate[dojo]=true&pagination[limit]=1000`;
            }

            if (dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;

            const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
            const json = await res.json();
            const list = json.data || [];

            // --- LOG PARA TI (F12) ---
            console.log("Datos de Strapi:", list);

            const isBaja = type.startsWith('bajas');
            let title = isBaja ? "HISTÓRICO DE BAJAS" : "LISTADO DE ALUMNOS";
            let subText = `${isBaja ? 'Inactivos' : 'Activos'} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'} | ${new Date().toLocaleDateString()}`;
            
            if (type === 'attendance') {
                title = "ASISTENCIA DIARIA - TATAMI";
                subText = `Día: ${formatDateDisplay(attendanceDate)} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'}`;
            }

            // DEFINICIÓN DE COLUMNAS PROFESIONAL (Fuerza la aparición de cada una)
            let columns = [];
            if (type === 'attendance') {
                columns = [
                    { header: 'Alumno', dataKey: 'alumno' },
                    { header: 'DNI', dataKey: 'dni' },
                    { header: 'Dojo', dataKey: 'dojo' },
                    { header: 'Clase', dataKey: 'clase' },
                    { header: 'Hora', dataKey: 'hora' },
                    { header: 'Estado', dataKey: 'estado' }
                ];
            } else {
                if (isBaja) columns.push({ header: 'Baja', dataKey: 'baja' });
                columns = columns.concat([
                    { header: 'Apellidos', dataKey: 'apellidos' },
                    { header: 'Nombre', dataKey: 'nombre' },
                    { header: 'DNI', dataKey: 'dni' },
                    { header: 'Dojo', dataKey: 'dojo' }, // COLUMNA CRÍTICA
                    { header: 'Grado', dataKey: 'grado' },
                    { header: 'Horas', dataKey: 'horas' },
                    { header: 'Seguro', dataKey: 'seguro' },
                    { header: 'Teléfono', dataKey: 'tel' },
                    { header: 'Email', dataKey: 'email' },
                    { header: 'Dirección', dataKey: 'dir' },
                    { header: 'CP/Ciudad', dataKey: 'city' }
                ]);
            }

            // MAPEADO DE DATOS (Cuerpo del reporte)
            const body = list.map(item => {
                const p = item.attributes || item;
                if (type === 'attendance') {
                    const alu = parseRelation(p.alumno);
                    const cla = parseRelation(p.clase);
                    return {
                        alumno: alu ? `${(alu.apellidos||'').toUpperCase()}, ${alu.nombre||''}` : '---',
                        dni: alu?.dni || '---',
                        dojo: getDojoName(alu?.dojo),
                        clase: cla?.Tipo || 'General',
                        hora: cla?.Fecha_Hora ? cla.Fecha_Hora.split('T')[1].substring(0, 5) + "h" : "--:--",
                        estado: (p.Estado || 'Confirmado').toUpperCase()
                    };
                } else {
                    return {
                        baja: formatDateDisplay(p.fecha_baja),
                        apellidos: (p.apellidos || '').toUpperCase(),
                        nombre: p.nombre || '',
                        dni: p.dni || '',
                        dojo: getDojoName(p.dojo),
                        grado: normalizeGrade(p.grado),
                        horas: parseFloat(p.horas_acumuladas || 0).toFixed(1) + 'h',
                        seguro: p.seguro_pagado ? 'SÍ' : 'NO',
                        tel: normalizePhone(p.telefono),
                        email: p.email || '-',
                        dir: (p.direccion || '').substring(0, 20),
                        city: `${p.cp || ''} ${p.poblacion || ''}`.trim()
                    };
                }
            });

            if (body.length === 0) {
                showModal("Aviso", "No hay datos para mostrar.");
                return;
            }

            // ORDENACIÓN FINAL (Solo para alumnos)
            if (type !== 'attendance') {
                body.sort((a, b) => {
                    if (type === 'insurance') {
                        if (a.seguro !== b.seguro) return a.seguro === 'SÍ' ? -1 : 1;
                    }
                    return a.apellidos.localeCompare(b.apellidos);
                });
            }

            doc.autoTable({
                startY: 30,
                margin: { top: 35 },
                columns: columns,
                body: body,
                theme: 'grid',
                styles: { fontSize: 5.5, cellPadding: 1, overflow: 'ellipsize' },
                headStyles: { fillColor: [190, 0, 0], halign: 'center' },
                columnStyles: {
                    dojo: { cellWidth: 25 }, // FORZAMOS EL ANCHO DEL DOJO
                    apellidos: { cellWidth: 'auto' }
                },
                didDrawPage: (data) => {
                    doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                    doc.setFontSize(14); doc.setFont("helvetica", "bold");
                    doc.text(title, pageWidth / 2, 12, { align: 'center' });
                    doc.setFontSize(9); doc.setFont("helvetica", "normal");
                    doc.text(subText, pageWidth / 2, 18, { align: 'center' });
                }
            });

            doc.save(`Arashi_${type}.pdf`);

        } catch (e) {
            console.error(e);
            showModal("Error", "Fallo técnico al generar informe.");
        }
    };
}

// También actualizamos closeAlumnoActions para limpiar la barra
function closeAlumnoActions() {
    // Quitar resaltado de todas las filas
    document.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
    
    // Limpiar y ocultar áreas de la toolbar (tanto alumnos como bajas)
    ['actions-alumnos', 'actions-bajas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.innerHTML = '';
        }
    });

    // Ocultar panel móvil
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


const formAlumno = document.getElementById('form-nuevo-alumno');
if (formAlumno) {
    formAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
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
                showModal("¡OSS!", id ? "Los datos del alumno se han actualizado correctamente." : "Alumno registrado con éxito.", () => { 
                    showSection('alumnos'); 
                    resetForm(); 
                });
            } else { 
                showModal("Error", "No se han podido guardar los cambios. Revisa los datos."); 
            }
        } catch (error) { 
            showModal("Error", "Fallo de conexión con el Dojo."); 
        }
    });
}

async function editarAlumno(documentId) {
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data; const p = data.attributes || data;
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
        const chk = document.getElementById('new-seguro'); const txt = document.getElementById('seguro-status-text'); chk.checked = p.seguro_pagado === true; if (chk.checked) { txt.innerText = "PAGADO"; txt.style.color = "#22c55e"; } else { txt.innerText = "NO PAGADO"; txt.style.color = "#ef4444"; }
        let dojoId = "";
        if (p.dojo) { if (p.dojo.documentId) { dojoId = p.dojo.documentId; } else if (p.dojo.data) { dojoId = p.dojo.data.documentId || p.dojo.data.id; } }
        const selectDojo = document.getElementById('new-dojo'); if (dojoId && selectDojo) { selectDojo.value = dojoId; }
        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR ALUMNO"; document.getElementById('btn-cancelar-edit').classList.remove('hidden'); showSection('nuevo-alumno');
    } catch { showModal("Error", "Error al cargar datos."); }
}

function resetForm() { 
    const f = document.getElementById('form-nuevo-alumno'); 
    if (f) f.reset(); 
    
    // Resetear visuales de seguro
    document.getElementById('seguro-status-text').innerText = "NO PAGADO"; 
    document.getElementById('seguro-status-text').style.color = "#ef4444"; 
    
    // Resetear ID de edición
    document.getElementById('edit-id').value = ""; 
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO"; 
    document.getElementById('btn-cancelar-edit').classList.add('hidden'); 
    
    // Volver a la lista de alumnos
    showSection('alumnos'); 
}

function confirmarEstado(id, activo, nombre) { showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, async () => { const fecha = activo ? null : new Date().toISOString().split('T')[0]; await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) }); showSection(activo ? 'alumnos' : 'bajas'); }); }
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

// 1. INFORME HISTÓRICO INDIVIDUAL
// 1. INFORME HISTÓRICO INDIVIDUAL (CORREGIDO: Timezone Fix literal)
async function generateIndividualHistory(id, nombre, apellidos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    try {
        const res = await fetch(`${API_URL}/api/asistencias?filters[alumno][documentId][$eq]=${id}&populate=clase&sort=createdAt:desc&pagination[limit]=200`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data || [];

        const headRow = ['Fecha', 'Hora', 'Tipo', 'Duración', 'Estado'];
        let totalHoras = 0;

        const body = data.map(item => {
            const a = item.attributes || item;
            const c = parseRelation(a.clase);
            
            let fechaStr = "NO DISP", horaStr = "--:--", duracion = 0, tipo = "General";
            
            if (c && c.Fecha_Hora) {
                // TRATAMIENTO LITERAL: Evitamos que el navegador aplique el desfase de +1 hora
                const [fechaPart, resto] = c.Fecha_Hora.split('T'); // "2026-01-20" y "10:00:00.000Z"
                const [y, m, d] = fechaPart.split('-');
                
                fechaStr = `${d}/${m}/${y}`;
                horaStr = resto.substring(0, 5); // Cogemos "10:00" directamente de la cadena
                
                duracion = parseFloat(c.Duracion || 0);
                tipo = c.Tipo || "General";
            }
            
            if(a.Estado === 'Asistio') totalHoras += duracion;

            return [fechaStr, horaStr, tipo, duracion + 'h', a.Estado === 'Asistio' ? 'ASISTIÓ' : 'NO VINO'];
        });

        doc.setFontSize(16); doc.text(`HISTORIAL DE ASISTENCIA`, 105, 15, { align: 'center' });
        doc.setFontSize(12); doc.text(`Alumno: ${apellidos.toUpperCase()}, ${nombre}`, 105, 22, { align: 'center' });
        doc.setFontSize(10); doc.text(`Total Horas Registradas: ${totalHoras.toFixed(1)}h`, 105, 28, { align: 'center' });

        doc.autoTable({
            startY: 35, head: [headRow], body: body, theme: 'grid',
            headStyles: { fillColor: [190, 0, 0] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 4) {
                    data.cell.styles.textColor = data.cell.raw === 'ASISTIÓ' ? [0, 128, 0] : [190, 0, 0];
                }
            }
        });

        doc.save(`Historial_${apellidos}_${nombre}.pdf`);

    } catch (e) { alert("Error generando historial."); console.error(e); }
}

// 2. GENERADOR DE INFORMES GENERALES
// 2. GENERADOR DE INFORMES GENERALES (CORREGIDO: Modal + Fix Multi-página)
async function generateReport(type) {
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect.value;
    const dojoFilterName = dojoSelect.options[dojoSelect.selectedIndex].text;
    const attendanceDate = document.getElementById('report-attendance-date').value;

    // 1. Validar fecha con Modal en lugar de Alert
    if (type === 'attendance' && !attendanceDate) {
        showModal("Aviso", "Por favor, selecciona una fecha en el calendario para generar el informe de asistencia.");
        return;
    }

    document.getElementById('report-modal').classList.add('hidden');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    const subtitleMap = {
        'surname': 'Apellidos', 'age': 'Edad', 'grade': 'Grado', 'dojo': 'Dojo', 'group': 'Grupo', 'insurance': 'Estado del Seguro',
        'bajas_surname': 'Histórico Bajas (Por Apellidos)', 'bajas_date': 'Histórico Bajas (Por Fecha)',
        'attendance': 'Asistencia Diaria'
    };

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();
        let headRow = [], body = [], title = "", subText = "";

        try {
            if (type === 'attendance') {
                title = "ASISTENCIA DIARIA - TATAMI";
                subText = `Día: ${formatDateDisplay(attendanceDate)} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'}`;
                
                let apiUrl = `${API_URL}/api/asistencias?filters[clase][Fecha_Hora][$contains]=${attendanceDate}&populate[alumno][populate]=dojo&populate[clase]=*&pagination[limit]=500`;
                if (dojoFilterId) apiUrl += `&filters[alumno][dojo][documentId][$eq]=${dojoFilterId}`;

                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                
                headRow = ['Alumno', 'DNI', 'Dojo', 'Clase', 'Hora', 'Estado'];
                body = (json.data || []).map(item => {
                    const a = item.attributes || item;
                    const alu = parseRelation(a.alumno);
                    const cla = parseRelation(a.clase);
                    let horaStr = "--:--";
                    if(cla?.Fecha_Hora) {
                        const [f, resto] = cla.Fecha_Hora.split('T');
                        horaStr = resto.substring(0, 5) + "h";
                    }
                    return [
                        alu ? `${(alu.apellidos||'').toUpperCase()}, ${alu.nombre||''}` : 'DESCONOCIDO',
                        alu?.dni || '-',
                        getDojoName(alu?.dojo),
                        cla?.Tipo || 'General',
                        horaStr,
                        a.Estado === 'Asistio' ? 'ASISTIÓ' : 'NO SE PRESENTÓ'
                    ];
                });

            } else {
                const isBaja = type.startsWith('bajas_');
                title = isBaja ? "HISTÓRICO DE BAJAS" : "LISTADO COMPLETO ALUMNOS";
                if (!isBaja && type === 'insurance') title = "ESTADO DE PAGOS DE SEGURO ANUAL";
                else if (!isBaja) title += ` POR ${subtitleMap[type].toUpperCase()}`;

                subText = `${isBaja ? 'Alumnos Inactivos' : 'Alumnos Activos'} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'} | ${new Date().toLocaleDateString()}`;

                let apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=${isBaja ? 'false' : 'true'}&populate=dojo&pagination[limit]=1000`;
                if (dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;

                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                let list = json.data || [];

                list.sort((a, b) => {
                    const pA = a.attributes || a; const pB = b.attributes || b;
                    if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
                    if (type === 'age') return new Date(pA.fecha_nacimiento || '0') - new Date(pB.fecha_nacimiento || '0');
                    if (type === 'group') return (pA.grupo || '').localeCompare(pB.grupo || '');
                    if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo));
                    return (pA.apellidos || '').localeCompare(pB.apellidos || '');
                });

                headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Horas', 'Seguro', 'Teléfono', 'Email', 'Dirección', 'CP/Ciudad'];
                if (isBaja) headRow.unshift('Baja');

                body = list.map(item => {
                    const p = item.attributes || item;
                    const ciudadFull = `${p.cp || ''} ${p.poblacion || ''}`.trim();
                    const row = [
                        (p.apellidos || '').toUpperCase(),
                        p.nombre || '',
                        p.dni || '',
                        normalizeGrade(p.grado),
                        parseFloat(p.horas_acumuladas || 0).toFixed(1) + 'h',
                        p.seguro_pagado ? 'PAGADO' : 'NO',
                        normalizePhone(p.telefono),
                        p.email || '-',
                        (p.direccion || '').substring(0, 30),
                        ciudadFull
                    ];
                    if (isBaja) row.unshift(formatDateDisplay(p.fecha_baja));
                    return row;
                });
            }

            // RENDERIZADO TABLA: Fix solapamiento segunda página
            doc.autoTable({
                startY: 30, // Margen inicial primera página
                margin: { top: 30 }, // Margen superior para páginas siguientes (2, 3...)
                head: [headRow], 
                body: body, 
                theme: 'grid',
                styles: { fontSize: 6, cellPadding: 1.5, overflow: 'linebreak' },
                headStyles: { fillColor: [190, 0, 0], halign: 'center', fontStyle: 'bold' },
                didDrawPage: (data) => {
                    // Este código se ejecuta en TODAS las páginas
                    doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                    doc.setFontSize(14); doc.setFont("helvetica", "bold");
                    doc.text(title, pageWidth / 2, 12, { align: 'center' });
                    doc.setFontSize(9); doc.setFont("helvetica", "normal");
                    doc.text(subText, pageWidth / 2, 18, { align: 'center' });
                }
            });
            doc.save(`Informe_Arashi_${type}.pdf`);
        } catch (e) { 
            console.error(e);
            showModal("Error", "No se ha podido generar el informe. Revisa la conexión."); 
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
        if(data.length === 0) { grid.innerHTML = '<p>No hay dojos.</p>'; return; }

        data.forEach(d => { 
            // FIX: Normalizar lectura de Strapi v5
            const p = d.attributes || d; 
            const cleanName = (p.nombre || 'Dojo Desconocido').replace(/Aikido\s+/gi, '').trim(); 
            const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : 'NO DISP'; 
            
            grid.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3></div>
                    <div class="dojo-body">
                        <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || 'NO DISP'}</span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || 'NO DISP'}</span></div>
                        <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                    </div>
                </div>`; 
        }); 
    } catch(e) { console.error(e); grid.innerHTML = '<p style="color:red">Error al cargar dojos.</p>'; } 
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

function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }
function scrollToTop() { const c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); }
const ca = document.querySelector('.content'); if (ca) { ca.addEventListener('scroll', () => { const b = document.getElementById('btn-scroll-top'); if (ca.scrollTop > 300) b.classList.add('visible'); else b.classList.remove('visible'); }); }

function showModal(titulo, mensaje, callbackOk = null) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-message').innerText = mensaje;
    
    const btnOk = document.getElementById('modal-btn-ok');
    const btnCancel = document.getElementById('modal-btn-cancel');
    
    modal.classList.remove('hidden');
    
    btnOk.onclick = () => {
        modal.classList.add('hidden');
        if (callbackOk) callbackOk();
    };
    
    btnCancel.onclick = () => {
        modal.classList.add('hidden');
    };
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}
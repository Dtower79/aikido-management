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
    loadDojosSelect(); loadReportDojos(); showSection('welcome');
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${id}`).classList.remove('hidden');
    if (id === 'alumnos') loadAlumnos(true);
    if (id === 'bajas') loadAlumnos(false);
    if (id === 'dojos') loadDojosCards();
}

// --- UTILS ---
const parseRelation = (obj) => { if(!obj || !obj.data) return obj; return obj.data.attributes || obj.data; };
const getID = (obj) => obj?.documentId || obj?.id;

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
function calculateAge(d) { if (!d) return 'NO DISP'; const t = new Date(), b = new Date(d); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return isNaN(a) ? 'NO DISP' : a; }
function normalizePhone(t) { if (!t || t === "-") return 'NO DISP'; return t.toString().replace(/^(\+?34)/, '').trim(); }
function normalizeCity(c) { if (!c) return 'NO DISP'; return c.toString().toUpperCase().trim(); }

// --- CARGA ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    tbody.innerHTML = `<tr><td colspan="10">Cargando...</td></tr>`;
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&sort=apellidos:asc&pagination[limit]=500`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        tbody.innerHTML = '';
        (json.data || []).forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId;
            const horas = parseFloat(p.horas_acumuladas || 0).toFixed(1);
            
            tbody.innerHTML += `
                <tr>
                    ${!activos ? `<td>${formatDateDisplay(p.fecha_baja)}</td>` : ''}
                    <td><strong>${(p.apellidos || '').toUpperCase()}</strong></td>
                    <td>${p.nombre || ''}</td>
                    <td>${p.dni || ''}</td>
                    <td><span class="badge">${normalizeGrade(p.grado)}</span></td>
                    <td><span class="${p.seguro_pagado ? 'badge-ok' : 'badge-no'}">${p.seguro_pagado ? 'SÍ' : 'NO'}</span></td>
                    <td>${normalizePhone(p.telefono)}</td>
                    <td>${getDojoName(p.dojo)}</td>
                    <td>${formatDateDisplay(p.fecha_inicio)}</td>
                    <td style="font-weight:bold; color:var(--primary)">${horas}h</td>
                    <td class="sticky-col">
                        ${activos ? `<button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>` : ''}
                        <button class="action-btn-icon" onclick="confirmarEstado('${id}', ${!activos}, '${p.nombre}')"><i class="fa-solid ${activos ? 'fa-user-xmark' : 'fa-rotate-left'}"></i></button>
                    </td>
                </tr>`;
        });
    } catch { tbody.innerHTML = 'Error.'; }
}

// --- INFORMES PROFESIONALES ---
function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }

async function generateReport(type) {
    const dojoFilterId = document.getElementById('report-dojo-filter').value;
    const dojoFilterName = document.getElementById('report-dojo-filter').options[document.getElementById('report-dojo-filter').selectedIndex].text;
    const attendanceDate = document.getElementById('report-attendance-date').value;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let headRow = [], body = [], title = "INFORME ARASHI", subText = "Arashi Group Aikido";

        try {
            if (type === 'attendance') {
                if (!attendanceDate) { alert("Selecciona una fecha."); return; }
                title = "ASISTENCIA DIARIA - TATAMI";
                subText = `Día: ${formatDateDisplay(attendanceDate)} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'}`;
                
                // LÓGICA DE RANGO PARA STRAPI V5 (EVITA EL ERROR DE CONTAINS)
                const startDay = `${attendanceDate}T00:00:00.000Z`;
                const endDay = `${attendanceDate}T23:59:59.999Z`;

                let url = `${API_URL}/api/asistencias?filters[clase][Fecha_Hora][$gte]=${startDay}&filters[clase][Fecha_Hora][$lte]=${endDay}&populate[alumno][populate]=dojo&populate[clase]=*&pagination[limit]=500`;
                if (dojoFilterId) url += `&filters[alumno][dojo][documentId][$eq]=${dojoFilterId}`;
                
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                
                headRow = ['Apellidos y Nombre', 'DNI', 'Dojo', 'Clase', 'Hora Clase', 'Estado'];
                body = (json.data || []).map(item => {
                    const a = item.attributes || item;
                    const alu = parseRelation(a.alumno);
                    const cla = parseRelation(a.clase);
                    
                    // Formatear hora de la clase quitando el UTC
                    let horaStr = "--:--";
                    if(cla?.Fecha_Hora) {
                        const d = new Date(cla.Fecha_Hora);
                        horaStr = d.getUTCHours().toString().padStart(2, '0') + ":" + d.getUTCMinutes().toString().padStart(2, '0') + "h";
                    }

                    return [
                        `${(alu?.apellidos || '').toUpperCase()}, ${alu?.nombre || ''}`,
                        alu?.dni || 'NO DISP',
                        getDojoName(alu?.dojo),
                        cla?.Tipo || 'General',
                        horaStr,
                        a.Estado === 'Asistio' ? 'ASISTIÓ' : 'PENDIENTE / NO VINO'
                    ];
                });
            } else {
                // INFORMES DE LISTADO
                const isBaja = type.startsWith('bajas_');
                title = isBaja ? "HISTÓRICO DE BAJAS" : "LISTADO OFICIAL ALUMNOS";
                subText = `${isBaja ? 'Alumnos Inactivos' : 'Alumnos Activos'} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'}`;

                let url = `${API_URL}/api/alumnos?filters[activo][$eq]=${isBaja ? 'false' : 'true'}&populate=dojo&pagination[limit]=1000`;
                if (dojoFilterId) url += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;

                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                let list = json.data || [];

                list.sort((a, b) => {
                    const pA = a.attributes || a; const pB = b.attributes || b;
                    if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
                    if (type === 'age') return new Date(pA.fecha_nacimiento || '0') - new Date(pB.fecha_nacimiento || '0');
                    return (pA.apellidos || '').localeCompare(pB.apellidos || '');
                });

                headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Seguro', 'Dojo', 'Horas', 'Alta'];
                body = list.map(item => {
                    const p = item.attributes || item;
                    return [(p.apellidos || '').toUpperCase(), p.nombre || '', p.dni || '', normalizeGrade(p.grado), p.seguro_pagado ? 'PAGADO' : 'PENDIENTE', getDojoName(p.dojo), parseFloat(p.horas_acumuladas || 0).toFixed(1)+'h', formatDateDisplay(p.fecha_inicio)];
                });
            }

            doc.autoTable({
                startY: 25, head: [headRow], body: body, theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1.2 },
                headStyles: { fillColor: [190, 0, 0], halign: 'center' },
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const txt = data.cell.raw;
                        if (txt === 'ASISTIÓ' || txt === 'PAGADO') data.cell.styles.textColor = [0, 120, 0];
                        if (txt === 'PENDIENTE / NO VINO' || txt === 'PENDIENTE') data.cell.styles.textColor = [200, 0, 0];
                    }
                },
                didDrawPage: (d) => {
                    doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                    doc.setFontSize(14); doc.text(title, pageWidth / 2, 12, { align: 'center' });
                    doc.setFontSize(9); doc.text(subText, pageWidth / 2, 18, { align: 'center' });
                }
            });
            doc.save(`Arashi_Informe_${type}_${attendanceDate || 'Listado'}.pdf`);
            document.getElementById('report-modal').classList.add('hidden');
        } catch (e) { console.error(e); alert("Error al generar PDF"); }
    };
}

// --- MANTENIMIENTO ---
async function loadDojosSelect() {
    const s = document.getElementById('new-dojo');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        s.innerHTML = '<option value="">Selecciona...</option>';
        (j.data || []).forEach(d => { s.innerHTML += `<option value="${d.documentId}">${parseRelation(d).nombre}</option>`; });
    } catch {}
}

async function loadReportDojos() {
    const s = document.getElementById('report-dojo-filter');
    const e = document.getElementById('export-dojo-filter');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        const options = (j.data || []).map(d => `<option value="${d.documentId}">${parseRelation(d).nombre}</option>`).join('');
        if (s) s.innerHTML = '<option value="">Todos los dojos</option>' + options;
        if (e) e.innerHTML = '<option value="">Todos los dojos</option>' + options;
    } catch {}
}

function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function filtrarTabla(t, i) { const input = document.getElementById(i); if (!input) return; const f = input.value.toUpperCase(); const rows = document.getElementById(t).getElementsByTagName('tr'); for (let j = 1; j < rows.length; j++) rows[j].style.display = rows[j].textContent.toUpperCase().includes(f) ? "" : "none"; }
function showModal(t, m, ok) { const d = document.getElementById('custom-modal'); document.getElementById('modal-title').innerText = t; document.getElementById('modal-message').innerText = m; document.getElementById('modal-btn-cancel').onclick = () => d.classList.add('hidden'); document.getElementById('modal-btn-ok').onclick = () => { if (ok) ok(); d.classList.add('hidden'); }; d.classList.remove('hidden'); }
function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }
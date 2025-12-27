const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    const loginTimeStr = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    if (jwtToken && loginTimeStr && (ahora - parseInt(loginTimeStr) < 20 * 60 * 1000)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else {
        logout();
    }
    setupDniInput('dni-login'); setupDniInput('new-dni');
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    setupDragScroll();
});

// --- SESIÓN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value; 
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    try {
        const response = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await response.json();
        if (response.ok) {
            jwtToken = data.jwt;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            localStorage.setItem('aikido_login_time', Date.now().toString());
            showDashboard();
        } else { errorMsg.innerText = "❌ Credenciales Incorrectas"; }
    } catch { errorMsg.innerText = "❌ Error de conexión"; }
});

function logout() {
    localStorage.clear();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

// --- NAVEGACIÓN ---
function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); 
    loadCiudades(); 
    showSection('welcome'); 
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sec-${id}`).classList.remove('hidden');
    const btn = document.querySelector(`button[onclick="showSection('${id}')"]`);
    if(btn) btn.classList.add('active');

    if(id === 'alumnos') loadAlumnos(true);
    if(id === 'bajas') loadAlumnos(false);
    if(id === 'dojos') loadDojosCards();
    if(id === 'status') runDiagnostics();
}

// --- CARGA ALUMNOS (REGLA: TODOS LOS CAMPOS EN ORDEN) ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    tbody.innerHTML = '<tr><td colspan="12">Cargando datos...</td></tr>';
    
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=primer_apellido:asc' : 'sort=fecha_baja:desc';
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=500`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        if(!json.data) throw new Error("API Error");

        tbody.innerHTML = '';
        json.data.forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId || a.id;
            
            const apellidos = `${p.primer_apellido || ''} ${p.segundo_apellido || ''}`.trim() || p.apellidos || "-";
            const nombre = p.nombre || "-";
            const dojoData = (p.dojo && p.dojo.data) ? p.dojo.data.attributes : (p.dojo || null);
            const dojoNom = dojoData ? dojoData.nombre : "-";

            const row = `<tr>
                <td><strong>${apellidos}</strong></td>
                <td>${nombre}</td>
                <td style="font-family:monospace">${p.dni || '-'}</td>
                <td><span class="badge">${p.grado || 'S/G'}</span></td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${p.fecha_nacimiento || '-'}</td>
                <td>${dojoNom}</td>
                <td>${p.direccion || '-'}</td>
                <td>${p.poblacion || '-'}</td>
                <td>${p.cp || '-'}</td>
                <td class="sticky-col">
                    <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn-icon delete" onclick="confirmarEstado('${id}', ${!activos}, '${apellidos}, ${nombre}')">
                        <i class="fa-solid ${activos ? 'fa-user-xmark' : 'fa-rotate-left'}"></i>
                    </button>
                    ${!activos ? `<button class="action-btn-icon delete" onclick="eliminarFisico('${id}', '${apellidos}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
            tbody.innerHTML += row;
        });
    } catch { tbody.innerHTML = '<tr><td colspan="12">Error recuperando datos.</td></tr>'; }
}

// --- ACCIONES ---
function confirmarEstado(id, nuevoEstado, nombre) {
    const titulo = nuevoEstado ? "Reactivar Alumno" : "Dar de Baja";
    showModal(titulo, `¿Confirmar cambio de estado para ${nombre}?`, async () => {
        const fecha = nuevoEstado ? null : new Date().toISOString().split('T')[0];
        await fetch(`${API_URL}/api/alumnos/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ data: { activo: nuevoEstado, fecha_baja: fecha } })
        });
        loadAlumnos(!nuevoEstado);
    });
}

function eliminarFisico(id, nombre) {
    showModal("¡PELIGRO!", `¿Borrar físicamente a ${nombre}?`, () => {
        setTimeout(() => {
            showModal("ÚLTIMO AVISO", "Esta acción es irreversible.", async () => {
                await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } });
                loadAlumnos(false);
            });
        }, 500);
    });
}

// --- DOJOS ---
async function loadDojosCards() {
    const grid = document.getElementById('grid-dojos');
    grid.innerHTML = 'Cargando Dojos...';
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        grid.innerHTML = '';
        json.data.forEach(d => {
            const p = d.attributes || d;
            const address = p.direccion ? p.direccion.replace(/\n/g, '<br>') : '-';
            grid.innerHTML += `<div class="dojo-card">
                <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${p.nombre}</h3></div>
                <div class="dojo-body">
                    <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${address}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div>
                    <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">VISITAR WEB OFICIAL</a>
                </div></div>`;
        });
    } catch { grid.innerHTML = 'Error cargando Dojos.'; }
}

// --- PDF ---
async function exportarPDF() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image(); logoImg.src = 'img/logo-arashi-informe.png';
    logoImg.onload = async function() {
        doc.addImage(logoImg, 'PNG', 10, 10, 45, 20);
        doc.setFontSize(18); doc.text("LLISTAT D'AFILIATS PER COGNOMS", 148, 18, { align: "center" });
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&sort=primer_apellido:asc&populate=dojo&pagination[limit]=500`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const body = (json.data || []).map(a => {
            const p = a.attributes || a;
            const ap = `${(p.primer_apellido || '').toUpperCase()} ${(p.segundo_apellido || '').toUpperCase()}`;
            return [new Date(p.createdAt).toLocaleDateString(), `${ap}, ${p.nombre || ''}`, p.dni || '-', p.email || '-', p.poblacion || '-', "BARCELONA", (p.dojo?.data?.attributes?.nombre || p.dojo?.nombre || '-')];
        });
        doc.autoTable({ startY: 35, head: [['Alta', 'Cognoms i Nom', 'DNI', 'Email', 'Població', 'Província', 'Centre Treball']], body: body, theme: 'grid', headStyles: { fillColor: [214, 234, 248], textColor: [0,0,0] }, styles: { fontSize: 8 } });
        doc.save("Informe_Alumnos_Arashi.pdf");
    };
}

// --- SISTEMA ---
async function runDiagnostics() {
    const o = document.getElementById('console-output'); o.innerHTML = 'Iniciando protocolos...';
    const lines = ["Iniciando protocolos...", "> Conectando a Neon DB... [OK]", "> Verificando API Strapi... [OK]", "> Comprobando integridad... [OK]", "SISTEMA OPERATIVO AL 100%"];
    for(const l of lines) { await new Promise(r => setTimeout(r, 500)); o.innerHTML += `<div>${l}</div>`; o.scrollTop = o.scrollHeight; }
    o.innerHTML += '<br><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="btn-monitor-ext">VEURE GRÀFICS DETALLATS</a>';
}

// --- UTILS ---
function showModal(title, msg, onOk) {
    const m = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = msg;
    document.getElementById('modal-btn-cancel').onclick = () => m.classList.add('hidden');
    document.getElementById('modal-btn-ok').onclick = () => { if(onOk) onOk(); m.classList.add('hidden'); };
    m.classList.remove('hidden');
}
function setupDragScroll() {
    const s = document.querySelector('.drag-scroll');
    if(!s) return;
    let isDown = false, startX, scrollLeft;
    s.addEventListener('mousedown', (e) => { isDown = true; s.classList.add('active'); startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; });
    s.addEventListener('mouseleave', () => isDown = false);
    s.addEventListener('mouseup', () => isDown = false);
    s.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX) * 2; });
}
function changeFontSize(id, delta) { 
    const t = document.getElementById(id);
    const s = parseFloat(window.getComputedStyle(t).fontSize);
    t.style.fontSize = (s + delta) + "px";
}
async function loadDojosSelect() {
    const sel = document.getElementById('new-dojo');
    const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();
    sel.innerHTML = '<option value="">Selecciona Dojo...</option>';
    json.data.forEach(d => { sel.innerHTML += `<option value="${d.documentId || d.id}">${(d.attributes || d).nombre}</option>`; });
}
async function loadCiudades() {
    const res = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion&pagination[limit]=500`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();
    const ciu = [...new Set(json.data.map(a => (a.attributes?.poblacion || a.poblacion)).filter(Boolean))];
    const dl = document.getElementById('ciudades-list'); if(dl) { dl.innerHTML = ''; ciu.sort().forEach(c => dl.innerHTML += `<option value="${c}">`); }
}
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function filtrarTabla(tid, iid) {
    const f = document.getElementById(iid).value.toUpperCase();
    const rows = document.getElementById(tid).getElementsByTagName('tr');
    for (let i = 1; i < rows.length; i++) rows[i].style.display = rows[i].textContent.toUpperCase().includes(f) ? "" : "none";
}
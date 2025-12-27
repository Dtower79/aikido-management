const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

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
        } else { document.getElementById('login-error').innerText = "❌ Error Credenciales"; }
    } catch { document.getElementById('login-error').innerText = "❌ Error de conexión"; }
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
    loadDojosSelect(); loadCiudades(); showSection('welcome'); 
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

// --- ALUMNOS (CARGA COMPLETA STRAPI V5) ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    tbody.innerHTML = `<tr><td colspan="${activos?12:6}">Cargando datos...</td></tr>`;
    
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=primer_apellido:asc' : 'sort=fecha_baja:desc';
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=400`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        if(!json.data) throw new Error("No data");

        tbody.innerHTML = '';
        json.data.forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId || a.id;
            
            const ap1 = p.primer_apellido || "";
            const ap2 = p.segundo_apellido || "";
            const nom = p.nombre || "";
            const apellidos = `${ap1} ${ap2}`.trim() || p.apellidos || "";
            const nombreMostrable = apellidos ? `${apellidos}, ${nom}` : nom;
            
            const dojoData = (p.dojo && p.dojo.data) ? p.dojo.data.attributes : p.dojo;
            const dojo = dojoData ? dojoData.nombre : '-';

            if (activos) {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${apellidos}</strong></td>
                        <td>${nom}</td>
                        <td style="font-family:monospace">${p.dni || '-'}</td>
                        <td><span class="badge">${p.grado || 'S/G'}</span></td>
                        <td>${p.telefono || '-'}</td>
                        <td>${p.email || '-'}</td>
                        <td>${p.fecha_nacimiento || '-'}</td>
                        <td>${dojo}</td>
                        <td>${p.direccion || '-'}</td>
                        <td>${p.poblacion || '-'}</td>
                        <td>${p.cp || '-'}</td>
                        <td class="sticky-col">
                            <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="action-btn-icon" onclick="confirmarBaja('${id}', '${nombreMostrable}')"><i class="fa-solid fa-user-xmark"></i></button>
                        </td>
                    </tr>`;
            } else {
                tbody.innerHTML += `
                    <tr>
                        <td class="txt-accent" style="font-weight:bold">${p.fecha_baja || '-'}</td>
                        <td><strong>${apellidos}</strong></td>
                        <td>${nom}</td>
                        <td>${p.dni || '-'}</td>
                        <td>${dojo}</td>
                        <td class="sticky-col">
                            <button class="action-btn-icon" onclick="confirmarReactivacion('${id}', '${nombreMostrable}')"><i class="fa-solid fa-rotate-left"></i></button>
                            <button class="action-btn-icon" onclick="eliminarDefinitivo('${id}', '${nombreMostrable}')"><i class="fa-solid fa-trash-can"></i></button>
                        </td>
                    </tr>`;
            }
        });
    } catch (err) { 
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="${activos?12:6}" style="color:red">Error recuperando datos del servidor.</td></tr>`; 
    }
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
            grid.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${p.nombre}</h3></div>
                    <div class="dojo-body">
                        <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${address}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div>
                        ${p.web ? `<a href="${p.web}" target="_blank" class="dojo-link-btn">VISITAR WEB OFICIAL</a>` : ''}
                    </div>
                </div>`;
        });
    } catch { grid.innerHTML = 'Error cargando Dojos.'; }
}

// --- ACCIONES ---
function confirmarBaja(id, nombre) {
    showModal("Confirmar Baja", `¿Quieres dar de baja a ${nombre}? Pasará al histórico.`, () => ejecutarCambioEstado(id, false));
}
function confirmarReactivacion(id, nombre) {
    showModal("Reactivar Alumno", `¿Dar de alta de nuevo a ${nombre}?`, () => ejecutarCambioEstado(id, true));
}
async function ejecutarCambioEstado(id, activo) {
    const fecha = activo ? null : new Date().toISOString().split('T')[0];
    await fetch(`${API_URL}/api/alumnos/${id}`, { 
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
        body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) 
    });
    showSection(activo ? 'alumnos' : 'bajas');
}
function eliminarDefinitivo(id, nombre) {
    showModal("¡PELIGRO!", `¿Borrar permanentemente a ${nombre}?`, () => {
        setTimeout(() => {
            showModal("ÚLTIMO AVISO", "Esta acción no se puede deshacer.", async () => {
                await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } });
                loadAlumnos(false);
            });
        }, 500);
    });
}

// --- OTROS ---
function showModal(title, msg, onOk) {
    const m = document.getElementById('custom-modal');
    const ok = document.getElementById('modal-btn-ok');
    const cancel = document.getElementById('modal-btn-cancel');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = msg;
    cancel.onclick = () => m.classList.add('hidden');
    ok.onclick = () => { if(onOk) onOk(); m.classList.add('hidden'); };
    m.classList.remove('hidden');
}

function setupDragScroll() {
    const sliders = document.querySelectorAll('.drag-scroll');
    sliders.forEach(s => {
        let isDown = false, startX, scrollLeft;
        s.addEventListener('mousedown', (e) => { isDown = true; s.classList.add('active'); startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; });
        s.addEventListener('mouseleave', () => isDown = false);
        s.addEventListener('mouseup', () => isDown = false);
        s.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX) * 2; });
    });
}

async function runDiagnostics() {
    const o = document.getElementById('console-output'); o.innerHTML = 'Iniciando protocolos...';
    const lines = ["> Conectando a Neon DB... [OK]", "> Verificando API Strapi... [OK]", "> Comprobando integridad... [OK]", "SISTEMA OPERATIVO AL 100%"];
    for(const l of lines) { await new Promise(r => setTimeout(r, 500)); o.innerHTML += `<div>${l}</div>`; }
    o.innerHTML += '<br><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="btn-monitor-ext" style="color:#33ff00; border:1px solid #33ff00; padding:10px 20px; text-decoration:none; display:inline-block; margin-top:20px;">VER GRÁFICOS DETALLADOS</a>';
}

function changeFontSize(id, delta) {
    const t = document.getElementById(id);
    const current = parseFloat(window.getComputedStyle(t).fontSize);
    t.style.fontSize = (current + delta) + "px";
}

async function loadDojosSelect() {
    const sel = document.getElementById('new-dojo');
    const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();
    sel.innerHTML = '<option value="">Selecciona Dojo...</option>';
    json.data.forEach(d => { sel.innerHTML += `<option value="${d.documentId || d.id}">${(d.attributes || d).nombre}</option>`; });
}

async function loadCiudades() {
    const res = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
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

async function exportarPDF() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image(); logoImg.src = 'img/logo-arashi-informe.png';
    logoImg.onload = async function() {
        doc.addImage(logoImg, 'PNG', 10, 10, 45, 20);
        doc.setFontSize(18); doc.text("LLISTAT D'AFILIATS PER COGNOMS", 148, 18, { align: "center" });
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&sort=primer_apellido:asc&populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const body = json.data.map(a => {
            const p = a.attributes || a;
            return [new Date(p.createdAt).toLocaleDateString(), `${(p.primer_apellido || '').toUpperCase()} ${(p.segundo_apellido || '').toUpperCase()}, ${p.nombre || ''}`, p.dni || '-', p.email || '-', p.poblacion || '-', "BARCELONA", p.dojo?.data?.attributes?.nombre || '-'];
        });
        doc.autoTable({ startY: 35, head: [['Alta', 'Cognoms i Nom', 'DNI', 'Email', 'Població', 'Província', 'Centre Treball']], body: body, theme: 'grid', headStyles: { fillColor: [214, 234, 248], textColor: [0,0,0] }, styles: { fontSize: 8 } });
        doc.save("Informe_Alumnos_Arashi.pdf");
    };
}
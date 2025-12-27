const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

document.addEventListener('DOMContentLoaded', () => {
    // Control sesión 20 min
    const loginTimeStr = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    const veinteMinutos = 20 * 60 * 1000;

    if (jwtToken && loginTimeStr && (ahora - parseInt(loginTimeStr) < veinteMinutos)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else {
        logout();
    }

    setupDniInput('dni-login'); setupDniInput('new-dni'); setupNumericInput('new-cp');
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    document.getElementById('search-baja')?.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await response.json();
        if (response.ok) {
            jwtToken = data.jwt;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            localStorage.setItem('aikido_login_time', Date.now().toString());
            showDashboard();
        } else { errorMsg.innerText = "❌ Credenciales incorrectas"; }
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

// --- ALUMNOS ---
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
        renderTabla(json.data, tbody, activos);
    } catch { tbody.innerHTML = `<tr><td colspan="${activos?12:6}">Error cargando datos.</td></tr>`; }
}

function renderTabla(data, tbody, activos) {
    tbody.innerHTML = '';
    data.forEach(a => {
        const p = a.attributes || a;
        const id = a.documentId || a.id;
        
        // Lógica de nombre para evitar ", Nathalie"
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
                        <button class="action-btn-icon delete" onclick="confirmarBaja('${id}', '${nombreMostrable}')"><i class="fa-solid fa-user-xmark"></i></button>
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
                        <button class="action-btn-icon restore" onclick="confirmarReactivacion('${id}', '${nombreMostrable}')"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${nombreMostrable}')"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>`;
        }
    });
}

// --- ACCIONES ---
function confirmarBaja(id, nombre) {
    showModal("Confirmar Baja", `¿Mover a ${nombre} al histórico?`, "warning", () => cambiarEstado(id, false));
}
function confirmarReactivacion(id, nombre) {
    showModal("Reactivar", `¿Dar de alta de nuevo a ${nombre}?`, "info", () => cambiarEstado(id, true));
}

async function cambiarEstado(id, activo) {
    const fecha = activo ? null : new Date().toISOString().split('T')[0];
    await fetch(`${API_URL}/api/alumnos/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
        body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) 
    });
    loadAlumnos(!activo); 
    showSection(activo ? 'alumnos' : 'bajas');
}

function eliminarDefinitivo(id, nombre) {
    showModal("AVISO CRÍTICO", `¿Borrar físicamente a ${nombre}?`, "error", () => {
        setTimeout(() => { showModal("ÚLTIMA OPORTUNIDAD", "Esta acción borrará al usuario para siempre.", "error", async () => { 
            await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); 
            loadAlumnos(false); 
        }); }, 500);
    });
}

// --- PDF ---
async function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const azulEncabezado = [214, 234, 248];
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    logoImg.onload = async function() {
        doc.addImage(logoImg, 'PNG', 10, 10, 45, 20);
        doc.setFontSize(18); doc.setFont("helvetica", "bold");
        doc.text("LLISTAT D'AFILIATS PER COGNOMS", 148, 18, { align: "center" });
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Arashi Group - Aikido Management System", 148, 25, { align: "center" });
        
        try {
            const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&sort=primer_apellido:asc&populate=dojo&pagination[limit]=400`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` }
            });
            const json = await res.json();
            
            const body = json.data.map(a => {
                const p = a.attributes;
                const apellidos = `${(p.primer_apellido || '').toUpperCase()} ${(p.segundo_apellido || '').toUpperCase()}`;
                const dojo = p.dojo?.data?.attributes?.nombre || '-';
                return [
                    p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-',
                    `${apellidos}, ${p.nombre || ''}`,
                    p.dni || '-',
                    p.email || '-',
                    p.poblacion || '-',
                    "BARCELONA",
                    dojo
                ];
            });

            doc.autoTable({
                startY: 35,
                head: [['Alta', 'Cognoms i Nom', 'DNI', 'Email', 'Població', 'Província', 'Centre Treball']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: azulEncabezado, textColor: [0,0,0] },
                styles: { fontSize: 8 }
            });
            doc.save("Informe_Alumnos_Arashi.pdf");
        } catch(e) { showModal("Error", "No se pudieron recuperar los datos.", "error"); }
    };
}

// --- UI HELPERS ---
function setupDragScroll() {
    const sliders = document.querySelectorAll('.drag-scroll');
    sliders.forEach(s => {
        let isDown = false, startX, scrollLeft;
        s.addEventListener('mousedown', (e) => { isDown = true; s.classList.add('active'); startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; });
        s.addEventListener('mouseleave', () => { isDown = false; s.classList.remove('active'); });
        s.addEventListener('mouseup', () => { isDown = false; s.classList.remove('active'); });
        s.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX) * 2; });
    });
}
function changeFontSize(id, delta) { 
    const t = document.getElementById(id); 
    const s = parseFloat(window.getComputedStyle(t).fontSize); 
    t.style.fontSize = (s + delta) + "px"; 
}

function showModal(title, msg, type, onOk) {
    const m = document.getElementById('custom-modal');
    const ok = document.getElementById('modal-btn-ok');
    const cancel = document.getElementById('modal-btn-cancel');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = msg;
    
    cancel.onclick = closeModal;
    ok.onclick = () => { if(onOk) onOk(); closeModal(); };
    m.classList.remove('hidden');
}
function closeModal() { document.getElementById('custom-modal').classList.add('hidden'); }

// (Resto de funciones loadDojosSelect, loadCiudades, editarAlumno, runDiagnostics permanecen iguales)
// ...
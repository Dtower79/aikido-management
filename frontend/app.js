// --- CONFIGURACIÓN ---
const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

// --- ESTADO ---
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupDniInput('dni-login');
    setupDniInput('new-dni');
    setupNumericInput('new-cp');

    if (jwtToken) {
        showDashboard();
    } else {
        showLogin();
    }
});

function setupDniInput(id) {
    const input = document.getElementById(id);
    if(input) {
        input.addEventListener('input', function (e) {
            e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
        });
    }
}

function setupNumericInput(id) {
    const input = document.getElementById(id);
    if(input) {
        input.addEventListener('input', function (e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
}

// --- VISTAS ---
function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    // Carga inicial
    loadDojos();
    loadCiudades();
    showSection('welcome');
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`sec-${sectionId}`).classList.remove('hidden');
    
    if(sectionId !== 'welcome') {
        const btn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
        if(btn) btn.classList.add('active');
    }

    if(sectionId === 'alumnos') loadAlumnosActivos();
    if(sectionId === 'bajas') loadAlumnosBaja();
    if(sectionId === 'dojos') loadDojosView();
    if(sectionId === 'status') runSystemDiagnostics();
}

// --- LOGIN / LOGOUT ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value; 
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    errorMsg.innerText = "Conectando...";

    try {
        const response = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await response.json();

        if (response.ok) {
            jwtToken = data.jwt;
            userData = data.user;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(userData));
            errorMsg.innerText = "";
            showDashboard();
        } else {
            errorMsg.innerText = "❌ Credenciales incorrectas";
        }
    } catch (error) {
        errorMsg.innerText = "❌ Error de conexión";
    }
});

function logout() {
    localStorage.removeItem('aikido_jwt');
    localStorage.removeItem('aikido_user');
    location.reload();
}

// --- SISTEMA DE MODALES ---
function showModal(title, message, type = 'info', onConfirm = null) {
    const overlay = document.getElementById('custom-modal');
    const iconDiv = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btnOk = document.getElementById('modal-btn-ok');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = title;
    msgEl.innerText = message;
    
    if (type === 'success') {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        iconDiv.style.color = '#10b981';
    } else if (type === 'error') {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        iconDiv.style.color = '#ef4444';
    } else if (type === 'warning') {
        iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        iconDiv.style.color = '#f59e0b';
    } else {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        iconDiv.style.color = '#3b82f6';
    }

    if (onConfirm) {
        btnCancel.classList.remove('hidden'); 
        btnOk.innerText = "Confirmar";
        btnOk.onclick = () => {
            onConfirm();
            closeModal();
        };
    } else {
        btnCancel.classList.add('hidden'); 
        btnOk.innerText = "Aceptar";
        btnOk.onclick = closeModal;
    }
    overlay.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}

// --- GESTIÓN DE DATOS ---

async function loadDojos() {
    const select = document.getElementById('new-dojo');
    try {
        const res = await fetch(`${API_URL}/api/dojos?pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecciona un Dojo...</option>';
        data.data.forEach(dojo => {
            const d = dojo.attributes || dojo;
            const id = dojo.documentId || dojo.id; 
            select.innerHTML += `<option value="${id}">${d.nombre}</option>`;
        });
        if(currentVal) select.value = currentVal;
    } catch (e) { console.error(e); }
}

async function loadCiudades() {
    const datalist = document.getElementById('ciudades-list');
    try {
        const res = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion&pagination[limit]=500`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        const ciudades = new Set();
        data.data.forEach(a => {
            const p = a.attributes ? a.attributes.poblacion : a.poblacion;
            if(p) ciudades.add(p);
        });
        
        datalist.innerHTML = "";
        Array.from(ciudades).sort().forEach(ciudad => {
            datalist.innerHTML += `<option value="${ciudad}">`;
        });
    } catch (e) { console.error(e); }
}

document.getElementById('form-nuevo-alumno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-alumno');
    const originalText = btn.innerText;
    btn.disabled = true; btn.innerText = "Procesando...";

    const editId = document.getElementById('edit-id').value;
    const isEdit = !!editId;

    // --- CORRECCIÓN: UNIR APELLIDOS ---
    const ap1 = document.getElementById('new-apellido1').value.trim();
    const ap2 = document.getElementById('new-apellido2').value.trim();
    const apellidosCompletos = `${ap1} ${ap2}`.trim();

    const alumnoData = {
        nombre: document.getElementById('new-nombre').value,
        apellidos: apellidosCompletos, // Enviamos un solo campo a Strapi
        dni: document.getElementById('new-dni').value,
        email: document.getElementById('new-email').value,
        telefono: document.getElementById('new-telefono').value,
        fecha_nacimiento: document.getElementById('new-nacimiento').value || null,
        direccion: document.getElementById('new-direccion').value,
        poblacion: document.getElementById('new-poblacion').value,
        cp: document.getElementById('new-cp').value,
        grado: document.getElementById('new-grado').value,
        grupo: document.getElementById('new-grupo').value,
        dojo: document.getElementById('new-dojo').value,
        activo: true
    };

    try {
        let url = `${API_URL}/api/alumnos`;
        let method = 'POST';
        if (isEdit) { url = `${API_URL}/api/alumnos/${editId}`; method = 'PUT'; }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ data: alumnoData })
        });

        if (res.ok) {
            showModal("Éxito", isEdit ? "Actualizado correctamente" : "Creado correctamente", "success");
            resetForm(); loadCiudades(); 
            showSection('alumnos'); loadAlumnosActivos();
        } else {
            const err = await res.json();
            showModal("Error", err.error?.message || "Revisa los datos", "error");
        }
    } catch { showModal("Error", "Error de conexión", "error"); }
    finally { btn.disabled = false; btn.innerText = originalText; }
});

function resetForm() {
    document.getElementById('form-nuevo-alumno').reset();
    document.getElementById('edit-id').value = ""; 
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-user-plus"></i> Alta de Alumno';
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO";
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

async function editarAlumno(documentId) {
    showSection('nuevo-alumno');
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-pen"></i> Editando Alumno';
    document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR DATOS";
    document.getElementById('btn-cancelar-edit').classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data; const props = data.attributes || data; 

        document.getElementById('edit-id').value = data.documentId || data.id;
        document.getElementById('new-nombre').value = props.nombre || '';
        
        // --- CORRECCIÓN: SEPARAR APELLIDOS PARA EL FORMULARIO ---
        // Si en la BBDD es "Garcia Perez", lo partimos para rellenar los 2 inputs
        const apellidosStr = props.apellidos || '';
        const partes = apellidosStr.split(' ');
        
        // Estrategia simple: Primera palabra al input 1, el resto al input 2
        document.getElementById('new-apellido1').value = partes[0] || '';
        document.getElementById('new-apellido2').value = partes.slice(1).join(' ') || '';

        document.getElementById('new-dni').value = props.dni || '';
        document.getElementById('new-email').value = props.email || '';
        document.getElementById('new-telefono').value = props.telefono || '';
        document.getElementById('new-nacimiento').value = props.fecha_nacimiento || '';
        document.getElementById('new-direccion').value = props.direccion || '';
        document.getElementById('new-poblacion').value = props.poblacion || '';
        document.getElementById('new-cp').value = props.cp || '';
        document.getElementById('new-grado').value = props.grado || '';
        document.getElementById('new-grupo').value = props.grupo || 'Full Time';
        
        if (props.dojo) {
            const dojoId = props.dojo.documentId || (props.dojo.data ? props.dojo.data.documentId : null) || props.dojo.id;
            if(dojoId) document.getElementById('new-dojo').value = dojoId;
        }
    } catch { showModal("Error", "Error cargando datos", "error"); showSection('alumnos'); }
}

// --- GESTIÓN DE BAJAS Y ACTIVOS ---

async function loadAlumnosActivos() {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</td></tr>';
    
    const timeoutMsg = setTimeout(() => {
        tbody.innerHTML = '<tr><td colspan="5" class="loading" style="color:var(--primary)"><i class="fa-solid fa-server"></i> Despertando al servidor (puede tardar unos segundos)...</td></tr>';
    }, 2000);

    // --- CORRECCIÓN: ORDENAR POR 'apellidos' (que sí existe) ---
    const url = `${API_URL}/api/alumnos?populate=dojo&sort=apellidos:asc&filters[activo][$eq]=true&pagination[limit]=100`;
    await fetchAlumnosGenerico(url, tbody, true, timeoutMsg); 
}

async function loadAlumnosBaja() {
    const tbody = document.getElementById('lista-bajas-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando histórico...</td></tr>';

    const timeoutMsg = setTimeout(() => {
        tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fa-solid fa-server"></i> Despertando al servidor...</td></tr>';
    }, 2000);

    // --- CORRECCIÓN: ORDENAR POR 'apellidos' ---
    const url = `${API_URL}/api/alumnos?populate=dojo&sort=apellidos:asc&filters[activo][$eq]=false&pagination[limit]=100`;
    await fetchAlumnosGenerico(url, tbody, false, timeoutMsg);
}

async function fetchAlumnosGenerico(url, tbodyElement, esActivo, timeoutId) {
    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (response.ok) {
            renderTablaAlumnos(data.data, tbodyElement, esActivo);
        } else {
            if(response.status === 401 || response.status === 403) logout();
        }
    } catch {
        clearTimeout(timeoutId);
        tbodyElement.innerHTML = '<tr><td colspan="5" style="color:var(--accent)">Error de conexión o servidor apagado.</td></tr>';
    }
}

function renderTablaAlumnos(alumnos, tbody, esActivo) {
    tbody.innerHTML = '';
    if (!alumnos || alumnos.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay alumnos.</td></tr>'; return; }

    alumnos.forEach(alumno => {
        const props = alumno.attributes || alumno; 
        const docId = alumno.documentId || alumno.id; 
        
        // --- CORRECCIÓN: MOSTRAR CAMPO 'apellidos' ---
        const nombreCompleto = `${props.apellidos || ''}, ${props.nombre || ''}`;

        let dojoNombre = "-";
        if (props.dojo) {
             const d = props.dojo.data ? props.dojo.data.attributes : props.dojo;
             if(d && d.nombre) dojoNombre = d.nombre;
        }
        const grupo = props.grupo ? ` (${props.grupo})` : "";
        let botones = esActivo ? 
            `<button class="action-btn-icon" onclick="editarAlumno('${docId}')"><i class="fa-solid fa-pen"></i></button>
             <button class="action-btn-icon delete" onclick="confirmarBaja('${docId}', '${nombreCompleto}')"><i class="fa-solid fa-user-xmark"></i></button>` :
            `<button class="action-btn-icon restore" onclick="confirmarReactivacion('${docId}', '${nombreCompleto}')"><i class="fa-solid fa-rotate-left"></i></button>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${nombreCompleto}</strong></td>
                <td style="font-family: monospace;">${props.dni || '-'}</td>
                <td><span class="badge">${props.grado || 'S/G'}</span></td>
                <td>${dojoNombre}${grupo}</td>
                <td>${botones}</td>
            </tr>`;
    });
}

// ... Resto de funciones (confirmarBaja, Reactivación, dojos, terminal, scroll)
// COPIA A PARTIR DE AQUI LAS FUNCIONES QUE YA TENIAS EN EL ANTERIOR APP.JS
// (confirmarBaja, confirmarReactivacion, cambiarEstadoAlumno, filtrarAlumnos, 
// loadDojosView, renderDojosCards, runSystemDiagnostics...)
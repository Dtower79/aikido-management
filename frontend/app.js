// --- CONFIGURACIÓN ---
const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

// --- ESTADO ---
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Validadores de DNI en tiempo real (Login y Nuevo Alumno)
    setupDniInput('dni-login');
    setupDniInput('new-dni');

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

// --- VISTAS ---
function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    // Cargar datos iniciales necesarios
    loadDojos();
    // Por defecto mostramos la sección activa (Nuevo Alumno)
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`sec-${sectionId}`).classList.remove('hidden');
    
    // Buscar botón por onclick
    const btn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
    if(btn) btn.classList.add('active');

    // Si entramos en alumnos, recargar la lista
    if(sectionId === 'alumnos') loadAlumnos();
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
    location.reload(); // Recarga limpia
}

// --- GESTIÓN DE ALUMNOS ---

// 1. Cargar Dojos para el Select
async function loadDojos() {
    const select = document.getElementById('new-dojo');
    try {
        const res = await fetch(`${API_URL}/api/dojos?pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        
        select.innerHTML = '<option value="">Selecciona un Dojo...</option>';
        data.data.forEach(dojo => {
            // Strapi v5 directo / v4 attributes
            const d = dojo.attributes || dojo;
            const id = dojo.id || dojo.documentId; // Preferimos documentId en v5
            select.innerHTML += `<option value="${dojo.documentId}">${d.nombre}</option>`;
        });
    } catch (e) { console.error("Error cargando dojos", e); }
}

// 2. Crear Nuevo Alumno
document.getElementById('form-nuevo-alumno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Guardando...";

    // Recoger datos
    const alumnoData = {
        nombre: document.getElementById('new-nombre').value,
        apellidos: document.getElementById('new-apellidos').value,
        dni: document.getElementById('new-dni').value,
        email: document.getElementById('new-email').value,
        telefono: document.getElementById('new-telefono').value,
        fecha_nacimiento: document.getElementById('new-nacimiento').value,
        direccion: document.getElementById('new-direccion').value,
        poblacion: document.getElementById('new-poblacion').value,
        cp: document.getElementById('new-cp').value,
        grado: document.getElementById('new-grado').value,
        grupo: document.getElementById('new-grupo').value,
        dojo: document.getElementById('new-dojo').value // Esto envía el ID
    };

    try {
        const res = await fetch(`${API_URL}/api/alumnos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ data: alumnoData })
        });

        if (res.ok) {
            alert("✅ Alumno creado correctamente");
            e.target.reset(); // Limpiar formulario
            showSection('alumnos'); // Ir a la lista
        } else {
            const err = await res.json();
            alert("❌ Error: " + (err.error?.message || "Revisa los datos"));
        }
    } catch (error) {
        alert("❌ Error de conexión");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

// 3. Listar Alumnos
async function loadAlumnos() {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/alumnos?populate=*&sort=apellidos:asc&pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await response.json();
        
        if (response.ok) renderTablaAlumnos(data.data);
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error de conexión</td></tr>';
    }
}

function renderTablaAlumnos(alumnos) {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '';

    if (!alumnos || alumnos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay alumnos.</td></tr>';
        return;
    }

    alumnos.forEach(alumno => {
        const props = alumno.attributes || alumno; 
        
        let dojoNombre = "-";
        if (props.dojo) {
             const d = props.dojo.data ? props.dojo.data.attributes : props.dojo;
             if(d) dojoNombre = d.nombre;
        }
        
        const grupo = props.grupo ? ` (${props.grupo})` : "";

        const row = `
            <tr>
                <td><strong>${props.apellidos || ''}</strong>, ${props.nombre || ''}</td>
                <td style="font-family: monospace;">${props.dni || '-'}</td>
                <td><span class="badge">${props.grado || 'S/G'}</span></td>
                <td>${dojoNombre}${grupo}</td>
                <td>
                    <button class="action-btn-icon"><i class="fa-solid fa-pen"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filtrarAlumnos() {
    const filter = document.getElementById('search-alumno').value.toUpperCase();
    const tr = document.getElementById('tabla-alumnos').getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) { 
        const tdNombre = tr[i].getElementsByTagName('td')[0];
        const tdDNI = tr[i].getElementsByTagName('td')[1];
        if (tdNombre || tdDNI) {
            const txt = (tdNombre.textContent + tdDNI.textContent).toUpperCase();
            tr[i].style.display = txt.indexOf(filter) > -1 ? "" : "none";
        }
    }
}
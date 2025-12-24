// --- CONFIGURACIÓN ---
const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

// --- ESTADO ---
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Lógica de formato DNI en tiempo real
    const dniInput = document.getElementById('dni-login');
    if(dniInput) {
        dniInput.addEventListener('input', function (e) {
            // Convertir a mayúsculas y borrar todo lo que no sea letra o número
            e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
        });
    }

    if (jwtToken) {
        showDashboard();
    } else {
        showLogin();
    }
});

// --- VISTAS ---
function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadAlumnos();
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sec-${sectionId}`).classList.remove('hidden');
    const btn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
    if(btn) btn.classList.add('active');
}

// --- LOGIN ---
const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Aquí cogemos el DNI ya limpio
    const identifier = document.getElementById('dni-login').value; 
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    errorMsg.innerText = "Conectando...";

    try {
        const response = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Strapi acepta email o username en el campo 'identifier'
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
        console.error(error);
        errorMsg.innerText = "❌ Error de conexión";
    }
});

function logout() {
    localStorage.removeItem('aikido_jwt');
    localStorage.removeItem('aikido_user');
    jwtToken = null;
    userData = null;
    showLogin();
}

// --- CARGAR DATOS (ORDENADOS) ---
async function loadAlumnos() {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando alumnos...</td></tr>';

    try {
        // CAMBIO: Añadido '&sort=apellidos:asc' a la URL
        const response = await fetch(`${API_URL}/api/alumnos?populate=*&sort=apellidos:asc&pagination[limit]=100`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            renderTablaAlumnos(data.data);
        } else {
            if(response.status === 401 || response.status === 403) logout();
            tbody.innerHTML = `<tr><td colspan="5" style="color:var(--accent)">Error: No tienes permiso</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--accent)">Error de conexión</td></tr>';
    }
}

function renderTablaAlumnos(alumnos) {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '';

    if (alumnos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No hay alumnos registrados.</td></tr>';
        return;
    }

    alumnos.forEach(alumno => {
        const props = alumno.attributes || alumno; 
        
        let dojoNombre = "-";
        if (props.dojo && (props.dojo.data || props.dojo.nombre)) {
             const dojoData = props.dojo.data ? props.dojo.data.attributes : props.dojo;
             dojoNombre = dojoData.nombre || "-";
        }
        
        const grupo = props.grupo || "";
        // Simplificar visualización
        const ubicacion = grupo ? grupo : dojoNombre; 

        const row = `
            <tr>
                <td><strong>${props.apellidos || ''}</strong>, ${props.nombre || ''}</td>
                <td style="font-family: monospace; letter-spacing: 1px;">${props.dni || '-'}</td>
                <td><span style="background:var(--bg-dark); padding:4px 8px; border-radius:4px; font-size:0.8rem; border: 1px solid var(--border)">${props.grado || 'S/G'}</span></td>
                <td>${ubicacion}</td>
                <td>
                    <button class="action-btn-icon" title="Editar"><i class="fa-solid fa-pen"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filtrarAlumnos() {
    const input = document.getElementById('search-alumno');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('tabla-alumnos');
    const tr = table.getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) { 
        const tdNombre = tr[i].getElementsByTagName('td')[0];
        const tdDNI = tr[i].getElementsByTagName('td')[1];
        
        if (tdNombre || tdDNI) {
            const txtValueNombre = tdNombre.textContent || tdNombre.innerText;
            const txtValueDNI = tdDNI.textContent || tdDNI.innerText;
            
            if (txtValueNombre.toUpperCase().indexOf(filter) > -1 || txtValueDNI.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}
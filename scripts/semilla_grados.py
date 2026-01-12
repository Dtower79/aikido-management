import requests
import os
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("STRAPI_URL", "https://elegant-acoustics-3b7e60f840.strapiapp.com")
API_TOKEN = os.getenv("STRAPI_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# CORRECCIÓN: Claves idénticas a la captura de pantalla
GRADOS = [
    {"Grado": "5º KYU", "Horas_Necesarias": 30},
    {"Grado": "4º KYU", "Horas_Necesarias": 40},
    {"Grado": "3º KYU", "Horas_Necesarias": 50},
    {"Grado": "2º KYU", "Horas_Necesarias": 50},
    {"Grado": "1º KYU", "Horas_Necesarias": 60},
    {"Grado": "1º DAN", "Horas_Necesarias": 70},
    {"Grado": "2º DAN", "Horas_Necesarias": 200},
    {"Grado": "3º DAN", "Horas_Necesarias": 300},
    {"Grado": "4º DAN", "Horas_Necesarias": 400},
    {"Grado": "5º DAN", "Horas_Necesarias": 500},
    {"Grado": "6º DAN", "Horas_Necesarias": 600}
]

print("🚀 Insertando requisitos de grado en Strapi...")

for g in GRADOS:
    try:
        # 1. Comprobar si ya existe (usando Grado con mayúscula)
        check = requests.get(f"{API_URL}/api/requisito-grados?filters[Grado][$eq]={g['Grado']}", headers=HEADERS)
        
        if check.json().get('data'):
            print(f"⚠️ Ya existe: {g['Grado']}")
            continue

        # 2. Crear
        payload = {"data": g}
        r = requests.post(f"{API_URL}/api/requisito-grados", json=payload, headers=HEADERS)
        
        if r.status_code in [200, 201]:
            print(f"✅ Creado: {g['Grado']} ({g['Horas_Necesarias']}h)")
        else:
            print(f"❌ Error {g['Grado']}: {r.text}")
            
    except Exception as e:
        print(f"❌ Excepción: {e}")

print("🏁 Proceso finalizado.")
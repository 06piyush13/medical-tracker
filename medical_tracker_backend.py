# medical_tracker_backend.py
"""
Flask backend for the Medical Tracker project with MySQL integration.
Serves the frontend (index.html from /templates) and provides REST APIs for:
- /api/predict   -> predict diseases based on symptoms
- /api/history   -> fetch or add past checks (stored in MySQL)
- /api/nearby    -> find nearby hospitals/doctors (via Overpass API)
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import requests
import mysql.connector
from mysql.connector import pooling
from datetime import datetime
import os
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# ENV + APP SETUP
# -----------------------------------------------------------------------------
load_dotenv()

dbconfig = {
    "host": "localhost",
    "user": "piyush",
    "password": "Test@1234",
    "database": "medical_tracker",
}


app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# -----------------------------------------------------------------------------  
# MYSQL CONNECTION POOL  
# -----------------------------------------------------------------------------  
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="medical_tracker_pool",
        pool_size=5,
        pool_reset_session=True,
        **dbconfig
    )
    print("✅ MySQL connection pool created successfully.")
except mysql.connector.Error as e:
    print(f"❌ Error creating MySQL pool: {e}")


# -----------------------------------------------------------------------------
# CONDITIONS DATABASE (for symptom matching)
# -----------------------------------------------------------------------------
CONDITIONS_DB = [
    {'id':'common_cold','name':'Common Cold','description':'A mild viral infection of the nose and throat.','causes':'Rhinoviruses.','symptoms':['sneezing','sore throat','runny nose','congestion','cough','mild fever'],'meds':['Rest','Paracetamol','Decongestants']},
    {'id':'influenza','name':'Influenza (Flu)','description':'A contagious respiratory illness caused by influenza viruses.','causes':'Influenza A and B viruses.','symptoms':['fever','body ache','chills','headache','cough','fatigue'],'meds':['Antivirals (consult doctor)','Rest & fluids']},
    {'id':'covid19','name':'COVID-19','description':'Respiratory infection by SARS-CoV-2.','causes':'SARS-CoV-2 virus.','symptoms':['fever','dry cough','loss of taste','loss of smell','fatigue','sore throat','shortness of breath'],'meds':['Testing & isolation','Symptomatic care']},
    {'id':'migraine','name':'Migraine','description':'A neurological condition causing severe headaches.','causes':'Stress, light, foods.','symptoms':['headache','nausea','light sensitivity','sound sensitivity','visual aura'],'meds':['Triptans','NSAIDs','Rest in dark room']},
    {'id':'asthma','name':'Asthma','description':'Chronic lung condition with airway narrowing.','causes':'Allergic triggers, infections, exercise.','symptoms':['wheezing','shortness of breath','chest tightness','cough'],'meds':['Inhalers','Avoid triggers']},
    {'id':'anemia','name':'Anemia','description':'Low hemoglobin reduces oxygen transport.','causes':'Iron or B12 deficiency.','symptoms':['fatigue','pallor','shortness of breath','palpitations'],'meds':['Iron supplements','Diet improvement']},
    {'id':'malaria','name':'Malaria','description':'Parasitic infection causing cyclical fevers.','causes':'Plasmodium via mosquito bite.','symptoms':['fever','chills','sweats','headache','muscle pain'],'meds':['Antimalarials','Medical attention']},
    {'id':'typhoid','name':'Typhoid Fever','description':'Bacterial infection from Salmonella typhi.','causes':'Contaminated food/water.','symptoms':['sustained fever','abdominal pain','constipation','headache'],'meds':['Antibiotics','Hydration']},
    {'id':'arthritis','name':'Arthritis','description':'Joint inflammation causing pain and stiffness.','causes':'Autoimmune or wear-and-tear.','symptoms':['joint pain','stiffness','swelling'],'meds':['NSAIDs','Physiotherapy']},
    {'id':'food_poisoning','name':'Food Poisoning','description':'Illness from contaminated food.','causes':'Bacteria or toxins.','symptoms':['nausea','vomiting','diarrhea','stomach cramps','fever'],'meds':['Hydration','Rest']}
]

# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def normalize_symptoms(items):
    out = []
    for s in items or []:
        if not isinstance(s, str):
            continue
        s2 = ''.join(ch for ch in s.lower() if ch.isalnum() or ch.isspace()).strip()
        if s2:
            out.append(s2)
    return out

def score_conditions(input_symptoms):
    input_set = set(input_symptoms)
    results = []
    for cond in CONDITIONS_DB:
        match_count = len([s for s in cond["symptoms"] if s.lower() in input_set])
        score = match_count / max(len(cond["symptoms"]), 1)
        results.append({**cond, "score": round(score, 2), "matchCount": match_count})
    results.sort(key=lambda x: (-x["score"], -x["matchCount"]))
    return results[:5]

def get_db_connection():
    if connection_pool is None:
        raise ConnectionError("Database connection pool not initialized.")
    return connection_pool.get_connection()
# -----------------------------------------------------------------------------
# ROUTES
# -----------------------------------------------------------------------------
@app.route("/")
def home():
    """Serve frontend (index.html)"""
    return render_template("index.html")

@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json() or {}
    items = data.get("symptoms")
    if not isinstance(items, list) or not items:
        return jsonify({"error": 'Provide JSON: {"symptoms": ["fever","cough"]}'}), 400
    normalized = normalize_symptoms(items)
    scored = score_conditions(normalized)
    return jsonify({"input": normalized, "scored": scored})

@app.route("/api/history", methods=["GET", "POST"])
def api_history():
    if request.method == "GET":
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT query, `when`, top FROM history ORDER BY id DESC LIMIT 50")
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            return jsonify({"history": rows})
        except mysql.connector.Error as e:
            return jsonify({"error": str(e)}), 500

    data = request.get_json() or {}
    query = data.get("query")
    when = data.get("when") or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    top = data.get("top") or ""
    if not query:
        return jsonify({"error": "Missing 'query'"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO history (query, `when`, top) VALUES (%s,%s,%s)", (query, when, top))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"ok": True})
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/nearby", methods=["POST"])
def api_nearby():
    data = request.get_json() or {}
    lat, lon = data.get("lat"), data.get("lon")
    radius = data.get("radiusMeters", 5000)
    if not lat or not lon:
        return jsonify({"error": "Provide lat, lon"}), 400

    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"~"clinic|doctors|hospital|pharmacy"](around:{int(radius)},{lat},{lon});
      way["amenity"~"clinic|doctors|hospital|pharmacy"](around:{int(radius)},{lat},{lon});
      relation["amenity"~"clinic|doctors|hospital|pharmacy"](around:{int(radius)},{lat},{lon});
    );
    out center;
    """
    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query.encode("utf-8"),
            headers={"Content-Type": "text/plain"},
            timeout=25
        )
        return (resp.content, resp.status_code, {"Content-Type": "application/json"})
    except requests.RequestException as e:
        return jsonify({"error": "Overpass API failed", "detail": str(e)}), 502

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

# -----------------------------------------------------------------------------
# MAIN ENTRY
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("🚀 Medical Tracker backend running at http://127.0.0.1:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)

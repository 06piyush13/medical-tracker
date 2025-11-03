
![WhatsApp Image 2025-10-28 at 10 28 41_bcf387d6](https://github.com/user-attachments/assets/988ca54c-ce4d-4a2e-b708-00ff79e40238)


````markdown
# 🩺 Medical Tracker — Symptom Predictor & Nearby Care Finder

A simple **Flask-based web application** that predicts possible medical conditions based on user symptoms and helps locate nearby clinics, doctors, or pharmacies using OpenStreetMap data.  

> ⚠️ **Disclaimer:** This project is for **educational purposes only**. It should **not** be used as a substitute for professional medical diagnosis or treatment.

---

## 🌟 Features

- 🤖 **Symptom Prediction** — Enter symptoms and get possible conditions using rule-based logic.  
- 🧠 **AI-like Scoring** — Matches user inputs with a database of known conditions.  
- 📍 **Nearby Care Finder** — Uses GPS + OpenStreetMap API to locate nearby hospitals, clinics, and pharmacies.  
- 🕒 **History Tracking** — Stores previous user queries and top predicted results in MySQL.  
- 🌐 **Responsive Frontend** — Clean and simple UI built with HTML, CSS, and JavaScript (Leaflet for maps).  
- 🗄️ **MySQL Database** — Tracks user search history.  

---

## 🎯 Objectives / Outcomes

- Build a full-stack medical prediction tool using **Flask**, **MySQL**, and **OpenStreetMap API**.  
- Understand how to connect backend APIs with a dynamic frontend.  
- Learn basic **AI logic**, **database integration**, and **REST API development**.  
- Gain hands-on experience in **web app deployment and environment configuration**.

---

## 🧰 Tools & Technologies Used

| Layer | Tools / Libraries |
|-------|--------------------|
| **Frontend** | HTML, CSS, JavaScript, Leaflet.js |
| **Backend** | Flask, Flask-CORS, Python |
| **Database** | MySQL |
| **Environment** | dotenv (.env) |
| **External API** | OpenStreetMap / Overpass API |
| **Version Control** | Git & GitHub |

---

## 🏗️ System Architecture

```text
+------------------------+
|       Frontend         |
|  (HTML, CSS, JS)       |
+-----------+------------+
            |
            v
+------------------------+
|        Backend         |
| Flask REST API Server  |
+-----------+------------+
            |
   +--------+---------+
   | AI Logic / Rules |
   | (Symptom Scoring)|
   +--------+---------+
            |
            v
+------------------------+
|       Database         |
|  (MySQL: history)      |
+------------------------+
            |
            v
+------------------------+
|  External API Layer    |
|  (OpenStreetMap / OSM) |
+------------------------+
````

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/<your-username>/medical-tracker.git
cd medical-tracker
```

### 2️⃣ Create Virtual Environment

```bash
python -m venv venv
venv\Scripts\activate       # for Windows
# OR
source venv/bin/activate    # for Mac/Linux
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Setup MySQL Database

Open MySQL and run:

```sql
SOURCE init.sql;
```

### 5️⃣ Configure Environment Variables

Create a `.env` file:

```
DB_HOST=localhost
DB_USER=
DB_PASS=
DB_NAME=
```

### 6️⃣ Run the Application

```bash
python medical_tracker_backend.py
```

Access the app at 👉 [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## 📸 Screenshots

| Symptom Input                  | Prediction Results               | Nearby Map                   |
| ------------------------------ | -------------------------------- | ---------------------------- |
| ![Input](![WhatsApp Image 2025-10-28 at 10 28 41_c45ef340](https://github.com/user-attachments/assets/30510c69-5eaa-4882-a5b7-509e7c24748e)
) | ![Results](<img width="1280" height="798" alt="image" src="https://github.com/user-attachments/assets/6025f9f2-e4a0-411e-be6a-a790ba3a1ff2" />
) | ![Map](![WhatsApp Image 2025-10-28 at 10 28 42_ad8f2219](https://github.com/user-attachments/assets/afb200bf-4620-4a85-a7b1-b53f1d9d9e34)
) |



---

## 🧩 Folder Structure

```
medical-tracker/
│
├── medical_tracker_backend.py
├── requirements.txt
├── init.sql
├── .env
│
├── /static
│   ├── script.js
│   └── style.css
│
├── /templates
│   └── index.html
│
└── /venv
```

---

## 🧠 API Endpoints

| Endpoint       | Method   | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| `/api/predict` | POST     | Returns predicted medical conditions              |
| `/api/history` | GET/POST | Fetch or store user query history                 |
| `/api/nearby`  | POST     | Finds nearby medical facilities using coordinates |

---


---

## 👨‍💻 Author

**Piyush Chandrakar**
🎓 B.Tech in ECE @ IIIT Naya Raipur
📧 www.linkedin.com/in/piyushchandrakar13

---

```



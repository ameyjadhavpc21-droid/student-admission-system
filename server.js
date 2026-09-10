const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const defaultDB = {
  settings: {
    collegeName: "ABC College of Technology",
    academicYear: "2026-27",
    nextApplication: 1001
  },
  departments: [
    { id: 1, name: "Computer Engineering", code: "CO", seats: 60, minPercentage: 60 },
    { id: 2, name: "Information Technology", code: "IT", seats: 60, minPercentage: 55 },
    { id: 3, name: "Electronics & Telecommunication", code: "ETC", seats: 60, minPercentage: 50 },
    { id: 4, name: "Mechanical Engineering", code: "ME", seats: 60, minPercentage: 45 },
    { id: 5, name: "Civil Engineering", code: "CE", seats: 60, minPercentage: 45 }
  ],
  students: [],
  allocations: []
};

function ensureDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
}
function loadDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function nextApplication(db) {
  const n = db.settings.nextApplication++;
  saveDB(db);
  return `ADM-${n}`;
}
function cleanStudent(s) {
  return {
    id: s.id, applicationId: s.applicationId, name: s.name, dob: s.dob,
    gender: s.gender, email: s.email, phone: s.phone, address: s.address,
    qualification: s.qualification, percentage: Number(s.percentage),
    category: s.category, preferences: s.preferences || [],
    status: s.status, createdAt: s.createdAt
  };
}

app.get("/api/dashboard", (req, res) => {
  const db = loadDB();
  const total = db.students.length;
  const approved = db.students.filter(s => s.status === "Approved").length;
  const pending = db.students.filter(s => s.status === "Pending").length;
  const allocated = db.students.filter(s => s.status === "Allocated").length;
  const rejected = db.students.filter(s => s.status === "Rejected").length;
  const dept = db.departments.map(d => {
    const count = db.allocations.filter(a => a.departmentId === d.id).length;
    return {...d, filled: count, available: Math.max(0, d.seats - count)};
  });
  res.json({ total, approved, pending, allocated, rejected, departments: dept });
});

app.get("/api/departments", (req, res) => {
  const db = loadDB();
  res.json(db.departments.map(d => ({
    ...d,
    filled: db.allocations.filter(a => a.departmentId === d.id).length,
    available: Math.max(0, d.seats - db.allocations.filter(a => a.departmentId === d.id).length)
  })));
});

app.post("/api/departments", (req, res) => {
  const db = loadDB();
  const { name, code, seats, minPercentage } = req.body;
  if (!name || !code || !Number(seats)) return res.status(400).json({error:"Name, code and seats are required"});
  const id = Math.max(0, ...db.departments.map(d => d.id)) + 1;
  db.departments.push({id, name, code, seats:Number(seats), minPercentage:Number(minPercentage||0)});
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/students", (req, res) => {
  const db = loadDB();
  let list = db.students.map(s => {
    const a = db.allocations.find(x => x.studentId === s.id);
    const d = a ? db.departments.find(x => x.id === a.departmentId) : null;
    return {...cleanStudent(s), allocation: d ? {id:d.id, name:d.name, code:d.code} : null};
  });
  const q = String(req.query.q || "").toLowerCase().trim();
  if (q) list = list.filter(s => `${s.name} ${s.applicationId} ${s.email} ${s.phone}`.toLowerCase().includes(q));
  res.json(list.sort((a,b)=>Number(b.percentage)-Number(a.percentage)));
});

app.post("/api/students", (req, res) => {
  const db = loadDB();
  const { name, dob, gender, email, phone, address, qualification, percentage, category, preferences } = req.body;
  if (!name || !email || !phone || percentage === undefined) return res.status(400).json({error:"Name, email, phone and percentage are required"});
  const pct = Number(percentage);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({error:"Percentage must be between 0 and 100"});
  const prefs = Array.isArray(preferences) ? preferences.map(Number).filter(Boolean) : [];
  const student = {
    id: Date.now(), applicationId: nextApplication(db), name, dob: dob||"",
    gender: gender||"", email, phone, address:address||"", qualification:qualification||"",
    percentage:pct, category:category||"General", preferences:prefs, status:"Pending",
    createdAt:new Date().toISOString()
  };
  db.students.push(student);
  saveDB(db);
  res.status(201).json(cleanStudent(student));
});

app.patch("/api/students/:id/status", (req,res) => {
  const db = loadDB();
  const s = db.students.find(x => x.id === Number(req.params.id));
  if (!s) return res.status(404).json({error:"Student not found"});
  const allowed = ["Pending","Approved","Rejected"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
  s.status = req.body.status;
  saveDB(db);
  res.json(cleanStudent(s));
});

app.delete("/api/students/:id", (req,res) => {
  const db = loadDB();
  const id = Number(req.params.id);
  db.students = db.students.filter(s=>s.id!==id);
  db.allocations = db.allocations.filter(a=>a.studentId!==id);
  saveDB(db);
  res.json({ok:true});
});

// Merit + preference based allocation. Approved students only.
app.post("/api/allocate", (req,res) => {
  const db = loadDB();
  const reset = req.body && req.body.reset === true;
  if (reset) {
    db.allocations = [];
    db.students.forEach(s => { if (s.status === "Allocated") s.status = "Approved"; });
  }
  const allocatedStudentIds = new Set(db.allocations.map(a=>a.studentId));
  const students = db.students
    .filter(s => s.status === "Approved" && !allocatedStudentIds.has(s.id))
    .sort((a,b)=>Number(b.percentage)-Number(a.percentage));

  const results = [];
  for (const s of students) {
    let chosen = null;
    for (const prefId of (s.preferences||[])) {
      const d = db.departments.find(x=>x.id===Number(prefId));
      if (!d) continue;
      const filled = db.allocations.filter(a=>a.departmentId===d.id).length;
      if (Number(s.percentage) >= Number(d.minPercentage) && filled < d.seats) {
        chosen = d; break;
      }
    }
    if (chosen) {
      db.allocations.push({
        id: Date.now()+Math.floor(Math.random()*100000),
        studentId:s.id, departmentId:chosen.id, allocatedAt:new Date().toISOString()
      });
      s.status = "Allocated";
      results.push({studentId:s.id, departmentId:chosen.id, department:chosen.name});
    }
  }
  saveDB(db);
  res.json({allocated:results.length, results});
});

app.get("/api/export", (req,res) => {
  const db = loadDB();
  const header = ["Application ID","Name","Email","Phone","Percentage","Category","Status","Department"];
  const rows = db.students.map(s => {
    const a=db.allocations.find(x=>x.studentId===s.id);
    const d=a?db.departments.find(x=>x.id===a.departmentId):null;
    return [s.applicationId,s.name,s.email,s.phone,s.percentage,s.category,s.status,d?d.name:""];
  });
  const csv = [header,...rows].map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition","attachment; filename=admission-report.csv");
  res.send(csv);
});

app.get("/api/reset-demo", (req,res) => {
  saveDB(defaultDB);
  res.json({ok:true});
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));

ensureDB();
app.listen(PORT, ()=>console.log(`Student Admission System running at http://localhost:${PORT}`));

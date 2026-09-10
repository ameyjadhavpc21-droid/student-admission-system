const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
let departments=[];

const pageInfo={
 dashboard:["Dashboard","Admission overview and department capacity"],
 students:["Students","Manage applications, approvals and allocations"],
 admission:["New Admission","Create a student admission application"],
 departments:["Departments","Manage programs, seats and eligibility"],
 allocation:["Department Allocation","Run merit and preference based allocation"]
};

function toast(msg){const t=$("#toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",2500)}
function showPage(page){
  $$(".page").forEach(x=>x.classList.remove("active"));$("#"+page).classList.add("active");
  $$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $("#pageTitle").textContent=pageInfo[page][0];$("#pageSub").textContent=pageInfo[page][1];
  if(page==="dashboard")loadDashboard();
  if(page==="students")loadStudents();
  if(page==="admission")loadPrefs();
  if(page==="departments")loadDepartments();
  if(page==="allocation")loadAllocations();
}
$$(".nav[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));

async function loadDashboard(){
 const d=await fetch("/api/dashboard").then(r=>r.json());
 $("#total").textContent=d.total;$("#pending").textContent=d.pending;$("#approved").textContent=d.approved;$("#allocated").textContent=d.allocated;
 $("#capacity").innerHTML=d.departments.map(x=>`<div class="capacity-row"><div class="cap-head"><span><b>${x.code}</b> ${x.name}</span><span>${x.filled}/${x.seats}</span></div><div class="bar"><i style="width:${Math.min(100,x.filled/x.seats*100)}%"></i></div></div>`).join("");
}

async function loadDepartments(){
 departments=await fetch("/api/departments").then(r=>r.json());
 $("#deptList").innerHTML=departments.map(x=>`<div class="dept-card"><div class="dept-top"><span><span class="dept-code">${x.code}</span><b>${x.name}</b></span><span class="badge">${x.available} seats left</span></div><div class="dept-meta">${x.filled} filled · ${x.seats} total · Minimum ${x.minPercentage}%</div></div>`).join("");
}

async function loadPrefs(){
 if(!departments.length) departments=await fetch("/api/departments").then(r=>r.json());
 $("#prefList").innerHTML=departments.map((x,i)=>`<label class="pref-item"><input type="checkbox" value="${x.id}" onchange="renumberPrefs()"> <span><b>${i+1}.</b> ${x.name} (${x.code}) — min ${x.minPercentage}% · ${x.available} seats</span></label>`).join("");
}
function renumberPrefs(){
 const checked=[...document.querySelectorAll("#prefList input:checked")];
 document.querySelectorAll("#prefList .pref-item").forEach(el=>{const cb=el.querySelector("input");const b=el.querySelector("b");b.textContent=(checked.indexOf(cb)+1)+".";});
}

$("#admissionForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const f=new FormData(e.target), preferences=[...document.querySelectorAll("#prefList input:checked")].map(x=>Number(x.value));
 if(!preferences.length){toast("Select at least one department preference");return}
 const body=Object.fromEntries(f.entries());body.percentage=Number(body.percentage);body.preferences=preferences;
 const r=await fetch("/api/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok){toast(data.error||"Could not save");return}
 e.target.reset();document.querySelectorAll("#prefList input").forEach(x=>x.checked=false);
 toast(`Application ${data.applicationId} created successfully`);showPage("students");
});

async function loadStudents(){
 let list=await fetch("/api/students?q="+encodeURIComponent($("#search")?.value||"")).then(r=>r.json());
 const sf=$("#statusFilter")?.value||"";if(sf)list=list.filter(s=>s.status===sf);
 $("#studentTable").innerHTML=list.length?list.map((s,i)=>`<tr>
 <td><b>${s.applicationId}</b><br><small>${new Date(s.createdAt).toLocaleDateString()}</small></td>
 <td><b>${s.name}</b><br><small>${s.email}</small></td><td><b>${s.percentage}%</b></td>
 <td>${(s.preferences||[]).map(id=>{const d=departments.find(x=>x.id==id);return d?d.code:""}).join(" → ")||"—"}</td>
 <td><span class="status ${s.status}">${s.status}</span></td><td>${s.allocation?s.allocation.name:"—"}</td>
 <td><div class="row-actions">${s.status==="Pending"?`<button class="mini ok" onclick="setStatus(${s.id},'Approved')">Approve</button><button class="mini no" onclick="setStatus(${s.id},'Rejected')">Reject</button>`:""}<button class="mini" onclick="deleteStudent(${s.id})">Delete</button></div></td></tr>`).join(""):`<tr><td colspan="7">No students found.</td></tr>`;
}
async function setStatus(id,status){await fetch(`/api/students/${id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});toast(status==="Approved"?"Application approved":"Application rejected");loadStudents();loadDashboard()}
async function deleteStudent(id){if(!confirm("Delete this application?"))return;await fetch("/api/students/"+id,{method:"DELETE"});toast("Application deleted");loadStudents();loadDashboard()}
async function allocate(reset){
 if(!confirm(reset?"This will clear existing allocations and run again. Continue?":"Run allocation for all approved students?"))return;
 const r=await fetch("/api/allocate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset})});
 const d=await r.json();toast(`${d.allocated} student(s) allocated`);loadAllocations();loadDashboard();
}
async function loadAllocations(){
 const list=await fetch("/api/students").then(r=>r.json());
 const allocated=list.filter(s=>s.status==="Allocated").sort((a,b)=>b.percentage-a.percentage);
 $("#allocCount").textContent=allocated.length+" allocated";
 $("#allocationTable").innerHTML=allocated.length?allocated.map((s,i)=>`<tr><td>${i+1}</td><td>${s.applicationId}</td><td><b>${s.name}</b></td><td>${s.percentage}%</td><td><b>${s.allocation.code}</b> — ${s.allocation.name}</td><td>${new Date().toLocaleDateString()}</td></tr>`).join(""):`<tr><td colspan="6">No allocations yet. Approve students, then click Run Allocation.</td></tr>`;
}
$("#deptForm").addEventListener("submit",async e=>{
 e.preventDefault();const body=Object.fromEntries(new FormData(e.target).entries());
 body.seats=Number(body.seats);body.minPercentage=Number(body.minPercentage);
 const r=await fetch("/api/departments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 if(r.ok){e.target.reset();toast("Department added");departments=[];loadDepartments();}else toast("Could not add department");
});
function downloadReport(){window.location="/api/export"}
(async()=>{departments=await fetch("/api/departments").then(r=>r.json());loadDashboard()})();

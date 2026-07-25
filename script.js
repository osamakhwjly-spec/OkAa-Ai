let tasks = JSON.parse(localStorage.getItem("okaa_tasks")) || [];
let currentFilter = "all";
let chatHistory = [];
let xoTurn = "X";
let xoBoard = Array(9).fill("");

// === اهم سطر: الصق المفتاح الجديد حقك هنا ===
const GEMINI_API_KEY = "AQ.Ab8RN6KBL9gvXBwmxt56gJsEVkR5v2tuYncA0hZ-CpD4imsTZQ";

// 1. التنقل بين التبويبات
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll(".nav-btn,.tab").forEach(el => el.classList.remove("active"));
        e.target.classList.add("active");
        document.getElementById(e.target.dataset.tab).classList.add("active");
    }
});

// 2. تسجيل الدخول والخروج
function login(){
    if(document.getElementById("email").value){
        document.getElementById("loginScreen").classList.remove("active");
        document.getElementById("appScreen").classList.add("active");
        renderTasks();
        initXO();
    } else {
        alert("اكتب اي ايميل اول")
    }
}
function logout(){ location.reload(); }

// 3. المهام
function addTask(){
    let text=document.getElementById("taskInput").value.trim();
    let file=document.getElementById("taskImage").files[0];
    if(!text)return;
    let reader=new FileReader();
    reader.onload=()=>{tasks.push({id:Date.now(),text,img:reader.result,completed:false});saveTasks();renderTasks();};
    file?reader.readAsDataURL(file):reader.onload();
    document.getElementById("taskInput").value="";
}
function renderTasks(){
    let list=document.getElementById("taskList");list.innerHTML="";
    tasks.filter(t=>currentFilter==="all"||(currentFilter==="active"&&!t.completed)||(currentFilter==="completed"&&t.completed))
   .forEach(t=>{
        list.innerHTML+=`<li class="task ${t.completed?'completed':''}">
            <input type="checkbox" ${t.completed?'checked':''} onchange="toggleTask(${t.id})">
            <span>${t.text}</span>${t.img?`<img src="${t.img}">`:''}
            <button class="btn-delete" onclick="deleteTask(${t.id})">حذف</button>
        </li>`;
    });
    document.getElementById("counter").innerText=`متبقي لك ${tasks.filter(t=>!t.completed).length} مهام`;
}
function deleteTask(id){tasks=tasks.filter(t=>t.id!==id);saveTasks();renderTasks();}
function toggleTask(id){tasks.find(t=>t.id===id).completed^=1;saveTasks();renderTasks();}
function saveTasks(){localStorage.setItem("okaa_tasks",JSON.stringify(tasks));}

// 4. الحاسبة
let calcVal="";
function calc(v){
    if(v==="C")calcVal="";
    else if(v==="←")calcVal=calcVal.slice(0,-1);
    else if(v==="=")try{calcVal=eval(calcVal)}catch{calcVal="خطأ"}
    else calcVal+=v;
    document.getElementById("calcDisplay").value=calcVal;
}

// 5. لعبة XO ضد الكمبيوتر
function initXO(){
    let board=document.getElementById("xoBoard");board.innerHTML="";
    for(let i=0;i<9;i++){
        let cell=document.createElement("div");
        cell.className="xo-cell";
        cell.onclick=()=>playXO(i,cell);
        board.appendChild(cell);
    }
}
function playXO(i,cell){
    if(xoBoard[i]) return;
    xoBoard[i]="X"; cell.innerText="X";
    if(checkWin("X")) return setTimeout(()=>alert("فزت علي! 🔥"),100);
    setTimeout(aiMove, 500);
}
function aiMove(){
    let empty = xoBoard.map((v,i)=>v===""?i:null).filter(v=>v!==null);
    if(empty.length===0) return;
    let move = empty[Math.floor(Math.random()*empty.length)];
    xoBoard[move]="O";
    document.querySelectorAll(".xo-cell")[move].innerText="O";
    if(checkWin("O")) setTimeout(()=>alert("الكمبيوتر غلبك 😈"),100);
    if(empty.length===1) setTimeout(()=>alert("تعادل!"),100);
}
function checkWin(p){
    const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return wins.some(w=>w.every(i=>xoBoard[i]===p));
}
function resetXO(){xoBoard=Array(9).fill("");xoTurn="X";initXO();}

// 6. AI - كل الدوال
async function aiSuggestTask(){ await callGemini("اقترح 3 مهام قصيرة ومفيدة لشخص في السودان اليوم"); }
async function aiPlanDay(){
    let date = document.getElementById("calendarDate").value || "اليوم";
    await callGemini(`خطط لي يومي بتاريخ ${date} في السودان. جدول من الصباح للمساء بالنقاط`);
}
async function solveMathImage(){
    let file = document.getElementById("mathImage").files[0]; if(!file) return;
    let reader = new FileReader();
    reader.onload = async () => {
        addMsg("📸 حل لي المسألة دي","user");
        let base64 = reader.result.split(',')[1];
        let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,{
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({contents:[{role:"user", parts:[{text:"حل المسألة الرياضية في الصورة واشرح الخطوات بالعربي السوداني"},{inline_data:{mime_type:"image/jpeg", data:base64}}]}]})
        });
        let data = await res.json();
        addMsg(data.candidates[0].content.parts[0].text,"ai");
    }
    reader.readAsDataURL(file);
}
async function sendAI(){
    let input=document.getElementById("aiInput"); let msg=input.value.trim(); if(!msg)return;
    addMsg(msg,"user"); chatHistory.push({role:"user",parts:[{text:msg}]}); input.value="";
    await callGemini(msg);
}
async function callGemini(prompt){
    addMsg("OkAa Ai يكتب...","ai-loading");
    try{
        let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,{
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({contents:chatHistory.length?chatHistory:[{role:"user",parts:[{text:prompt}]}], systemInstruction:{parts:[{text:"انت OkAa Ai. مساعد ذكي داخل تطبيق. رد باللهجة السودانية مختصر وود"}]}})
        });
        let data = await res.json();
        let reply = data.candidates[0].content.parts[0].text;
        document.querySelector(".ai-loading").remove();
        addMsg(reply,"ai");
        chatHistory.push({role:"model",parts:[{text:reply}]});
    }catch(e){
        document.querySelector(".ai-loading").remove();
        addMsg("في مشكلة في الاتصال 😅 اتاكد من المفتاح والنت","ai");
    }
}
function addMsg(text,type){
    let box=document.getElementById("chatBox");
    box.innerHTML+=`<div class="msg ${type}">${text}</div>`;
    box.scrollTop=box.scrollHeight;
}

// 7. المايك + المشاركة + دارك مود
function startVoice(){
    let r=new (window.SpeechRecognition||window.webkitSpeechRecognition)();
    r.lang="ar-SD"; r.onresult=e=>{document.getElementById("aiInput").value=e.results[0][0].transcript;sendAI();};
    r.start();
}
function shareApp(){ if(navigator.share){navigator.share({title:"OkAa",text:"جرب تطبيق OkAa",url:window.location.href});}else{alert("انسخ الرابط: "+window.location.href);} }
document.getElementById("darkModeBtn").onclick=()=>document.body.classList.toggle("dark");
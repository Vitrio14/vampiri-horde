import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// CONFIGURAZIONE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAHm6VlxgUKnzZAj26EpgS6OWf21zDZ8vw",
  authDomain: "vampiri-horde.firebaseapp.com",
  projectId: "vampiri-horde",
  storageBucket: "vampiri-horde.firebasestorage.app",
  messagingSenderId: "932023666220",
  appId: "1:932023666220:web:5be5ea97be350173d83389",
  measurementId: "G-YY4822S6JQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// VARIABILI GLOBALI
let vendite = [];
let venditeMateriali = []; 
let inventarioDati = [];
let logs = [];
let saldoLogs = [];
let morsi = []; 
let dungeonDati = [];
let conquisteDati = [];
let saldoGlobale = 0;
let listaVampiri = [];
let comunicazioni = [];
let documenti = [];

let squadraDungeonTemp = [];
let squadraConquistaTemp = [];

const VALORE_UNITARIO = 30;

// UTILS
const fmt = (n) => {
    if (n === undefined || n === null) return "0";
    return new Intl.NumberFormat('it-IT').format(n);
};

// --- FUNZIONE NOTIFICA ---
const vampireToast = (msg, icon = 'info') => {
    const Toast = Swal.mixin({
        toast: true, 
        position: 'top-end', 
        showConfirmButton: false, 
        timer: 3000, 
        timerProgressBar: true,
        background: '#121212', 
        color: '#e0e0e0', 
        iconColor: icon === 'success' ? '#2ecc71' : (icon === 'error' ? '#e74c3c' : '#c5a059')
    });
    Toast.fire({ icon: icon, title: msg });
};
window.vampireToast = vampireToast;

// --- GESTIONE AUTENTICAZIONE (FIREBASE AUTH) ---

// Login Globale (Vampiri)
window.unlockSite = async () => {
    const passInput = document.getElementById('global-pass').value;
    const email = "vampiri@horde.it";
    
    if(!passInput) return vampireToast("Inserire la password per procedere.", "error");

    try {
        await signInWithEmailAndPassword(auth, email, passInput);
        vampireToast("Accesso alla Dinastia consentito.", "success");
    } catch (error) {
        vampireToast("Accesso negato. Il sigillo resta intatto.", "error");
    }
};

// Logout Globale (Tasto opzionale nella UI)
window.logoutVampiro = async () => {
    const res = await Swal.fire({
        title: 'Abbandonare la sessione?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#8b0000',
        background: '#111',
        color: '#fff'
    });
    if(res.isConfirmed) {
        await signOut(auth);
        location.reload();
    }
};

// Login Gestore (Admin)
window.checkAccess = async () => {
    const passInput = document.getElementById('admin-pass').value;
    const email = "vampiri.gestore@horde.it";

    if(!passInput) return vampireToast("Inserire la password gestore.", "error");

    try {
        await signInWithEmailAndPassword(auth, email, passInput);
        // Nascondiamo subito il login per evitare il "vuoto"
        document.getElementById('login-container-gestione').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        vampireToast("Accesso Gestore garantito.", "success");
    } catch (error) {
        vampireToast("Credenziali Gestore errate.", "error");
    }
};

// Monitoraggio dello stato di autenticazione
onAuthStateChanged(auth, (user) => {
    if (user) {
        startFirestoreListeners(); // Avviamo il recupero dati

        if (user.email === "vampiri.gestore@horde.it") {
            // Logica Admin
            document.getElementById('global-lock').style.display = 'none';
            document.getElementById('login-container-gestione').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            
            window.showSection('gestione'); 
            refreshAdminUI();
        } else if (user.email === "vampiri@horde.it") {
            // Logica Utente Base
            document.getElementById('global-lock').style.display = 'none';
            document.getElementById('admin-content').style.display = 'none';
            window.showSection('generale');
        }
    } else {
        // Se non loggato
        document.getElementById('global-lock').style.display = 'flex';
        document.getElementById('admin-content').style.display = 'none';
        const loginGest = document.getElementById('login-container-gestione');
        if(loginGest) {
            loginGest.style.display = 'flex'; // Usiamo flex per la centratura CSS
            loginGest.style.justifyContent = 'center';
            loginGest.style.alignItems = 'center';
        }
    }
});

function refreshAdminUI() {
    window.renderAdminMorsi(); 
    window.renderAdminTable(); 
    window.renderArchivioGestione(); 
    window.renderAdminLogs(); 
    window.renderAdminSaldoLogs();
    window.renderAdminDungeon(); 
    window.renderAdminConquiste();
    window.renderAdminMateriali(); 
    renderVampiriLists(); 
    renderDinamici(); 
    aggiornaStats(); 
    aggiornaStatsDungeon();
    aggiornaStatsConquiste();
}

window.logoutAdmin = async () => {
    const res = await Swal.fire({
        title: 'Chiudere la sessione?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#8b0000',
        background: '#111',
        color: '#fff'
    });
    
    if(res.isConfirmed) {
        await signOut(auth);
        vampireToast("Sessione chiusa correttamente.", "info");
        setTimeout(() => { location.reload(); }, 800);
    }
};

// --- LOGICA SEZIONI ---
window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    const link = Array.from(document.querySelectorAll('.nav-link')).find(l => l.getAttribute('onclick')?.includes(id));
    if(link) link.classList.add('active');
    window.scrollTo(0, 0); 
};

// --- GESTIONE DINAMICA (COMUNICAZIONI/DOC) ---
window.addDinamico = async (col) => {
    const pref = col === 'comunicazioni' ? 'adm-com-' : 'adm-doc-';
    const titolo = document.getElementById(pref + 'titolo').value.trim();
    const desc = document.getElementById(pref + 'desc').value.trim();
    const link = document.getElementById(pref + 'link').value.trim();
    const firma = document.getElementById(pref + 'firma').value.trim() || "Vitrio";

    if(!titolo || !desc) return vampireToast("Titolo e descrizione obbligatori", "error");
    await addDoc(collection(db, col), { titolo, desc, link, firma, timestamp: Date.now() });
    
    document.getElementById(pref + 'titolo').value = "";
    document.getElementById(pref + 'desc').value = "";
    document.getElementById(pref + 'link').value = "";
    document.getElementById(pref + 'firma').value = "";
    vampireToast("Elemento pubblicato con successo!", "success");
};

window.delDinamico = async (col, id) => {
    const res = await Swal.fire({ title: 'Rimuovere?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111', color: '#fff' });
    if(res.isConfirmed) {
        await deleteDoc(doc(db, col, id));
        vampireToast("Elemento rimosso correttamente.", "success");
    }
};

function renderDinamici() {
    const comBox = document.getElementById('comunicazioni-box');
    if(comBox) comBox.innerHTML = comunicazioni.map(c => `
        <div class="dyn-item">
            <span class="dyn-title">${c.titolo}</span>
            <span class="dyn-desc">${c.desc}</span>
            ${c.link ? `<a href="${c.link}" target="_blank" class="photo-link" style="margin-bottom:5px; font-size:0.6rem">APRI LINK</a>` : ''}
            <span class="dyn-signature">- Annuncio inviato da ${c.firma}</span>
        </div>`).join('');

    const docBox = document.getElementById('documenti-box');
    if(docBox) docBox.innerHTML = documenti.map(d => `
        <div class="dyn-item">
            <span class="dyn-title">${d.titolo}</span>
            <span class="dyn-desc">${d.desc}</span>
            ${d.link ? `<a href="${d.link}" target="_blank" class="photo-link" style="font-size:0.7rem">APRI DOCUMENTO</a>` : ''}
            <span class="dyn-signature" style="margin-top:4px">Caricato da: ${d.firma}</span>
        </div>`).join('');

    const admComList = document.getElementById('adm-com-list');
    if(admComList) admComList.innerHTML = comunicazioni.map(c => `
        <div style="font-size:0.7rem; border-bottom:1px solid #333; padding:5px; display:flex; justify-content:space-between; align-items:center;">
            <span>${c.titolo}</span><button class="btn-delete" onclick="delDinamico('comunicazioni','${c.id}')">X</button>
        </div>`).join('');

    const admDocList = document.getElementById('adm-doc-list');
    if(admDocList) admDocList.innerHTML = documenti.map(d => `
        <div style="font-size:0.7rem; border-bottom:1px solid #333; padding:5px; display:flex; justify-content:space-between; align-items:center;">
            <span>${d.titolo}</span><button class="btn-delete" onclick="delDinamico('documenti','${d.id}')">X</button>
        </div>`).join('');
}

// --- GESTIONE MEMBRI ---
window.aggiungiVampiro = async () => {
    const nome = document.getElementById('admin-vamp-nome').value.trim();
    const grado = document.getElementById('admin-vamp-grado').value.trim();
    if(!nome || !grado) return vampireToast("Inserisci nome e grado", "error");
    await setDoc(doc(db, "membri", nome), { nome, grado });
    document.getElementById('admin-vamp-nome').value = "";
    document.getElementById('admin-vamp-grado').value = "";
    vampireToast("Vampiro aggiunto alla Dinastia.", "success");
};

window.eliminaVampiro = async (id) => {
    const res = await Swal.fire({ title: 'Eliminare membro?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111', color: '#fff' });
    if(res.isConfirmed) {
        await deleteDoc(doc(db, "membri", id));
        vampireToast("Vampiro rimosso dal registro.", "success");
    }
};

function renderVampiriLists() {
    const ordineGradi = { 'originaria': 1, 'anziano': 2, 'vampiro': 3, 'neonato': 4 };
    listaVampiri.sort((a, b) => (ordineGradi[(a.grado || "").toLowerCase().trim()] || 99) - (ordineGradi[(b.grado || "").toLowerCase().trim()] || 99));

    const listaDinamica = document.getElementById('lista-membri-dinamica');
    if (listaDinamica) listaDinamica.innerHTML = listaVampiri.map(v => `<p style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 5px;"><strong>${v.nome}:</strong> ${v.grado}</p>`).join('');

    const selects = document.querySelectorAll('.vampiro-select-list');
    const options = `<option value="">-- Seleziona Vampiro --</option>` + listaVampiri.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
    selects.forEach(s => { const currentVal = s.value; s.innerHTML = options; s.value = currentVal; });

    const tbody = document.getElementById('admin-vampiri-body');
    if(tbody) tbody.innerHTML = listaVampiri.map(v => `<tr><td>${v.nome}</td><td>${v.grado}</td><td><button class="btn-delete" onclick="eliminaVampiro('${v.nome}')">Elimina</button></td></tr>`).join('');
}

// --- LOGICA VENDITA MATERIALI ---
window.updateMatTot = () => {
    const qtyEl = document.getElementById('mat-qty');
    const unEl = document.getElementById('mat-prezzo-un');
    const totEl = document.getElementById('mat-prezzo-tot');
    if(qtyEl && unEl && totEl) {
        const qty = parseFloat(qtyEl.value) || 0;
        const un = parseFloat(unEl.value) || 0;
        totEl.value = (qty * un).toFixed(0);
    }
};

window.registraVenditaMateriali = async () => {
    try {
        const nomeEl = document.getElementById('mat-vamp-nome');
        const tipoEl = document.getElementById('mat-tipo');
        const acqEl = document.getElementById('mat-acquirente');
        const qtyEl = document.getElementById('mat-qty');
        const prUnEl = document.getElementById('mat-prezzo-un');
        const pProEl = document.getElementById('mat-perc-propria'); // L'utente inserisce SOLO questa
        const fotoEl = document.getElementById('mat-foto');

        if(!nomeEl || !tipoEl || !qtyEl || !prUnEl) {
            return vampireToast("Errore di interfaccia (campi mancanti).", "error");
        }

        const nome = nomeEl.value;
        const tipo = tipoEl.value.trim();
        const acquirente = acqEl ? acqEl.value.trim() : "N/D";
        const qty = parseFloat(qtyEl.value);
        const prezzoUn = parseFloat(prUnEl.value);

        if(!nome || !tipo || isNaN(qty) || isNaN(prezzoUn) || qty <= 0 || prezzoUn <= 0) {
            return vampireToast("Inserisci tutti i dati obbligatori in modo corretto.", "error");
        }

        const prezzoTot = qty * prezzoUn;
        
        // L'utente inserisce la % Propria. Il resto va alla Dinastia in automatico.
        const percPro = parseFloat(pProEl ? pProEl.value : 0) || 0;
        const percDin = 100 - percPro; // Calcolo automatico della % Dinastia

        const foto = (fotoEl && fotoEl.value) ? fotoEl.value : "#";

        // Il calcolo indipendente della percentuale sempre e solo sul totale (prezzoTot)
        const vPro = (prezzoTot * percPro) / 100;
        const vDin = (prezzoTot * percDin) / 100;

        const now = new Date();
        await addDoc(collection(db, "vendite_materiali"), {
            vampiro: nome,
            materiale: tipo,
            acquirente: acquirente,
            qty: qty,
            prezzoUn: prezzoUn,
            prezzoTot: prezzoTot,
            pPro: percPro,
            pDin: percDin,   // Salviamo anche la % calcolata per storicità
            vPro: vPro,
            vDin: vDin,      // Salviamo la quota della dinastia
            timestamp: Date.now(),
            dataStr: now.toLocaleDateString('it-IT'),
            ora: now.toLocaleTimeString('it-IT'),
            settimanaEtichetta: getWeekYearKey(now)
        });

        vampireToast("Vendita materiali registrata.", "success");

        // Reset campi
        [tipoEl, acqEl, qtyEl, prUnEl, pProEl, fotoEl].forEach(el => {
            if(el) el.value = "";
        });
        const totEl = document.getElementById('mat-prezzo-tot');
        if(totEl) totEl.value = "";

    } catch (error) {
        console.error("Errore salvataggio materiali: ", error);
        vampireToast("Errore durante la registrazione.", "error");
    }
};

window.renderMateriali = () => {
    const tbody = document.getElementById('lista-materiali');
    if(!tbody) return;
    const searchInput = document.getElementById('search-materiali');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const week = getWeekYearKey(new Date());

    tbody.innerHTML = venditeMateriali
        .filter(m => m.settimanaEtichetta === week && (
            (m.vampiro || "").toLowerCase().includes(search) || 
            (m.materiale || "").toLowerCase().includes(search) || 
            (m.acquirente || "").toLowerCase().includes(search)
        ))
        .sort((a,b) => b.timestamp - a.timestamp)
        .map(m => `
        <tr>
            <td style="font-size:0.7rem;"><span class="ts-label">${m.dataStr || ''}</span> <br> <strong>${m.ora || ''}</strong></td>
            <td>${m.vampiro || ''}</td>
            <td style="color:var(--gold-accent)">${m.materiale || ''}</td>
            <td>${m.acquirente || ''}</td>
            <td>${fmt(m.qty)}</td>
            <td style="color:var(--gold-dim)">${fmt(m.prezzoTot)} cr</td>
            <td style="color:var(--withdraw-red)">${fmt(m.vDin)} cr <small>(${m.pDin || 0}%)</small></td>
            <td style="color:var(--success-green)">${fmt(m.vPro)} cr <small>(${m.pPro || 0}%)</small></td>
            <td><a href="${m.foto}" target="_blank" class="photo-link">FOTO</a></td>
        </tr>`).join('');
    
    aggiornaStatsMateriali();
};

function aggiornaStatsMateriali() {
    const week = getWeekYearKey(new Date());
    const curr = venditeMateriali.filter(m => m.settimanaEtichetta === week);
    if(document.getElementById('mat-tot-qty-sett')) document.getElementById('mat-tot-qty-sett').innerText = fmt(curr.reduce((a,b) => a + (b.qty || 0), 0));
    if(document.getElementById('mat-tot-crediti-sett')) document.getElementById('mat-tot-crediti-sett').innerText = fmt(curr.reduce((a,b) => a + (b.prezzoTot || 0), 0)) + " cr";
    if(document.getElementById('mat-tot-dinastia-sett')) document.getElementById('mat-tot-dinastia-sett').innerText = fmt(curr.reduce((a,b) => a + (b.vDin || 0), 0)) + " cr";
    if(document.getElementById('mat-tot-count-sett')) document.getElementById('mat-tot-count-sett').innerText = curr.length;
}

// Logica inserimento visualizzazione per gestione (Admin)
window.renderAdminMateriali = () => {
    let container = document.getElementById('admin-materiali-container');
    if(!container) {
        // Se non esiste nell'HTML, lo creo dinamicamente e lo aggiungo nella sezione admin
        const adminContent = document.getElementById('admin-content');
        if(adminContent) {
            const wrapper = document.createElement('div');
            wrapper.className = "vamp-card";
            wrapper.innerHTML = `
                <h2>Archivio Database Vendita Materiali</h2>
                <div class="search-box">
                    <input type="text" id="search-admin-mat" placeholder="Filtra materiale o vampiro..." onkeyup="window.renderAdminMateriali()">
                </div>
                <div class="scroll-container" id="admin-materiali-container" style="max-height: 400px;"></div>
            `;
            const logOutBtn = adminContent.querySelector('button[onclick="window.logoutAdmin()"]');
            if(logOutBtn) {
                adminContent.insertBefore(wrapper, logOutBtn);
            } else {
                adminContent.appendChild(wrapper);
            }
            container = document.getElementById('admin-materiali-container');
        } else {
            return;
        }
    }

    const searchInput = document.getElementById('search-admin-mat');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

    const gruppi = {};
    venditeMateriali.forEach(m => { 
        if(!gruppi[m.settimanaEtichetta]) gruppi[m.settimanaEtichetta] = []; 
        gruppi[m.settimanaEtichetta].push(m); 
    });

    container.innerHTML = Object.keys(gruppi).sort().reverse().map(key => {
        const filtered = gruppi[key].filter(m => 
            (m.vampiro || "").toLowerCase().includes(searchTerm) || 
            (m.materiale || "").toLowerCase().includes(searchTerm) ||
            (m.acquirente || "").toLowerCase().includes(searchTerm)
        ).sort((a,b) => b.timestamp - a.timestamp);

        if(filtered.length === 0 && searchTerm !== "") return "";
        const range = getWeekRangeLabel(key);
        const weekTotalQty = filtered.reduce((sum, m) => sum + (m.qty || 0), 0);
        const weekTotalCr = filtered.reduce((sum, m) => sum + (m.prezzoTot || 0), 0);
        const weekTotalDin = filtered.reduce((sum, m) => sum + (m.vDin || 0), 0);
        
        return `<div class="week-archive-block">
            <div class="week-title">${range} | Transazioni: ${filtered.length} | Qty: <span style="color: var(--gold-dim);">${fmt(weekTotalQty)}x</span> | Valore Tot: <span style="color: var(--gold-dim);">${fmt(weekTotalCr)} cr</span> | Quota Dinastia: <span style="color: var(--gold-dim);">${fmt(weekTotalDin)} cr</span></div>
            <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>Data/Ora</th><th>Vampiro</th><th>Materiale</th><th>Acquirente</th><th>Qty</th><th>Totale (cr)</th><th>Propria (cr)</th><th>Dinastia (cr)</th><th>Azione</th></tr></thead>
                    <tbody>${filtered.map(m => `
                        <tr>
                            <td style="font-size:0.65rem"><span class="ts-label">${m.dataStr || ''}</span><br><strong>${m.ora || ''}</strong></td>
                            <td>${m.vampiro || ''}</td>
                            <td style="color: var(--gold-accent);">${m.materiale || ''}</td>
                            <td>${m.acquirente || ''}</td>
                            <td style="color: var(--gold-dim);">${fmt(m.qty)}</td>
                            <td>${fmt(m.prezzoTot)}</td>
                            <td>${fmt(m.vPro)} <small>(${m.pPro || 0}%)</small></td>
                            <td>${fmt(m.vDin)} <small>(${m.pDin || 0}%)</small></td>
                            <td><button class="btn-delete" onclick="window.adminDeleteMat('${m.id}')">X</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');
};

window.adminDeleteMat = async (id) => {
    const res = await Swal.fire({ title: 'Elimina transazione materiale?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) { 
        await deleteDoc(doc(db, "vendite_materiali", id)); 
        vampireToast("Record rimosso con successo.", "success"); 
    }
};

// --- LOGICA MORSI ---
window.registraMorso = async () => {
    const predatore = document.getElementById('morso-vamp-select').value;
    const tipoVittima = document.getElementById('morso-tipo-vittima').value;
    const nomeVittima = document.getElementById('morso-umano-nome').value.trim();
    
    if(!predatore || !nomeVittima) return vampireToast("Dati del morso incompleti.", "error");

    const now = new Date();
    await addDoc(collection(db, "morsi"), {
        vampiro: predatore,
        umano: nomeVittima,
        tipoVittima: tipoVittima,
        timestamp: Date.now(),
        dataStr: now.toLocaleDateString('it-IT'),
        ora: now.toLocaleTimeString('it-IT'),
        settimanaEtichetta: getWeekYearKey(now)
    });

    vampireToast("Morso registrato negli annali.", "success");
    document.getElementById('morso-umano-nome').value = "";
};

window.renderMorsi = () => {
    const tbody = document.getElementById('lista-morsi-correnti');
    if(!tbody) return;

    const currentWeek = getWeekYearKey(new Date());
    const morsiSettimana = morsi.filter(m => m.settimanaEtichetta === currentWeek);

    tbody.innerHTML = morsiSettimana.sort((a,b) => b.timestamp - a.timestamp).map(m => {
        const tVittima = m.tipoVittima || 'umano'; 
        let statusHTML = "";
        
        if (tVittima === 'vampiro') {
            statusHTML = '<span class="status-badge status-eterno">Eterno</span>';
        } else {
            const oraAttuale = Date.now();
            const diffOre = (oraAttuale - m.timestamp) / (1000 * 60 * 60);
            const statusClass = diffOre < 24 ? 'status-attivo' : 'status-passato';
            const statusText = diffOre < 24 ? 'Attivo' : 'Passato';
            statusHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
        }

        const iconTipo = `<span class="type-badge type-${tVittima}">${tVittima}</span>`;

        return `
            <tr>
                <td><span class="ts-label">${m.dataStr}</span><strong>${m.ora}</strong></td>
                <td>${m.vampiro}</td>
                <td>${iconTipo} ${m.umano}</td>
                <td>${statusHTML}</td>
            </tr>`;
    }).join('');

    const predUmaniSett = morsiSettimana.filter(m => (m.tipoVittima || 'umano') === 'umano');
    const predUmaniTot = morsi.filter(m => (m.tipoVittima || 'umano') === 'umano');
    renderClassificaMorsi(predUmaniSett, 'vampiro', 'morsi-vamp-sett-box');
    renderClassificaMorsi(predUmaniTot, 'vampiro', 'morsi-vamp-tot-box');

    const predVampiriSett = morsiSettimana.filter(m => m.tipoVittima === 'vampiro');
    const predVampiriTot = morsi.filter(m => m.tipoVittima === 'vampiro');
    renderClassificaMorsi(predVampiriSett, 'vampiro', 'morsi-vampiri-predatori-sett-box');
    renderClassificaMorsi(predVampiriTot, 'vampiro', 'morsi-vampiri-predatori-tot-box');

    const vittimeUmaneSett = morsiSettimana.filter(m => (m.tipoVittima || 'umano') === 'umano');
    const vittimeUmaneTot = morsi.filter(m => (m.tipoVittima || 'umano') === 'umano');
    renderClassificaMorsi(vittimeUmaneSett, 'umano', 'morsi-umani-sett-box');
    renderClassificaMorsi(vittimeUmaneTot, 'umano', 'morsi-umani-tot-box');

    const vittimeVampSett = morsiSettimana.filter(m => m.tipoVittima === 'vampiro');
    const vittimeVampTot = morsi.filter(m => m.tipoVittima === 'vampiro');
    renderClassificaMorsi(vittimeVampSett, 'umano', 'morsi-vampiri-vittime-sett-box');
    renderClassificaMorsi(vittimeVampTot, 'umano', 'morsi-vampiri-vittime-tot-box');

    const containerArchivio = document.getElementById('archivio-morsi-container');
    if(containerArchivio) {
        const gruppi = {};
        morsi.forEach(m => { if(!gruppi[m.settimanaEtichetta]) gruppi[m.settimanaEtichetta] = []; gruppi[m.settimanaEtichetta].push(m); });
        
        containerArchivio.innerHTML = Object.keys(gruppi).sort().reverse().map(key => `
            <div class="week-archive-block">
                <div class="week-title">${getWeekRangeLabel(key)} | Totale Morsi: ${gruppi[key].length}</div>
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Data/Ora</th><th>Predatore</th><th>Vittima</th></tr></thead>
                        <tbody>${gruppi[key].sort((a,b) => b.timestamp - a.timestamp).map(m => `<tr><td>${m.dataStr} ${m.ora}</td><td>${m.vampiro}</td><td><small>[${(m.tipoVittima || 'umano').toUpperCase()}]</small> ${m.umano}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`).join('');
    }
};

function renderClassificaMorsi(data, chiave, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    const conteggio = {};
    data.forEach(m => { const val = m[chiave]; conteggio[val] = (conteggio[val] || 0) + 1; });
    const rank = Object.entries(conteggio).sort((a,b) => b[1] - a[1]);
    
    container.innerHTML = rank.length === 0 ? "<p style='font-size:0.7rem; opacity:0.3; text-align:center;'>Nessun dato</p>" : 
    rank.map((item, index) => `
        <div class="rank-item ${index < 3 ? 'rank-top' + (index + 1) : ''}">
            <span>${index + 1}. ${item[0]}</span>
            <strong style="color: var(--gold-dim);">${item[1]} morsi</strong>
        </div>`).join('');
}

// --- LOGICA DUNGEON ---
window.aggiungiMembroSquadra = () => {
    const nome = document.getElementById('dungeon-select-membro').value;
    if(!nome) return;
    if(squadraDungeonTemp.includes(nome)) return vampireToast("Membro già in squadra.", "error");
    squadraDungeonTemp.push(nome);
    renderSquadraTemp();
};

function renderSquadraTemp() {
    const box = document.getElementById('squadra-temporanea');
    if(!box) return;
    box.innerHTML = squadraDungeonTemp.map(n => `
        <div class="status-badge status-attivo" style="display:flex; align-items:center; gap:8px;">
            ${n} <span onclick="window.rimuoviMembroSquadra('${n}')" style="cursor:pointer; font-weight:bold;">×</span>
        </div>`).join('');
}

window.rimuoviMembroSquadra = (nome) => {
    squadraDungeonTemp = squadraDungeonTemp.filter(n => n !== nome);
    renderSquadraTemp();
};

window.avviaDungeon = async () => {
    const livello = document.getElementById('dungeon-livello').value;
    const esito = document.getElementById('dungeon-esito').value;
    if(squadraDungeonTemp.length === 0) return vampireToast("Seleziona almeno un membro.", "error");

    const now = new Date();
    const oraInizio = Date.now();
    await addDoc(collection(db, "dungeon"), {
        squadra: squadraDungeonTemp,
        livello: livello,
        esito: esito,
        inizio: oraInizio,
        scadenza: oraInizio + (30 * 60 * 1000),
        dataStr: now.toLocaleDateString('it-IT'),
        oraStr: now.toLocaleTimeString('it-IT')
    });

    squadraDungeonTemp = [];
    renderSquadraTemp();
    vampireToast("Incursione registrata con successo.", "success");
};

window.renderDungeon = () => {
    updateDungeonTimers();
    aggiornaStatsDungeon();
};

function aggiornaStatsDungeon() {
    const total = dungeonDati.length;
    const success = dungeonDati.filter(d => d.esito === 'successo').length;
    const fail = dungeonDati.filter(d => d.esito === 'fallimento').length;

    if(document.getElementById('stat-dungeon-tot')) document.getElementById('stat-dungeon-tot').innerText = total;
    if(document.getElementById('stat-dungeon-vittorie')) document.getElementById('stat-dungeon-vittorie').innerText = success;
    if(document.getElementById('stat-dungeon-sconfitte')) document.getElementById('stat-dungeon-sconfitte').innerText = fail;

    if(document.getElementById('admin-stat-dungeon-tot')) document.getElementById('admin-stat-dungeon-tot').innerText = total;
    if(document.getElementById('admin-stat-dungeon-vittorie')) document.getElementById('admin-stat-dungeon-vittorie').innerText = success;
    if(document.getElementById('admin-stat-dungeon-sconfitte')) document.getElementById('admin-stat-dungeon-sconfitte').innerText = fail;
}

function updateDungeonTimers() {
    const tbody = document.getElementById('lista-dungeon');
    if(!tbody) return;
    const searchTerm = document.getElementById('search-dungeon').value.toLowerCase();

    tbody.innerHTML = dungeonDati
        .filter(d => (d.squadra || []).join(' ').toLowerCase().includes(searchTerm) || (d.livello || "").toString().includes(searchTerm))
        .sort((a,b) => b.inizio - a.inizio)
        .map(d => {
            const oraAttuale = Date.now();
            const diff = (d.scadenza || 0) - oraAttuale;
            let timerHTML = "";

            if(diff > 0) {
                const min = Math.floor(diff / 60000);
                const sec = Math.floor((diff % 60000) / 1000);
                timerHTML = `<span class="status-badge status-attivo">${min}m ${sec}s</span>`;
            } else {
                timerHTML = `<span class="status-badge status-passato">Concluso</span>`;
            }

            const esitoText = d.esito ? d.esito.toUpperCase() : "N/D";
            const esitoClass = d.esito === 'successo' ? 'status-attivo' : 'status-passato';

            return `
                <tr>
                    <td><span class="ts-label">${d.dataStr || ''}</span> <strong>${(d.squadra || []).join(', ')}</strong></td>
                    <td>Livello ${d.livello || '?'}</td>
                    <td><span class="status-badge ${esitoClass}">${esitoText}</span></td>
                    <td>${timerHTML}</td>
                    <td style="font-size:0.7rem; opacity:0.6;">${d.oraStr || new Date(d.inizio || 0).toLocaleTimeString()}</td>
                </tr>`;
        }).join('');
}

setInterval(updateDungeonTimers, 1000);

// --- LOGICA CONQUISTE ---
window.aggiungiMembroConquista = () => {
    const nome = document.getElementById('conquista-select-membro').value;
    if(!nome) return;
    if(squadraConquistaTemp.includes(nome)) return vampireToast("Membro già in squadra.", "error");
    squadraConquistaTemp.push(nome);
    renderSquadraConquistaTemp();
};

function renderSquadraConquistaTemp() {
    const box = document.getElementById('squadra-conquista-temporanea');
    if(!box) return;
    box.innerHTML = squadraConquistaTemp.map(n => `
        <div class="status-badge status-attivo" style="display:flex; align-items:center; gap:8px; border-color: var(--gold-accent);">
            ${n} <span onclick="window.rimuoviMembroConquista('${n}')" style="cursor:pointer; font-weight:bold;">×</span>
        </div>`).join('');
}

window.rimuoviMembroConquista = (nome) => {
    squadraConquistaTemp = squadraConquistaTemp.filter(n => n !== nome);
    renderSquadraConquistaTemp();
};

window.registraConquista = async () => {
    const zona = document.getElementById('conquista-zona').value.trim();
    const esito = document.getElementById('conquista-esito').value;
    if(squadraConquistaTemp.length === 0 || !zona) return vampireToast("Inserire squadra e zona.", "error");

    const now = new Date();
    await addDoc(collection(db, "conquiste"), {
        squadra: squadraConquistaTemp,
        zona: zona,
        esito: esito,
        timestamp: Date.now(),
        dataStr: now.toLocaleDateString('it-IT') + " " + now.toLocaleTimeString('it-IT')
    });

    squadraConquistaTemp = [];
    document.getElementById('conquista-zona').value = "";
    renderSquadraConquistaTemp();
    vampireToast("Operazione di conquista registrata.", "success");
};

window.renderConquiste = () => {
    const tbody = document.getElementById('lista-conquiste');
    if(!tbody) return;
    const searchTerm = document.getElementById('search-conquiste').value.toLowerCase();

    tbody.innerHTML = conquisteDati
        .filter(c => (c.squadra || []).join(' ').toLowerCase().includes(searchTerm) || (c.zona || "").toLowerCase().includes(searchTerm))
        .sort((a,b) => b.timestamp - a.timestamp)
        .map(c => {
            const esitoText = c.esito ? c.esito.toUpperCase() : "N/D";
            const esitoClass = c.esito === 'successo' ? 'status-attivo' : 'status-passato';
            return `
            <tr>
                <td style="font-size:0.7rem;">${c.dataStr || ''}</td>
                <td>${(c.squadra || []).join(', ')}</td>
                <td style="color: var(--gold-accent);">${c.zona || ''}</td>
                <td><span class="status-badge ${esitoClass}">${esitoText}</span></td>
            </tr>`;
        }).join('');

    aggiornaStatsConquiste();
};

function aggiornaStatsConquiste() {
    const total = conquisteDati.length;
    const success = conquisteDati.filter(c => c.esito === 'successo').length;
    const fail = conquisteDati.filter(c => c.esito === 'fallimento').length;

    if(document.getElementById('stat-conquista-tot')) document.getElementById('stat-conquista-tot').innerText = total;
    if(document.getElementById('stat-conquista-vittorie')) document.getElementById('stat-conquista-vittorie').innerText = success;
    if(document.getElementById('stat-conquista-sconfitte')) document.getElementById('stat-conquista-sconfitte').innerText = fail;

    if(document.getElementById('admin-stat-conquista-tot')) document.getElementById('admin-stat-conquista-tot').innerText = total;
    if(document.getElementById('admin-stat-conquista-vittorie')) document.getElementById('admin-stat-conquista-vittorie').innerText = success;
    if(document.getElementById('admin-stat-conquista-sconfitte')) document.getElementById('admin-stat-conquista-sconfitte').innerText = fail;
}

// --- LOGICA ADMIN (RESA) ---

window.renderAdminDungeon = () => {
    const container = document.getElementById('admin-dungeon-body');
    if(!container) return;
    const searchTerm = document.getElementById('search-admin-dungeon').value.toLowerCase();

    container.innerHTML = dungeonDati
        .filter(d => (d.squadra || []).join(' ').toLowerCase().includes(searchTerm) || (d.livello || "").toString().includes(searchTerm))
        .sort((a,b) => b.inizio - a.inizio)
        .map(d => {
            const esitoText = d.esito ? d.esito.toUpperCase() : "N/D";
            return `
            <tr>
                <td style="font-size:0.65rem;">${d.dataStr || ''}<br>${d.oraStr || ''}</td>
                <td>${(d.squadra || []).join(', ')}</td>
                <td>Liv ${d.livello || ''}</td>
                <td><small>${esitoText}</small></td>
                <td><button class="btn-delete" onclick="window.adminDeleteDungeon('${d.id}')">X</button></td>
            </tr>`;
        }).join('');
};

window.adminDeleteDungeon = async (id) => {
    const res = await Swal.fire({ title: 'Eliminare Dungeon?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) {
        await deleteDoc(doc(db, "dungeon", id));
        vampireToast("Dungeon eliminato.", "success");
    }
};

window.renderAdminConquiste = () => {
    const container = document.getElementById('admin-conquiste-body');
    if(!container) return;
    const searchTerm = document.getElementById('search-admin-conquiste').value.toLowerCase();

    container.innerHTML = conquisteDati
        .filter(c => (c.squadra || []).join(' ').toLowerCase().includes(searchTerm) || (c.zona || "").toLowerCase().includes(searchTerm))
        .sort((a,b) => b.timestamp - a.timestamp)
        .map(c => {
            const esitoText = c.esito ? c.esito.toUpperCase() : "N/D";
            return `
            <tr>
                <td style="font-size:0.65rem;">${c.dataStr || ''}</td>
                <td>${(c.squadra || []).join(', ')}</td>
                <td>${c.zona || ''}</td>
                <td><small>${esitoText}</small></td>
                <td><button class="btn-delete" onclick="window.adminDeleteConquista('${c.id}')">X</button></td>
            </tr>`;
        }).join('');
};

window.adminDeleteConquista = async (id) => {
    const res = await Swal.fire({ title: 'Eliminare Conquista?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) {
        await deleteDoc(doc(db, "conquiste", id));
        vampireToast("Conquista eliminata.", "success");
    }
};

window.renderAdminMorsi = () => {
    const tbody = document.getElementById('admin-morsi-table-body');
    if (!tbody) return;
    const searchTerm = document.getElementById('search-admin-morsi').value.toLowerCase();
    
    tbody.innerHTML = morsi
        .filter(m => (m.vampiro || "").toLowerCase().includes(searchTerm) || (m.umano || "").toLowerCase().includes(searchTerm))
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(m => {
            const tVittima = m.tipoVittima || 'umano'; 
            return `
            <tr>
                <td style="font-size:0.65rem;">${m.dataStr || ''}<br>${m.ora || ''}</td>
                <td>${m.vampiro || ''}</td>
                <td><small>[${tVittima.toUpperCase()}]</small> ${m.umano || ''}</td>
                <td style="font-size:0.6rem; opacity:0.6;">${getWeekRangeLabel(m.settimanaEtichetta || "")}</td>
                <td><button class="btn-delete" onclick="window.adminDeleteMorso('${m.id}')">X</button></td>
            </tr>`;
        }).join('');
};

window.adminDeleteMorso = async (id) => {
    const res = await Swal.fire({ title: 'Eliminare morso?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if (res.isConfirmed) await deleteDoc(doc(db, "morsi", id));
};

// --- CLASSIFICHE VENDITE ---
function renderClassifiche() {
    const currentWeek = getWeekYearKey(new Date());
    const mapSett = {};
    
    vendite.filter(v => v.settimanaEtichetta === currentWeek).forEach(v => {
        if (!mapSett[v.nome]) mapSett[v.nome] = { carbonio: 0, crediti: 0 };
        mapSett[v.nome].carbonio += (v.qty || 0); 
        mapSett[v.nome].crediti += (v.dinastia || 0);
    });
    const rankSett = Object.entries(mapSett).sort((a,b) => b[1].carbonio - a[1].carbonio);

    const mapSempre = {};
    vendite.forEach(v => {
        if (!mapSempre[v.nome]) mapSempre[v.nome] = { carbonio: 0, crediti: 0 };
        mapSempre[v.nome].carbonio += (v.qty || 0); 
        mapSempre[v.nome].crediti += (v.dinastia || 0);
    });
    const rankSempre = Object.entries(mapSempre).sort((a,b) => b[1].crediti - a[1].crediti);

    const generateHtml = (arr) => {
        if(arr.length === 0) return "<p style='font-size:0.7rem; opacity:0.3; text-align:center;'>Nessun dato</p>";
        return arr.map((item, index) => `
            <div class="rank-item ${index < 3 ? 'rank-top' + (index + 1) : ''}">
                <span style="font-weight:600;">${index + 1}. ${item[0]}</span>
                <div style="text-align: right; line-height: 1.2;">
                    <strong style="display:block; color: var(--gold-dim); font-size:0.75rem;">${fmt(item[1].carbonio)}x Carb.</strong>
                    <small style="color:var(--gold-accent); font-size:0.6rem; text-transform:uppercase;">${fmt(item[1].crediti)} cr</small> 
                </div>
            </div>`).join('');
    };

    document.getElementById('top-settimana-box').innerHTML = generateHtml(rankSett);
    document.getElementById('top-sempre-box').innerHTML = generateHtml(rankSempre);
}

window.movimentoSaldo = async () => {
    const nome = document.getElementById('saldo-nome').value;
    const importo = parseInt(document.getElementById('saldo-importo').value);
    const azione = document.getElementById('saldo-azione').value;
    const motivo = document.getElementById('saldo-motivo').value;
    if(!nome || !importo || !motivo) return vampireToast("Compila tutti i campi richiesti.", "error");
    const nuovoSaldo = azione === "preleva" ? saldoGlobale - importo : saldoGlobale + importo;
    if(nuovoSaldo < 0) return vampireToast("Saldo insufficiente!", "error");
    const now = new Date();
    await setDoc(doc(db, "config", "saldo"), { valore: nuovoSaldo }, { merge: true });
    await addDoc(collection(db, "saldo_logs"), {
        utente: nome, tipo: azione, qty: importo, motivo, timestamp: Date.now(), 
        dataStr: now.toLocaleDateString('it-IT'), ora: now.toLocaleTimeString('it-IT')
    });
    vampireToast(`Operazione di ${azione} completata.`, "success");
    document.getElementById('saldo-importo').value = ""; document.getElementById('saldo-motivo').value = "";
};

window.renderSaldoLogs = () => {
    const box = document.getElementById('saldo-logs-box');
    if(!box) return;
    const searchTerm = document.getElementById('search-saldo-logs').value.toLowerCase();
    box.innerHTML = saldoLogs.filter(l => (l.utente || "").toLowerCase().includes(searchTerm) || (l.motivo || "").toLowerCase().includes(searchTerm))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente || ''}</strong> <span style="color: ${l.tipo === 'preleva' ? 'var(--withdraw-red)' : 'var(--success-green)'}">${l.tipo || ''}</span> <span style="color: var(--gold-dim);">${fmt(l.qty)}</span> cr</span>
                <span class="log-time">${l.dataStr || ''} ${l.ora || ''}</span>
            </div>
            <div class="log-causale">Motivo: ${l.motivo || ''}</div>
        </div>`).join('');
};

function popolaFiltroSettimane() {
    const filter = document.getElementById('calc-period-filter');
    if(!filter) return;
    const valCorrente = filter.value;
    const settimaneUniche = [...new Set(vendite.map(v => v.settimanaEtichetta))].filter(Boolean).sort().reverse();
    
    let options = `<option value="current">Settimana Corrente</option><option value="all">Totale Storico</option>`;
    settimaneUniche.forEach(s => {
        const range = getWeekRangeLabel(s);
        options += `<option value="${s}">Settimana: ${range}</option>`;
    });
    filter.innerHTML = options;
    filter.value = valCorrente;
}

window.eseguiCalcolo = () => {
    const nomeInput = document.getElementById('calc-search-name').value;
    const periodo = document.getElementById('calc-period-filter').value;
    if(!nomeInput) return vampireToast("Seleziona un vampiro per il calcolo.", "error");
    
    const resBox = document.getElementById('calc-result');
    let filtrati = [];

    if(periodo === "all") {
        filtrati = vendite.filter(v => v.nome === nomeInput);
    } else if(periodo === "current") {
        const currentWeek = getWeekYearKey(new Date());
        filtrati = vendite.filter(v => v.settimanaEtichetta === currentWeek && v.nome === nomeInput);
    } else {
        filtrati = vendite.filter(v => v.settimanaEtichetta === periodo && v.nome === nomeInput);
    }

    if(filtrati.length === 0) { 
        resBox.style.display = "none"; 
        return vampireToast("Nessun record trovato per i parametri scelti.", "error"); 
    }
    
    const totQty = filtrati.reduce((a, b) => a + (b.qty || 0), 0);
    const totCr = filtrati.reduce((a, b) => a + (b.totale || 0), 0);
    
    document.getElementById('calc-res-nome').innerText = nomeInput.toUpperCase();
    document.getElementById('calc-res-qty').innerText = fmt(totQty);
    document.getElementById('calc-res-tot').innerText = fmt(totCr) + " cr";
    document.getElementById('calc-res-vamp').innerText = fmt(totCr * 0.4) + " cr";
    document.getElementById('calc-res-din').innerText = fmt(totCr * 0.6) + " cr";
    document.getElementById('calc-res-count').innerText = filtrati.length;
    
    const listaHtml = filtrati.sort((a,b) => b.timestamp - a.timestamp).map(v => `
        <div style="border-bottom: 1px solid #222; padding: 5px 0; display: flex; justify-content: space-between;">
            <span>${v.dataStr || ''} (${v.ora || ''})</span>
            <span style="color: var(--gold-dim);">${v.qty || 0}x - ${fmt(v.totale || 0)} cr</span>
        </div>
    `).join('');
    document.getElementById('calc-res-lista-dettaglio').innerHTML = "<strong>Dettaglio Vendite:</strong>" + listaHtml;
    resBox.style.display = "block"; 
    vampireToast("Resoconto generato con successo.", "success");
};

window.registraVendita = async () => {
    const nome = document.getElementById('vamp-nome').value;
    const qty = parseInt(document.getElementById('vamp-qty').value);
    const foto = document.getElementById('vamp-foto').value || "#";
    const note = document.getElementById('vamp-note').value || "";
    if(!nome || !qty) return vampireToast("Dati incompleti per la registrazione.", "error");
    const tot = qty * VALORE_UNITARIO;
    const now = new Date();
    await addDoc(collection(db, "vendite"), {
        nome, qty, foto, note, totale: tot, propria: tot * 0.4, dinastia: tot * 0.6,
        timestamp: Date.now(), dataStr: now.toLocaleDateString('it-IT'), ora: now.toLocaleTimeString('it-IT'),
        settimanaEtichetta: getWeekYearKey(now)
    });
    vampireToast("Vendita sigillata nel registro.", "success");
    document.getElementById('vamp-qty').value = ""; document.getElementById('vamp-note').value = "";
};

window.renderVendite = () => {
    const lista = document.getElementById('lista-vendite');
    if(!lista) return;
    const searchTerm = document.getElementById('search-vendite').value.toLowerCase();
    const key = getWeekYearKey(new Date());
    lista.innerHTML = vendite.filter(v => v.settimanaEtichetta === key && ((v.nome || "").toLowerCase().includes(searchTerm) || (v.note && v.note.toLowerCase().includes(searchTerm))))
        .sort((a,b) => b.timestamp - a.timestamp)
        .map(v => `
        <tr>
            <td><span class="ts-label">${v.dataStr || ''}</span><strong>${v.ora || ''}</strong></td>
            <td>${v.nome || ''}</td><td style="color: var(--gold-dim);">${fmt(v.qty)}x</td><td style="color: var(--gold-dim);">${fmt(v.totale)}</td>
            <td style="color:var(--success-green)">${fmt(v.propria)}</td>
            <td style="color:var(--gold-accent)">${fmt(v.dinastia)}</td>
            <td style="font-size: 0.7rem; opacity: 0.6;">${v.note || '-'}</td>
            <td><a href="${v.foto}" target="_blank" class="photo-link">PROVA</a></td>
        </tr>`).join('');
};

window.renderInventario = () => {
    const searchTerm = document.getElementById('search-inventario').value.toLowerCase();
    [1, 2, 3].forEach(n => {
        const container = document.getElementById(`display-inv-${n}`);
        if(container) {
            container.className = "inv-grid-container"; 
            container.innerHTML = inventarioDati
                .filter(i => i.id && i.categoria === `Inventario ${n}` && i.id.toLowerCase().includes(searchTerm))
                .sort((a,b) => a.id.localeCompare(b.id))
                .map(i => `
                    <div class="inv-box" onclick="window.openInvQuickAction('${i.id}')">
                        <span class="inv-qty-badge" style="background: var(--gold-accent); color: #000;">${fmt(i.qty)}</span>
                        <img class="inv-img" src="${i.foto || 'https://via.placeholder.com/100/121212/8b0000?text=?'}" 
                             onerror="this.src='https://via.placeholder.com/100/121212/8b0000?text=?'">
                        <span class="inv-name">${i.id}</span>
                    </div>`).join('');
        }
    });
};

window.openInvQuickAction = async (itemID) => {
    const utente = document.getElementById('inv-user-name').value;
    if(!utente) return vampireToast("Identificati prima di operare!", "error");
    const item = inventarioDati.find(i => i.id === itemID);
    const { value: formValues } = await Swal.fire({
        title: itemID,
        html: `<div style="color:#aaa; font-size:0.8rem; margin-bottom:15px; text-transform:uppercase;">Disponibilità: ${item.qty}</div>` +
              `<select id="swal-action" class="swal2-input"><option value="prendi">Preleva</option><option value="deposita">Deposita</option></select>` +
              `<input id="swal-qty" type="number" class="swal2-input" placeholder="Quantità">` +
              `<input id="swal-motivo" type="text" class="swal2-input" placeholder="Causale">`,
        background: '#121212', color: '#e0e0e0', showCancelButton: true, confirmButtonColor: '#8b0000',
        preConfirm: () => ({ action: document.getElementById('swal-action').value, qty: parseInt(document.getElementById('swal-qty').value), motivo: document.getElementById('swal-motivo').value })
    });

    if (formValues) {
        const { action, qty, motivo } = formValues;
        if(!qty || !motivo) return vampireToast("Dati mancanti per l'inventario.", "error");
        const newQty = action === "prendi" ? item.qty - qty : item.qty + qty;
        if(newQty < 0) return vampireToast("Scorte insufficienti nel deposito.", "error");
        const now = new Date();
        await updateDoc(doc(db, "inventario", itemID), { qty: newQty });
        await addDoc(collection(db, "logs"), { 
            utente, tipo: action, item: itemID, qty, motivo, timestamp: Date.now(), 
            dataStr: now.toLocaleDateString('it-IT'), ora: now.toLocaleTimeString('it-IT') 
        });
        vampireToast(`Oggetto ${action === 'prendi' ? 'prelevato' : 'depositato'} con successo.`, "success");
    }
};

window.renderLogs = () => {
    const logElement = document.getElementById('inv-logs');
    if(!logElement) return;
    const searchTerm = document.getElementById('search-logs').value.toLowerCase();
    logElement.innerHTML = logs.filter(l => (l.utente || "").toLowerCase().includes(searchTerm) || (l.item || "").toLowerCase().includes(searchTerm) || (l.motivo && l.motivo.toLowerCase().includes(searchTerm)))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente || ''}</strong> <span style="color: ${l.tipo === 'prendi' ? 'var(--withdraw-red)' : 'var(--success-green)'}">${l.tipo || ''}</span> <span style="color: var(--gold-dim); font-weight: bold;">${fmt(l.qty)}x</span> ${l.item || ''}</span>
                <span class="log-time">${l.dataStr || ''} ${l.ora || ''}</span>
            </div>
            <div class="log-causale">Motivo: ${l.motivo || 'N/D'}</div>
        </div>`).join('');
};

window.adminUpdateSaldo = async () => {
    const v = parseInt(document.getElementById('admin-saldo-val').value);
    await setDoc(doc(db, "config", "saldo"), { valore: v }, { merge: true });
    vampireToast("Saldo globale aggiornato manualmente.", "success");
};

window.adminUpdateItem = async () => {
    const n = document.getElementById('admin-item-name').value.trim();
    const c = document.getElementById('admin-item-cat').value;
    const f = document.getElementById('admin-item-foto').value.trim();
    const q = parseInt(document.getElementById('admin-item-qty').value) || 0;
    
    if(n) {
        await setDoc(doc(db, "inventario", n), { qty: q, categoria: c, foto: f });
        document.getElementById('admin-item-name').value = "";
        document.getElementById('admin-item-foto').value = "";
        vampireToast("Elemento inventario aggiornato.", "success");
    } else {
        vampireToast("Nome obbligatorio.", "error");
    }
};

window.adminUpdateQty = async (item, val) => {
    await updateDoc(doc(db, "inventario", item), { qty: parseInt(val) });
    vampireToast(`Quantità di ${item} modificata.`, "success");
};

window.adminDeleteItem = async (item) => {
    const res = await Swal.fire({ title: 'Eliminare?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) { 
        await deleteDoc(doc(db, "inventario", item)); 
        vampireToast("Oggetto eliminato dal database.", "success"); 
    }
};

window.adminDeleteVendita = async (id) => {
    const res = await Swal.fire({ title: 'Elimina Vendita', icon: 'question', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) { 
        await deleteDoc(doc(db, "vendite", id)); 
        vampireToast("Record di vendita eliminato.", "success"); 
    }
};

window.adminDeleteLog = async (id) => {
    const res = await Swal.fire({ title: 'Elimina Log', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) { 
        await deleteDoc(doc(db, "logs", id)); 
        vampireToast("Log di movimento epurato.", "success"); 
    }
};

window.adminDeleteSaldoLog = async (id) => {
    const res = await Swal.fire({ title: 'Rimuovi Log Saldo?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#8b0000', background: '#111' });
    if(res.isConfirmed) { 
        await deleteDoc(doc(db, "saldo_logs", id)); 
        vampireToast("Log transazione rimosso.", "success"); 
    }
};

window.renderAdminTable = () => {
    const tbody = document.getElementById('admin-table-body');
    if(!tbody) return;
    const searchTerm = document.getElementById('search-admin-inv').value.toLowerCase();
    tbody.innerHTML = inventarioDati.filter(i => i.id && i.id.toLowerCase().includes(searchTerm)).sort((a,b) => a.id.localeCompare(b.id))
        .map(i => `<tr><td>${i.id}</td><td>${i.categoria}</td><td><input type="number" value="${i.qty}" onchange="window.adminUpdateQty('${i.id}', this.value)"></td><td><button class="btn-delete" onclick="window.adminDeleteItem('${i.id}')">ELIMINA</button></td></tr>`).join('');
};

window.renderAdminLogs = () => {
    const logBox = document.getElementById('admin-logs-box');
    if(!logBox) return;
    const searchTerm = document.getElementById('search-admin-logs').value.toLowerCase();
    logBox.innerHTML = logs.filter(l => (l.utente || "").toLowerCase().includes(searchTerm) || (l.item || "").toLowerCase().includes(searchTerm))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente || ''}</strong> <span>${l.tipo || ''}</span> <span style="color: var(--gold-dim);">${fmt(l.qty)}</span>x ${l.item || ''}</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="log-time">${l.dataStr || ''} ${l.ora || ''}</span>
                    <button class="btn-delete" onclick="window.adminDeleteLog('${l.id}')">ELIMINA</button>
                </div>
            </div>
            <div class="log-causale">${l.motivo || ''}</div>
        </div>`).join('');
};

window.renderAdminSaldoLogs = () => {
    const logBox = document.getElementById('admin-saldo-logs-box');
    if(!logBox) return;
    const searchTerm = document.getElementById('search-admin-saldo-logs').value.toLowerCase();
    logBox.innerHTML = saldoLogs.filter(l => (l.utente || "").toLowerCase().includes(searchTerm) || (l.motivo || "").toLowerCase().includes(searchTerm))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente || ''}</strong> <span>${l.tipo || ''}</span> <span style="color: var(--gold-dim); font-weight: bold;">${fmt(l.qty)}</span> cr</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="log-time">${l.dataStr || ''} ${l.ora || ''}</span>
                    <button class="btn-delete" onclick="window.adminDeleteSaldoLog('${l.id}')">X</button>
                </div>
            </div>
            <div class="log-causale">${l.motivo || ''}</div>
        </div>`).join('');
};

window.renderArchivioGestione = () => {
    const searchTerm = document.getElementById('search-admin-archivio').value.toLowerCase();
    const container = document.getElementById('admin-archivio-container');
    if(!container) return;
    const gruppi = {};
    vendite.forEach(v => { if(!gruppi[v.settimanaEtichetta]) gruppi[v.settimanaEtichetta] = []; gruppi[v.settimanaEtichetta].push(v); });
    container.innerHTML = Object.keys(gruppi).sort().reverse().map(key => {
        const filtered = gruppi[key].filter(v => (v.nome || "").toLowerCase().includes(searchTerm) || (v.note && v.note.toLowerCase().includes(searchTerm))).sort((a,b) => b.timestamp - a.timestamp);
        if(filtered.length === 0 && searchTerm !== "") return "";
        const range = getWeekRangeLabel(key);
        const weekTotalQty = filtered.reduce((sum, v) => sum + (v.qty || 0), 0);
        const weekTotalDinastia = filtered.reduce((sum, v) => sum + (v.dinastia || 0), 0);
        
        return `<div class="week-archive-block">
            <div class="week-title">${range} | Vendite: ${filtered.length} | Qty: <span style="color: var(--gold-dim);">${fmt(weekTotalQty)}x</span> | Dinastia: <span style="color: var(--gold-dim);">${fmt(weekTotalDinastia)} cr</span> | Ekaton (50%): <span style="color: var(--gold-dim);">${fmt(Math.floor(weekTotalDinastia * 0.5))} cr</span></div>
            <div style="overflow-x:auto;"><table><thead><tr><th>Data/Ora</th><th>Vampiro</th><th>Qty</th><th>Propria</th><th>Dinastia</th><th>Note</th><th>Azione</th></tr></thead>
            <tbody>${filtered.map(v => `<tr><td style="font-size:0.65rem">${v.dataStr || ''}<br>${v.ora || ''}</td><td>${v.nome || ''}</td><td style="color: var(--gold-dim);">${fmt(v.qty)}</td><td>${fmt(v.propria)}</td><td>${fmt(v.dinastia)}</td><td style="font-size:0.7rem;">${v.note || '-'}</td><td><button class="btn-delete" onclick="window.adminDeleteVendita('${v.id}')">X</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }).join('');
};

window.popolaSelectOggetti = () => {
    const select = document.getElementById('inv-select-item');
    if(select) select.innerHTML = inventarioDati.sort((a,b) => a.id.localeCompare(b.id)).map(i => `<option value="${i.id}">${i.id}</option>`).join('');
};

// --- TIME UTILS ---
function getWeekYearKey(date) {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getFullYear() + "-W" + weekNo.toString().padStart(2, '0');
}

function getWeekRangeLabel(weekKey) {
    if(!weekKey) return "N/D";
    const [year, week] = weekKey.split('-W');
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const ISOweekStart = new Date(simple); 
    ISOweekStart.setDate(simple.getDate() - (simple.getDay() || 7) + 1);
    const ISOweekEnd = new Date(ISOweekStart); 
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);
    return `${ISOweekStart.toLocaleDateString('it-IT', {day:'2-digit', month:'short'})} - ${ISOweekEnd.toLocaleDateString('it-IT', {day:'2-digit', month:'short'})}`;
}

function aggiornaStats() {
    const currentWeekKey = getWeekYearKey(new Date());
    const correnti = vendite.filter(v => v.settimanaEtichetta === currentWeekKey);
    const totaleDinastiaSettimana = correnti.reduce((acc, curr) => acc + (curr.dinastia || 0), 0);
    const totaleQtySett = correnti.reduce((acc, curr) => acc + (curr.qty || 0), 0);
    const dinastiaStorico = vendite.reduce((acc, curr) => acc + (curr.dinastia || 0), 0);
    const ekatonStorico = dinastiaStorico * 0.5;
    
    if(document.getElementById('tot-dinastia-sett')) document.getElementById('tot-dinastia-sett').innerText = fmt(totaleDinastiaSettimana) + " cr";
    if(document.getElementById('tot-ekaton-sett')) document.getElementById('tot-ekaton-sett').innerText = fmt(Math.floor(totaleDinastiaSettimana * 0.5)) + " cr";
    if(document.getElementById('tot-qty-sett')) document.getElementById('tot-qty-sett').innerText = fmt(totaleQtySett) + "x";
    if(document.getElementById('tot-count-sett')) document.getElementById('tot-count-sett').innerText = correnti.length;

    if(document.getElementById('admin-tot-qty-storico')) document.getElementById('admin-tot-qty-storico').innerText = fmt(vendite.reduce((acc, curr) => acc + (curr.qty || 0), 0)) + "x";
    if(document.getElementById('admin-tot-dinastia-storico')) document.getElementById('admin-tot-dinastia-storico').innerText = fmt(dinastiaStorico) + " cr";
    if(document.getElementById('admin-tot-ekaton-storico')) document.getElementById('admin-tot-ekaton-storico').innerText = fmt(Math.floor(ekatonStorico)) + " cr";
    if(document.getElementById('admin-tot-count-storico')) document.getElementById('admin-tot-count-storico').innerText = vendite.length;
}

// --- LOGICA SEGRETA SBLOCCO MORSI ---
let logoClickCount = 0;
let morsiUnlocked = false;

window.vampireSecretUnlock = async () => {
    if (morsiUnlocked) return;
    logoClickCount++;
    if (logoClickCount >= 10) {
        const { value: password } = await Swal.fire({
            title: 'Santuario del Sangue',
            text: 'Inserisci il soffio vitale per rivelare il registro',
            input: 'password',
            inputPlaceholder: 'Scrivi qui...',
            background: '#070707',
            color: '#c5a059',
            confirmButtonColor: '#8b0000',
            showCancelButton: true
        });

        if (password === 'nutrimento') {
            morsiUnlocked = true;
            document.getElementById('nav-morsi').style.display = 'block';
            vampireToast("Registro dei Morsi rivelato.", "success");
            document.getElementById('main-logo').style.filter = "drop-shadow(0 0 15px #ff0000)";
            window.showSection('morsi');
        } else {
            logoClickCount = 0;
            vampireToast("Parola d'ordine errata.", "error");
        }
    }
};

// --- INITIALIZATION & SNAPSHOTS ---

function startFirestoreListeners() {
    onSnapshot(collection(db, "membri"), (snap) => { listaVampiri = snap.docs.map(doc => doc.data()); renderVampiriLists(); });
    onSnapshot(query(collection(db, "comunicazioni"), orderBy("timestamp", "desc")), (snap) => { comunicazioni = snap.docs.map(doc => ({id: doc.id, ...doc.data()})); renderDinamici(); });
    onSnapshot(query(collection(db, "documenti"), orderBy("timestamp", "desc")), (snap) => { documenti = snap.docs.map(doc => ({id: doc.id, ...doc.data()})); renderDinamici(); });

    onSnapshot(collection(db, "vendite"), (snapshot) => { 
        vendite = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        window.renderVendite(); 
        renderClassifiche(); 
        aggiornaStats(); 
        popolaFiltroSettimane();
        if (document.getElementById('admin-content').style.display === 'block') window.renderArchivioGestione(); 
    });

    onSnapshot(collection(db, "vendite_materiali"), (snapshot) => { 
        venditeMateriali = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        window.renderMateriali(); 
        if (document.getElementById('admin-content').style.display === 'block') {
            if(typeof window.renderAdminMateriali === 'function') window.renderAdminMateriali(); 
        }
    });

    onSnapshot(collection(db, "inventario"), (snapshot) => { 
        inventarioDati = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        window.renderInventario(); 
        window.popolaSelectOggetti(); 
        if (document.getElementById('admin-content').style.display === 'block') window.renderAdminTable(); 
    });

    onSnapshot(collection(db, "morsi"), (snapshot) => { 
        morsi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        window.renderMorsi(); 
        if (document.getElementById('admin-content').style.display === 'block') window.renderAdminMorsi();
    });

    onSnapshot(collection(db, "dungeon"), (snapshot) => { 
        dungeonDati = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        window.renderDungeon(); 
        if (document.getElementById('admin-content').style.display === 'block') window.renderAdminDungeon();
    });

    onSnapshot(collection(db, "conquiste"), (snapshot) => { 
        conquisteDati = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
        window.renderConquiste(); 
        if (document.getElementById('admin-content').style.display === 'block') window.renderAdminConquiste();
    });

    onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50)), (snapshot) => { logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.renderLogs(); if (document.getElementById('admin-content').style.display === 'block') window.renderAdminLogs(); });
    onSnapshot(query(collection(db, "saldo_logs"), orderBy("timestamp", "desc"), limit(50)), (snapshot) => { saldoLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.renderSaldoLogs(); if (document.getElementById('admin-content').style.display === 'block') window.renderAdminSaldoLogs(); });

    onSnapshot(doc(db, "config", "saldo"), (docSnap) => { 
        if(docSnap.exists()) { saldoGlobale = docSnap.data().valore; } 
        else { saldoGlobale = 0; setDoc(doc(db, "config", "saldo"), { valore: 0 }); }
        document.getElementById('tot-saldo-globale').innerText = fmt(saldoGlobale) + " cr";
        if (document.getElementById('admin-saldo-val')) document.getElementById('admin-saldo-val').value = saldoGlobale;
    });
}

// --- PROTEZIONE INTERFACCIA ---

// 1. Blocca il tasto destro
document.addEventListener('contextmenu', event => event.preventDefault());

// 2. Blocca scorciatoie da tastiera comuni per ispeziona
document.onkeydown = function(e) {
    if (e.keyCode == 123) return false; // F12
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false; // Ctrl+Shift+I
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false; // Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false; // Ctrl+Shift+J
    if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false; // Ctrl+U (Visualizza sorgente)
};

// 3. Debugger Loop: se aprono la console, il sito rallenta drasticamente
setInterval(function() {
    debugger;
}, 100);

// Modifichiamo il controllo dell'autenticazione per avviare i listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        startFirestoreListeners();

        if (user.email === "vampiri.gestore@horde.it") {
            document.getElementById('global-lock').style.display = 'none';
            document.getElementById('login-container-gestione').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            
            // Re-indirizzamento istantaneo per evitare il vuoto
            window.showSection('gestione'); 
            refreshAdminUI();
        } else if (user.email === "vampiri@horde.it") {
            document.getElementById('global-lock').style.display = 'none';
            document.getElementById('admin-content').style.display = 'none';
            window.showSection('generale');
        }
    } else {
        // Se non loggato, mostra i contenitori centrati
        document.getElementById('global-lock').style.display = 'flex';
        document.getElementById('admin-content').style.display = 'none';
        const gestLogin = document.getElementById('login-container-gestione');
        if(gestLogin) gestLogin.style.display = 'flex'; 
    }
});

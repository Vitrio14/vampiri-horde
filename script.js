import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAZIONE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSy...", 
    authDomain: "vampiri-horde.firebaseapp.com",
    projectId: "vampiri-horde",
    storageBucket: "vampiri-horde.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// VARIABILI GLOBALI
let vendite = [];
let inventarioDati = [];
let logs = [];
let saldoLogs = [];
let morsi = []; 
let saldoGlobale = 0;
let listaVampiri = [];
let comunicazioni = [];
let documenti = [];

const PASSWORD_GLOBAL = "2026";
const PASSWORD_GDR = "7711"; 
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

// --- LOGICA SITO (LOGIN GLOBALE) ---
window.unlockSite = () => {
    const passInput = document.getElementById('global-pass').value;
    
    if(!passInput) {
        return vampireToast("Inserire il codice d'accesso per procedere.", "error");
    }

    if(passInput === PASSWORD_GLOBAL) {
        document.getElementById('global-lock').style.display = 'none';
        window.showSection('generale'); 
        vampireToast("Accesso alla Dinastia consentito.", "success");
    } else {
        vampireToast("Codice errato. Il sigillo resta intatto.", "error");
        Swal.fire({ 
            title: "Sigillo Intatto", 
            text: "Codice errato.", 
            icon: "error", 
            background: '#121212', 
            color: '#e0e0e0',
            confirmButtonColor: '#8b0000'
        });
    }
};

window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    const link = Array.from(document.querySelectorAll('.nav-link')).find(l => l.getAttribute('onclick')?.includes(id));
    if(link) link.classList.add('active');
    window.scrollTo(0, 0); 
};

// --- GESTIONE DINAMICA ---
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

    // 1. Render Tabella Recenti
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

    // --- LOGICA CLASSIFICHE SEPARATE ---

    // 1. PREDATORI DI UMANI (Vampiri che mordono Umani)
    const predUmaniSett = morsiSettimana.filter(m => (m.tipoVittima || 'umano') === 'umano');
    const predUmaniTot = morsi.filter(m => (m.tipoVittima || 'umano') === 'umano');
    renderClassificaMorsi(predUmaniSett, 'vampiro', 'morsi-vamp-sett-box');
    renderClassificaMorsi(predUmaniTot, 'vampiro', 'morsi-vamp-tot-box');

    // 2. PREDATORI DI VAMPIRI (Vampiri che mordono Vampiri)
    const predVampiriSett = morsiSettimana.filter(m => m.tipoVittima === 'vampiro');
    const predVampiriTot = morsi.filter(m => m.tipoVittima === 'vampiro');
    renderClassificaMorsi(predVampiriSett, 'vampiro', 'morsi-vampiri-predatori-sett-box');
    renderClassificaMorsi(predVampiriTot, 'vampiro', 'morsi-vampiri-predatori-tot-box');

    // 3. VITTIME UMANE (Umani più morsi)
    const vittimeUmaneSett = morsiSettimana.filter(m => (m.tipoVittima || 'umano') === 'umano');
    const vittimeUmaneTot = morsi.filter(m => (m.tipoVittima || 'umano') === 'umano');
    renderClassificaMorsi(vittimeUmaneSett, 'umano', 'morsi-umani-sett-box');
    renderClassificaMorsi(vittimeUmaneTot, 'umano', 'morsi-umani-tot-box');

    // 4. VITTIME VAMPIRI (Vampiri più morsi)
    const vittimeVampSett = morsiSettimana.filter(m => m.tipoVittima === 'vampiro');
    const vittimeVampTot = morsi.filter(m => m.tipoVittima === 'vampiro');
    renderClassificaMorsi(vittimeVampSett, 'umano', 'morsi-vampiri-vittime-sett-box');
    renderClassificaMorsi(vittimeVampTot, 'umano', 'morsi-vampiri-vittime-tot-box');

    // --- FINE LOGICA CLASSIFICHE ---

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

// --- LOGICA ADMIN MORSI ---
window.renderAdminMorsi = () => {
    const tbody = document.getElementById('admin-morsi-table-body');
    if (!tbody) return;
    const searchTerm = document.getElementById('search-admin-morsi').value.toLowerCase();
    
    tbody.innerHTML = morsi
        .filter(m => m.vampiro.toLowerCase().includes(searchTerm) || m.umano.toLowerCase().includes(searchTerm))
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(m => {
            const tVittima = m.tipoVittima || 'umano'; 
            return `
            <tr>
                <td style="font-size:0.65rem;">${m.dataStr}<br>${m.ora}</td>
                <td>${m.vampiro}</td>
                <td><small>[${tVittima.toUpperCase()}]</small> ${m.umano}</td>
                <td style="font-size:0.6rem; opacity:0.6;">${getWeekRangeLabel(m.settimanaEtichetta)}</td>
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
    
    // Filtro Settimanale: accumulo solo la quota 'dinastia'
    vendite.filter(v => v.settimanaEtichetta === currentWeek).forEach(v => {
        if (!mapSett[v.nome]) mapSett[v.nome] = { carbonio: 0, crediti: 0 };
        mapSett[v.nome].carbonio += v.qty; 
        mapSett[v.nome].crediti += v.dinastia; // <--- MODIFICATO: da v.totale a v.dinastia
    });
    const rankSett = Object.entries(mapSett).sort((a,b) => b[1].carbonio - a[1].carbonio);

    const mapSempre = {};
    // Filtro Storico: accumulo solo la quota 'dinastia'
    vendite.forEach(v => {
        if (!mapSempre[v.nome]) mapSempre[v.nome] = { carbonio: 0, crediti: 0 };
        mapSempre[v.nome].carbonio += v.qty; 
        mapSempre[v.nome].crediti += v.dinastia; // <--- MODIFICATO: da v.totale a v.dinastia
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

// --- LOGICA SALDO ---
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
    box.innerHTML = saldoLogs.filter(l => l.utente.toLowerCase().includes(searchTerm) || l.motivo.toLowerCase().includes(searchTerm))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente}</strong> <span style="color: ${l.tipo === 'preleva' ? 'var(--withdraw-red)' : 'var(--success-green)'}">${l.tipo}</span> <span style="color: var(--gold-dim);">${fmt(l.qty)}</span> cr</span>
                <span class="log-time">${l.dataStr || ''} ${l.ora}</span>
            </div>
            <div class="log-causale">Motivo: ${l.motivo}</div>
        </div>`).join('');
};

// --- LOGICA CALCOLO (FILTRATA) ---
function popolaFiltroSettimane() {
    const filter = document.getElementById('calc-period-filter');
    if(!filter) return;
    const valCorrente = filter.value;
    const settimaneUniche = [...new Set(vendite.map(v => v.settimanaEtichetta))].sort().reverse();
    
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
    
    const totQty = filtrati.reduce((a, b) => a + b.qty, 0);
    const totCr = filtrati.reduce((a, b) => a + b.totale, 0);
    
    document.getElementById('calc-res-nome').innerText = nomeInput.toUpperCase();
    document.getElementById('calc-res-qty').innerText = fmt(totQty);
    document.getElementById('calc-res-tot').innerText = fmt(totCr) + " cr";
    document.getElementById('calc-res-vamp').innerText = fmt(totCr * 0.4) + " cr";
    document.getElementById('calc-res-din').innerText = fmt(totCr * 0.6) + " cr";
    document.getElementById('calc-res-count').innerText = filtrati.length;
    
    const listaHtml = filtrati.sort((a,b) => b.timestamp - a.timestamp).map(v => `
        <div style="border-bottom: 1px solid #222; padding: 5px 0; display: flex; justify-content: space-between;">
            <span>${v.dataStr} (${v.ora})</span>
            <span style="color: var(--gold-dim);">${v.qty}x - ${fmt(v.totale)} cr</span>
        </div>
    `).join('');
    document.getElementById('calc-res-lista-dettaglio').innerHTML = "<strong>Dettaglio Vendite:</strong>" + listaHtml;
    resBox.style.display = "block"; 
    vampireToast("Resoconto generato con successo.", "success");
};

// --- LOGICA VENDITE ---
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
    lista.innerHTML = vendite.filter(v => v.settimanaEtichetta === key && (v.nome.toLowerCase().includes(searchTerm) || (v.note && v.note.toLowerCase().includes(searchTerm))))
        .sort((a,b) => b.timestamp - a.timestamp)
        .map(v => `
        <tr>
            <td><span class="ts-label">${v.dataStr || ''}</span><strong>${v.ora || ''}</strong></td>
            <td>${v.nome}</td><td style="color: var(--gold-dim);">${fmt(v.qty)}x</td><td style="color: var(--gold-dim);">${fmt(v.totale)}</td>
            <td style="color:var(--success-green)">${fmt(v.propria)}</td>
            <td style="color:var(--gold-accent)">${fmt(v.dinastia)}</td>
            <td style="font-size: 0.7rem; opacity: 0.6;">${v.note || '-'}</td>
            <td><a href="${v.foto}" target="_blank" class="photo-link">PROVA</a></td>
        </tr>`).join('');
};

// --- LOGICA INVENTARIO VISIVO (RIPRISTINATA INTEGRALMENTE) ---
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
    logElement.innerHTML = logs.filter(l => l.utente.toLowerCase().includes(searchTerm) || l.item.toLowerCase().includes(searchTerm) || (l.motivo && l.motivo.toLowerCase().includes(searchTerm)))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente}</strong> <span style="color: ${l.tipo === 'prendi' ? 'var(--withdraw-red)' : 'var(--success-green)'}">${l.tipo}</span> <span style="color: var(--gold-dim); font-weight: bold;">${fmt(l.qty)}x</span> ${l.item}</span>
                <span class="log-time">${l.dataStr || ''} ${l.ora}</span>
            </div>
            <div class="log-causale">Motivo: ${l.motivo || 'N/D'}</div>
        </div>`).join('');
};

// --- LOGICA ADMIN (GESTIONE) ---
window.checkAccess = () => {
    const passInput = document.getElementById('admin-pass').value;
    if(!passInput) {
        return vampireToast("Inserire la password gestore.", "error");
    }
    if(passInput === PASSWORD_GDR) {
        document.getElementById('login-container-gestione').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        window.renderAdminMorsi(); window.renderAdminTable(); window.renderArchivioGestione(); window.renderAdminLogs(); window.renderAdminSaldoLogs();
        renderVampiriLists(); renderDinamici(); aggiornaStats(); 
        vampireToast("Accesso Gestore garantito.", "success");
    } else { 
        vampireToast("Accesso negato. Password errata.", "error"); 
    }
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
    logBox.innerHTML = logs.filter(l => l.utente.toLowerCase().includes(searchTerm) || l.item.toLowerCase().includes(searchTerm))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente}</strong> <span>${l.tipo}</span> <span style="color: var(--gold-dim);">${fmt(l.qty)}</span>x ${l.item}</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="log-time">${l.dataStr || ''} ${l.ora}</span>
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
    logBox.innerHTML = saldoLogs.filter(l => l.utente.toLowerCase().includes(searchTerm) || l.motivo.toLowerCase().includes(searchTerm))
        .map(l => `
        <div class="log-entry">
            <div class="log-main">
                <span><strong>${l.utente}</strong> <span>${l.tipo}</span> <span style="color: var(--gold-dim); font-weight: bold;">${fmt(l.qty)}</span> cr</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="log-time">${l.dataStr || ''} ${l.ora}</span>
                    <button class="btn-delete" onclick="window.adminDeleteSaldoLog('${l.id}')">X</button>
                </div>
            </div>
            <div class="log-causale">${l.motivo}</div>
        </div>`).join('');
};

window.renderArchivioGestione = () => {
    const searchTerm = document.getElementById('search-admin-archivio').value.toLowerCase();
    const container = document.getElementById('admin-archivio-container');
    if(!container) return;
    const gruppi = {};
    vendite.forEach(v => { if(!gruppi[v.settimanaEtichetta]) gruppi[v.settimanaEtichetta] = []; gruppi[v.settimanaEtichetta].push(v); });
    container.innerHTML = Object.keys(gruppi).sort().reverse().map(key => {
        const filtered = gruppi[key].filter(v => v.nome.toLowerCase().includes(searchTerm) || (v.note && v.note.toLowerCase().includes(searchTerm))).sort((a,b) => b.timestamp - a.timestamp);
        if(filtered.length === 0 && searchTerm !== "") return "";
        const range = getWeekRangeLabel(key);
        const weekTotalQty = filtered.reduce((sum, v) => sum + v.qty, 0);
        const weekTotalDinastia = filtered.reduce((sum, v) => sum + v.dinastia, 0);
        
        return `<div class="week-archive-block">
            <div class="week-title">${range} | Vendite: ${filtered.length} | Qty: <span style="color: var(--gold-dim);">${fmt(weekTotalQty)}x</span> | Dinastia: <span style="color: var(--gold-dim);">${fmt(weekTotalDinastia)} cr</span> | Ekaton (50%): <span style="color: var(--gold-dim);">${fmt(Math.floor(weekTotalDinastia * 0.5))} cr</span></div>
            <div style="overflow-x:auto;"><table><thead><tr><th>Data/Ora</th><th>Vampiro</th><th>Qty</th><th>Propria</th><th>Dinastia</th><th>Note</th><th>Azione</th></tr></thead>
            <tbody>${filtered.map(v => `<tr><td style="font-size:0.65rem">${v.dataStr}<br>${v.ora}</td><td>${v.nome}</td><td style="color: var(--gold-dim);">${fmt(v.qty)}</td><td>${fmt(v.propria)}</td><td>${fmt(v.dinastia)}</td><td style="font-size:0.7rem;">${v.note || '-'}</td><td><button class="btn-delete" onclick="window.adminDeleteVendita('${v.id}')">X</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }).join('');
};

window.logoutAdmin = async () => {
    const res = await Swal.fire({
        title: 'Chiudere la sessione?',
        text: "Dovrai inserire nuovamente la password gestore.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#8b0000',
        background: '#111',
        color: '#fff'
    });
    
    if(res.isConfirmed) {
        vampireToast("Sessione chiusa correttamente.", "info");
        setTimeout(() => {
            location.reload();
        }, 800);
    }
};

window.popolaSelectOggetti = () => {
    const select = document.getElementById('inv-select-item');
    if(select) select.innerHTML = inventarioDati.sort((a,b) => a.id.localeCompare(b.id)).map(i => `<option value="${i.id}">${i.id}</option>`).join('');
};

// --- TIME UTILS (FIXED SETTIMANA) ---
function getWeekYearKey(date) {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getFullYear() + "-W" + weekNo.toString().padStart(2, '0');
}

function getWeekRangeLabel(weekKey) {
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
    const totaleDinastiaSettimana = correnti.reduce((acc, curr) => acc + curr.dinastia, 0);
    const totaleQtySett = correnti.reduce((acc, curr) => acc + curr.qty, 0);
    const dinastiaStorico = vendite.reduce((acc, curr) => acc + curr.dinastia, 0);
    const ekatonStorico = dinastiaStorico * 0.5;
    
    if(document.getElementById('tot-dinastia-sett')) document.getElementById('tot-dinastia-sett').innerText = fmt(totaleDinastiaSettimana) + " cr";
    if(document.getElementById('tot-ekaton-sett')) document.getElementById('tot-ekaton-sett').innerText = fmt(Math.floor(totaleDinastiaSettimana * 0.5)) + " cr";
    if(document.getElementById('tot-qty-sett')) document.getElementById('tot-qty-sett').innerText = fmt(totaleQtySett) + "x";
    if(document.getElementById('tot-count-sett')) document.getElementById('tot-count-sett').innerText = correnti.length;

    if(document.getElementById('admin-tot-qty-storico')) document.getElementById('admin-tot-qty-storico').innerText = fmt(vendite.reduce((acc, curr) => acc + curr.qty, 0)) + "x";
    if(document.getElementById('admin-tot-dinastia-storico')) document.getElementById('admin-tot-dinastia-storico').innerText = fmt(dinastiaStorico) + " cr";
    if(document.getElementById('admin-tot-ekaton-storico')) document.getElementById('admin-tot-ekaton-storico').innerText = fmt(Math.floor(ekatonStorico)) + " cr";
    if(document.getElementById('admin-tot-count-storico')) document.getElementById('admin-tot-count-storico').innerText = vendite.length;
}

// --- LOGICA SEGRETA SBLOCCO MORSI ---
let logoClickCount = 0;
let morsiUnlocked = false;

window.vampireSecretUnlock = async () => {
    // Se è già sbloccato, non fare nulla
    if (morsiUnlocked) return;

    logoClickCount++;

    // Opzionale: un piccolo feedback visivo (vibrazione del logo o toast ogni 3 click)
    if (logoClickCount % 3 === 0 && logoClickCount < 10) {
        console.log(`Il logo sussurra... (${logoClickCount}/10)`);
    }

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
            
            // Effetto visivo di sblocco sul logo
            document.getElementById('main-logo').style.filter = "drop-shadow(0 0 15px #ff0000)";
            
            // Porta l'utente direttamente alla sezione
            window.showSection('morsi');
        } else {
            logoClickCount = 0; // Reset dei click se sbaglia pass
            vampireToast("Parola d'ordine errata. L'oscurità ti respinge.", "error");
        }
    }
};

// --- INITIALIZATION & SNAPSHOTS ---
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

onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50)), (snapshot) => { logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.renderLogs(); if (document.getElementById('admin-content').style.display === 'block') window.renderAdminLogs(); });
onSnapshot(query(collection(db, "saldo_logs"), orderBy("timestamp", "desc"), limit(50)), (snapshot) => { saldoLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.renderSaldoLogs(); if (document.getElementById('admin-content').style.display === 'block') window.renderAdminSaldoLogs(); });

onSnapshot(doc(db, "config", "saldo"), (docSnap) => { 
    if(docSnap.exists()) { saldoGlobale = docSnap.data().valore; } 
    else { saldoGlobale = 0; setDoc(doc(db, "config", "saldo"), { valore: 0 }); }
    document.getElementById('tot-saldo-globale').innerText = fmt(saldoGlobale) + " cr";
    if (document.getElementById('admin-saldo-val')) document.getElementById('admin-saldo-val').value = saldoGlobale;
});

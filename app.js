// --- Configurações ---
const PROXY = "https://corsproxy.io/?";
const M3U_URL = "https://tinyurl.com/wgem777";
const EPG_URL = "https://is.gd/GJaSQ4"; 

// Elementos da DOM
const video = document.getElementById('video');
const channelList = document.getElementById('channelList');
const epgContainer = document.getElementById('epgContainer'); // Elemento da coluna direita
const titleDisplay = document.querySelector('#currentChannelTitle span');
const logoDisplay = document.getElementById('currentLogo');
const searchInput = document.getElementById('searchInput');

let allChannels = []; 
let epgData = {}; // Armazena o EPG processado { "ID_DO_CANAL": [programas...] }

// --- 1. Inicialização ---
async function init() {
    await fetchChannels(); // 1º Baixa canais
    fetchEPG();            // 2º Baixa EPG em segundo plano (sem await para não travar)
}

// --- 2. Carregar Lista M3U ---
async function fetchChannels() {
    try {
        channelList.innerHTML = '<li style="padding:15px; text-align:center;">Carregando canais...</li>';
        const target = PROXY + encodeURIComponent(M3U_URL);
        const response = await fetch(target);
        if (!response.ok) throw new Error("Erro ao baixar lista");
        const text = await response.text();
        parseM3U(text);
    } catch (error) {
        console.error(error);
        channelList.innerHTML = '<li style="padding:15px; color:red;">Erro ao carregar lista.</li>';
    }
}

function parseM3U(data) {
    const lines = data.split('\n');
    allChannels = [];
    let currentChannel = {};

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith('#EXTINF:')) {
            // Tenta pegar o ID do EPG (tvg-id="...")
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            currentChannel.tvgId = tvgIdMatch ? tvgIdMatch[1] : null;

            // Tenta pegar o nome e logo
            const nameParts = line.split(',');
            currentChannel.name = nameParts[nameParts.length - 1].trim();
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            currentChannel.logo = logoMatch ? logoMatch[1] : '';
            
            // Tenta pegar o grupo
            const groupMatch = line.match(/group-title="([^"]*)"/);
            currentChannel.group = groupMatch ? groupMatch[1] : 'Geral';

        } else if (!line.startsWith('#')) {
            currentChannel.url = line;
            if (currentChannel.name && currentChannel.url) {
                allChannels.push({...currentChannel});
            }
            currentChannel = {};
        }
    });
    renderList(allChannels);
}

// --- 3. Carregar e Processar EPG (XML) ---
async function fetchEPG() {
    try {
        epgContainer.innerHTML = '<div style="padding:15px; color:#aaa;">Carregando guia...</div>';
        const target = PROXY + encodeURIComponent(EPG_URL);
        const response = await fetch(target);
        const text = await response.text();
        
        // Parsear XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const programmes = xmlDoc.getElementsByTagName("programme");

        epgData = {}; // Limpa dados antigos

        // Processa programas (pode demorar se for muito grande)
        for (let i = 0; i < programmes.length; i++) {
            const prog = programmes[i];
            const channelId = prog.getAttribute("channel");
            const title = prog.getElementsByTagName("title")[0]?.textContent || "Sem título";
            const start = prog.getAttribute("start"); // Formato: 20231217153000 +0000
            const stop = prog.getAttribute("stop");

            if (!epgData[channelId]) epgData[channelId] = [];
            
            epgData[channelId].push({
                title: title,
                start: parseEPGDate(start),
                stop: parseEPGDate(stop)
            });
        }
        
        epgContainer.innerHTML = '<div style="padding:15px; color:#aaa;">Guia atualizado! Selecione um canal.</div>';
        console.log("EPG Carregado com sucesso!");

    } catch (e) {
        console.error("Erro no EPG:", e);
        epgContainer.innerHTML = '<div style="padding:15px; color:orange;">Guia indisponível.</div>';
    }
}

// Auxiliar para converter data do formato XMLTV (YYYYMMDDHHMMSS) para Objeto Date JS
function parseEPGDate(dateStr) {
    if (!dateStr) return new Date();
    // Ex: 20251217153000
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6) - 1; // Mês começa em 0 no JS
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    return new Date(year, month, day, hour, minute);
}

// --- 4. Exibir EPG do Canal Selecionado ---
function showEPGForChannel(channelName, tvgId) {
    epgContainer.innerHTML = "";
    const now = new Date();

    // Tenta encontrar programas pelo ID (tvg-id) ou pelo Nome (se id falhar)
    // Nota: Muitas listas M3U têm tvg-id diferente do XML. O match perfeito é difícil.
    let programs = epgData[tvgId];

    if (!programs) {
        epgContainer.innerHTML = '<div style="padding:15px;">Sem informações para este canal.</div>';
        return;
    }

    // Filtra programas passados (mostra apenas atual e futuros)
    const upcoming = programs.filter(p => p.stop > now); 

    if (upcoming.length === 0) {
        epgContainer.innerHTML = '<div style="padding:15px;">Programação encerrada por hoje.</div>';
        return;
    }

    upcoming.forEach(prog => {
        const isCurrent = prog.start <= now && prog.stop >= now;
        
        const div = document.createElement('div');
        div.className = `epg-item ${isCurrent ? 'current' : ''}`;
        
        // Formata hora (HH:MM)
        const startStr = prog.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const stopStr = prog.stop.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        div.innerHTML = `
            <div class="epg-time">${startStr} - ${stopStr}</div>
            <div class="epg-title">${prog.title}</div>
        `;
        epgContainer.appendChild(div);
    });
}

// --- Renderização e Player (Igual anterior, com pequena adição no click) ---
function renderList(channelsToRender) {
    channelList.innerHTML = "";
    if (channelsToRender.length === 0) return;

    channelsToRender.forEach((channel) => {
        const li = document.createElement('li');
        li.className = 'channel-item';
        const logoSrc = channel.logo ? channel.logo : 'https://cdn-icons-png.flaticon.com/512/7165/7165318.png';

        li.innerHTML = `
            <img src="${logoSrc}" class="channel-logo" onerror="this.style.display='none'">
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:bold;">${channel.name}</span>
                <span style="font-size:0.8em; color:#aaa;">${channel.group}</span>
            </div>
        `;
        
        // NOVIDADE: Passa o tvgId para carregar o EPG ao clicar
        li.onclick = () => {
            loadChannel(channel.url, channel.name, channel.logo, li);
            showEPGForChannel(channel.name, channel.tvgId);
        };
        channelList.appendChild(li);
    });
}

function loadChannel(url, name, logoUrl, element) {
    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    titleDisplay.innerText = name;
    logoDisplay.src = logoUrl || '';
    logoDisplay.style.display = logoUrl ? 'block' : 'none';

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play();
    }
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    renderList(allChannels.filter(ch => ch.name.toLowerCase().includes(term)));
});

// Inicia tudo
init();
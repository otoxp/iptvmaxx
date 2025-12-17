// --- Configurações ---
const PROXY = "https://corsproxy.io/?";
const EPG_URL = "https://tinyurl.com/4uxff8vd"; 

// Elementos da DOM
const setupScreen = document.getElementById('setupScreen');
const fileInput = document.getElementById('fileInput');
const urlInput = document.getElementById('urlInput');
const video = document.getElementById('video');
const channelList = document.getElementById('channelList');
const searchInput = document.getElementById('searchInput');
const titleDisplay = document.querySelector('#currentChannelTitle span');
const logoDisplay = document.getElementById('currentLogo');
const epgContainer = document.getElementById('epgContainer');

// Elementos da Descrição Central
const progTitleDisplay = document.getElementById('progTitle');
const progDescDisplay = document.getElementById('progDesc');
const progTimeDisplay = document.getElementById('progTime');

let allChannels = [];
let epgData = {};
let isEpgLoaded = false;

// --- 1. Lógica da Tela Inicial ---
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        parseM3U(e.target.result);
        closeSetup();
    };
    reader.readAsText(file);
});

async function loadFromUrl() {
    const url = urlInput.value.trim();
    if (!url) return alert("Digite uma URL válida.");
    try {
        const btn = document.querySelector('button[onclick="loadFromUrl()"]');
        btn.innerText = "Baixando...";
        const target = PROXY + encodeURIComponent(url);
        const response = await fetch(target);
        if (!response.ok) throw new Error("Erro no download");
        const text = await response.text();
        parseM3U(text);
        closeSetup();
        localStorage.setItem('saved_iptv_url', url);
    } catch (error) {
        alert("Erro ao baixar. Tente Arquivo Local.");
        console.error(error);
    } finally {
        document.querySelector('button[onclick="loadFromUrl()"]').innerText = "Carregar via Link";
    }
}

function closeSetup() { setupScreen.style.display = 'none'; fetchEPG(); }
function resetApp() { location.reload(); }

// --- 2. Parser M3U ---
function parseM3U(data) {
    const lines = data.split('\n');
    allChannels = [];
    let currentChannel = {};

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        if (line.startsWith('#EXTINF:')) {
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            currentChannel.tvgId = tvgIdMatch ? tvgIdMatch[1] : null;
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            currentChannel.tvgName = tvgNameMatch ? tvgNameMatch[1] : null;
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            currentChannel.logo = logoMatch ? logoMatch[1] : '';
            const groupMatch = line.match(/group-title="([^"]*)"/);
            currentChannel.group = groupMatch ? groupMatch[1] : 'Geral';
            const nameParts = line.split(',');
            currentChannel.name = nameParts[nameParts.length - 1].trim();
        } else if (!line.startsWith('#')) {
            currentChannel.url = line;
            if (currentChannel.name && currentChannel.url) allChannels.push({...currentChannel});
            currentChannel = {};
        }
    });
    renderList(allChannels);
}

// --- 3. Carregar e Processar EPG ---
async function fetchEPG() {
    try {
        epgContainer.innerHTML = '<div style="padding:20px; color:#aaa; text-align:center;">Baixando guia...</div>';
        const target = PROXY + encodeURIComponent(EPG_URL);
        const response = await fetch(target);
        if (!response.ok) throw new Error("Falha ao baixar XML");
        const text = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const programmes = xmlDoc.getElementsByTagName("programme");

        epgData = {}; 
        const now = new Date();

        for (let i = 0; i < programmes.length; i++) {
            const prog = programmes[i];
            const channelId = prog.getAttribute("channel"); 
            const stopStr = prog.getAttribute("stop");
            const stopDate = parseEPGDate(stopStr);

            if (stopDate < now) continue;

            const title = prog.getElementsByTagName("title")[0]?.textContent || "Sem título";
            // NOVIDADE: Pega a descrição
            const desc = prog.getElementsByTagName("desc")[0]?.textContent || "Sem descrição disponível.";
            const startStr = prog.getAttribute("start");
            
            const safeId = channelId.toLowerCase();
            if (!epgData[safeId]) epgData[safeId] = [];
            epgData[safeId].push({
                title: title,
                desc: desc,
                start: parseEPGDate(startStr),
                stop: stopDate
            });
        }
        isEpgLoaded = true;
        epgContainer.innerHTML = '<div style="padding:20px; color:#aaa; text-align:center;">Guia atualizado.<br>Selecione um canal.</div>';

    } catch (e) {
        console.error("Erro no EPG:", e);
        epgContainer.innerHTML = '<div style="padding:20px; color:orange; text-align:center;">Guia indisponível.</div>';
    }
}

function parseEPGDate(dateStr) {
    if (!dateStr) return new Date();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6) - 1;
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    return new Date(year, month, day, hour, minute);
}

// --- 4. Exibir EPG e Detalhes ---
function showEPGForChannel(channel) {
    // 1. Limpa detalhes da tela central
    progTitleDisplay.innerText = channel.name;
    progDescDisplay.innerText = "Aguardando informações do guia...";
    progTimeDisplay.innerText = "--:--";
    progTimeDisplay.style.display = 'none';

    if (!isEpgLoaded) {
        epgContainer.innerHTML = '<div style="padding:20px; text-align:center;">Aguardando guia...</div>';
        return;
    }

    epgContainer.innerHTML = "";
    const now = new Date();
    let programs = null;

    // Busca Inteligente
    if (channel.tvgId && epgData[channel.tvgId.toLowerCase()]) programs = epgData[channel.tvgId.toLowerCase()];
    if (!programs && channel.tvgName && epgData[channel.tvgName.toLowerCase()]) programs = epgData[channel.tvgName.toLowerCase()];
    if (!programs) {
        const simpleName = channel.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const foundKey = Object.keys(epgData).find(key => key.includes(simpleName) || simpleName.includes(key));
        if (foundKey) programs = epgData[foundKey];
    }

    if (!programs || programs.length === 0) {
        epgContainer.innerHTML = `<div style="padding:20px; text-align:center; color:#666;">Sem dados para:<br><strong>${channel.name}</strong></div>`;
        progDescDisplay.innerText = "Informações não encontradas no guia.";
        return;
    }

    programs.sort((a, b) => a.start - b.start); 

    let hasContent = false;
    programs.forEach(prog => {
        if (prog.stop > now) {
            hasContent = true;
            const isCurrent = prog.start <= now && prog.stop >= now;
            
            // SE FOR O PROGRAMA ATUAL, ATUALIZA A TELA CENTRAL
            if (isCurrent) {
                progTitleDisplay.innerText = prog.title;
                progDescDisplay.innerText = prog.desc;
                const start = prog.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const stop = prog.stop.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                progTimeDisplay.innerText = `AO VIVO: ${start} - ${stop}`;
                progTimeDisplay.style.display = 'inline-block';
            }

            // Renderiza barra lateral
            const div = document.createElement('div');
            div.className = `epg-item ${isCurrent ? 'current' : ''}`;
            const startStr = prog.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const stopStr = prog.stop.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            div.innerHTML = `
                <div class="epg-time">${startStr} - ${stopStr}</div>
                <div class="epg-title">${prog.title}</div>
            `;
            epgContainer.appendChild(div);
            if(isCurrent) setTimeout(() => div.scrollIntoView({behavior: "smooth", block: "center"}), 100);
        }
    });

    if(!hasContent) epgContainer.innerHTML = '<div style="padding:20px; text-align:center;">Programação encerrada.</div>';
}

// --- Renderização ---
function renderList(channelsToRender) {
    channelList.innerHTML = "";
    if (channelsToRender.length === 0) {
        channelList.innerHTML = '<li style="padding:15px;">Nenhum canal encontrado.</li>';
        return;
    }
    channelsToRender.forEach((channel) => {
        const li = document.createElement('li');
        li.className = 'channel-item';
        const logoSrc = channel.logo || 'https://cdn-icons-png.flaticon.com/512/7165/7165318.png';
        li.innerHTML = `
            <img src="${logoSrc}" class="channel-logo" onerror="this.style.display='none'">
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:bold;">${channel.name}</span>
                <span style="font-size:0.8em; color:#aaa;">${channel.group}</span>
            </div>
        `;
        li.onclick = () => {
            loadChannel(channel.url, channel.name, channel.logo, li);
            showEPGForChannel(channel); 
        };
        channelList.appendChild(li);
    });
}

function loadChannel(url, name, logoUrl, element) {
    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    titleDisplay.innerText = name;
    if (logoUrl) { logoDisplay.src = logoUrl; logoDisplay.style.display = 'block'; } else { logoDisplay.style.display = 'none'; }
    if (Hls.isSupported()) {
        const hls = new Hls(); hls.loadSource(url); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url; video.play();
    }
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    renderList(allChannels.filter(ch => ch.name.toLowerCase().includes(term)));
});

window.onload = () => {
    const savedUrl = localStorage.getItem('saved_iptv_url');
    if (savedUrl) urlInput.value = savedUrl;
};
const m3uUrl = 'https://tinyurl.com/w777tv';
let channels = [];
let groups = [];

async function loadM3U() {
  const res = await fetch(m3uUrl);
  const text = await res.text();
  parseM3U(text);
  renderGroups();
}

function parseM3U(data) {
  const lines = data.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      const name = (line.match(/tvg-name="([^"]+)"/) || [])[1] || line.split(',')[1];
      const group = (line.match(/group-title="([^"]+)"/) || [])[1] || 'Outros';
      const logo = (line.match(/tvg-logo="([^"]+)"/) || [])[1] || '';
      const url = lines[i + 1]?.trim() || '';
      channels.push({ name, group, logo, url });
    }
  }
  groups = [...new Set(channels.map(c => c.group))];
}

function renderGroups() {
  const ul = document.getElementById('group-list');
  ul.innerHTML = '';
  groups.forEach(g => {
    const li = document.createElement('li');
    li.textContent = g;
    li.onclick = () => showChannels(g);
    ul.appendChild(li);
  });
}

function showChannels(group) {
  const ul = document.getElementById('group-list');
  ul.innerHTML = '';
  const back = document.createElement('li');
  back.textContent = '← Voltar';
  back.style.background = '#333';
  back.onclick = renderGroups;
  ul.appendChild(back);
  channels.filter(c => c.group === group).forEach(ch => {
    const li = document.createElement('li');
    li.textContent = ch.name;
    li.onclick = () => playChannel(ch);
    ul.appendChild(li);
  });
}

function playChannel(channel) {
  const video = document.getElementById('video');
  const title = document.getElementById('current-title');
  title.textContent = channel.name;

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(channel.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = channel.url;
    video.play();
  } else {
    alert('Seu navegador não suporta HLS.');
  }
}

loadM3U();
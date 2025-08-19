let mediaRecorder = null;
let audioChunkInterval = null;
let headerBlob = null;
let bloco = 0;

const resultadoDiv = document.getElementById('resultado');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const dropzone = document.getElementById('dropzone');

// Conecta ao servidor WebSocket
const socket = io(); // precisa do socket.io.js incluído no HTML

socket.on('transcricao_pronta', (data) => {
  // Quando o servidor enviar a transcrição, mostra no HTML
  resultadoDiv.innerText += `${data.transcricao}`;
});

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  if (audioChunkInterval) clearInterval(audioChunkInterval);
  mediaRecorder = new MediaRecorder(stream);
  headerBlob = null; 
  bloco = 0;
  resultadoDiv.innerText = '';

  mediaRecorder.ondataavailable = async (event) => {
    if (event.data.size > 0) {
      if (!headerBlob) {
        headerBlob = event.data;
        console.log('Header capturado');
        return; 
      }

      const combinedBlob = new Blob([headerBlob, event.data], { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio_data', combinedBlob, `bloco_${bloco}.webm`);
      bloco++;

      try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text);
        }
        const data = await response.json();
        console.log(`Bloco ${bloco} enviado`, data);


      } catch (e) {
        console.error('Erro no envio', e);
        resultadoDiv.innerText += `\n[Bloco ${bloco}] Erro: ${e.message}`;
      }
    }
  };

  mediaRecorder.start();

  mediaRecorder.onstart = () => {
    mediaRecorder.requestData();
  };

  audioChunkInterval = setInterval(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
    }
  }, 5000);

  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.requestData();
    mediaRecorder.stop();
  }
  if (audioChunkInterval) clearInterval(audioChunkInterval);
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.style.backgroundColor = '#d4f0c0'; // destaque visual
});

dropzone.addEventListener('dragleave', (e) => {
  dropzone.style.backgroundColor = 'transparent';
});

dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.style.backgroundColor = 'transparent';
  const files = e.dataTransfer.files;

  if (files.length === 0) return;
  const audioFile = files[0];

  const formData = new FormData();
  formData.append('audio_data', audioFile, audioFile.name);
  dropzone.innerText = audioFile.name;

  try {
    const response = await fetch('/upload', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Erro no upload');
    const data = await response.json();
    console.log('Arquivo enviado:', data);

    // Se quiser usar WebSocket para retorno em tempo real
    socket.emit('processar_arquivo', data.file_id);

  } catch (err) {
    console.error(err);
  }
});

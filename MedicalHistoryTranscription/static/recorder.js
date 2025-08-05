let mediaRecorder;
let audioChunks = [];

const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const resultadoDiv = document.getElementById("resultado");

startButton.onclick = async () => {
  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = event => {
    audioChunks.push(event.data);
  };

  mediaRecorder.start();
  startButton.disabled = true;
  stopButton.disabled = false;
  resultadoDiv.innerText = "🎙️ Gravando...";
};

stopButton.onclick = () => {
  mediaRecorder.stop();
  startButton.disabled = false;
  stopButton.disabled = true;
  resultadoDiv.innerText = "⏳ Processando áudio...";

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio_data', audioBlob, 'gravacao.webm');

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro do servidor: ${text}`);
    }

    const data = await response.json();
    console.log("Resposta JSON recebida:", data);

    // Exibe na div
    resultadoDiv.innerText = data.transcricao || "⚠️ Nenhuma transcrição recebida.";
  } catch (error) {
    console.error("Erro no envio ou processamento:", error);
    resultadoDiv.innerText = "❌ Erro ao processar o áudio: " + error.message;
  }
};
};



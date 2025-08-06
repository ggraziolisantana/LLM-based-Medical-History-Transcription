let mediaRecorder;
let audioChunks = [];
const resultadoDiv = document.getElementById("resultado");

document.getElementById("start").onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async() => {
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
    resultadoDiv.innerText = data.transcricao || "Nenhuma transcrição recebida.";
  } catch (error) {
    console.error("Erro no envio ou processamento:", error);
    resultadoDiv.innerText = "Erro ao processar o áudio: " + error.message;
  }
    };

    mediaRecorder.start();
    document.getElementById("start").disabled = true;
    document.getElementById("stop").disabled = false;
};

document.getElementById("stop").onclick = () => {
    mediaRecorder.stop();
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
};

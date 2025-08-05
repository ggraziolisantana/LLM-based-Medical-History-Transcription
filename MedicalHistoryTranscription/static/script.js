let mediaRecorder;
let audioChunks = [];

document.getElementById("start").onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio_data', audioBlob, 'gravacao.webm');

        fetch('/upload', {
            method: 'POST',
            body: formData
        }).then(response => response.text())
          .then(data => alert(data));

        audioChunks = [];
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

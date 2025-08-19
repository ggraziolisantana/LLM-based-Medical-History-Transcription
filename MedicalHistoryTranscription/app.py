from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import torch
import os
import time
import threading
from faster_whisper import WhisperModel
from sentence_transformers import CrossEncoder
import queue

from torch import dtype

# Fila de processamento e lock para controle de concorrência
process_queue = queue.Queue()
processing_lock = threading.Lock()
if torch.cuda.is_available():
    print("CUDA is available on this system.")
# Modelos carregados uma vez
faster_whisper_model = WhisperModel("medium", device="cuda", compute_type="int8_float32")
transformer_model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L6-v2')

# Flask + SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # habilita CORS para testes
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    audio = request.files.get('audio_data')
    if not audio:
        return jsonify({'erro': 'Nenhum arquivo de áudio recebido'}), 400

    filename = audio.filename if audio.filename else f"bloco_{int(time.time())}.webm"
    path_webm = os.path.join(UPLOAD_FOLDER, filename)
    audio.save(path_webm)

    # Passa também o session_id para enviar a transcrição depois
    session_id = request.form.get("session_id")
    adicionar_audio_para_processar(path_webm, session_id)

    return jsonify({'status': 'em processamento', 'file_id': filename})

def processar_audio(path_webm, session_id):
    with processing_lock:
        try:
            segmentos, _ = faster_whisper_model.transcribe(path_webm, language="pt")
            texto = " ".join([segment.text for segment in segmentos])
            print(f"Transcrição do arquivo {os.path.basename(path_webm)}:")
            print(texto)
            pergunta = "Está sentindo dor?"
            janelas = gerar_janelas(texto, tamanho_janela=5, passo=5)

            pares = [(pergunta, janela) for janela in janelas]
            scores = transformer_model.predict(pares)

            # Ordena do mais relevante para o menos relevante
            ranked = sorted(zip(janelas, scores), key=lambda x: x[1], reverse=True)
            melhor_janela, melhor_score = ranked[0]
            score = janelas.index(melhor_janela)
            inicio = max(0, score - 2)
            fim = min(len(janelas), score + 3)
            melhor_sentenca = " ".join(janelas[inicio:fim])

            print("Query:", pergunta)

            for idx, (janela, score) in enumerate(ranked):
                print(f"- #{idx} ({score:.2f}): {janela}")
            print("melhor sentenca:", melhor_sentenca)
            # Envia para o cliente via WebSocket
            socketio.emit(
                'transcricao_pronta',
                {
                    'file_id': os.path.basename(path_webm),
                    'transcricao': texto,
                    'ranked': [
                        {"janela": janela, "score": float(score)}
                        for janela, score in ranked
                    ]
                },
                room=session_id
            )

        except Exception as e:
            erro = f"Erro: {str(e)}"
            print(f"Erro na transcrição do arquivo {os.path.basename(path_webm)}: {e}")
            socketio.emit(
                'transcricao_pronta',
                {'file_id': os.path.basename(path_webm), 'transcricao': erro},
                room=session_id
            )

    # Processa próximo se houver
    if not process_queue.empty():
        proximo_path, prox_session_id = process_queue.get()
        threading.Thread(target=processar_audio, args=(proximo_path, prox_session_id)).start()

def adicionar_audio_para_processar(path_webm, session_id):
    process_queue.put((path_webm, session_id))
    if not processing_lock.locked():
        proximo_path, prox_session_id = process_queue.get()
        threading.Thread(target=processar_audio, args=(proximo_path, prox_session_id)).start()

def gerar_janelas(texto, tamanho_janela, passo):
    palavras = texto.split()
    janelas = []
    for i in range(0, len(palavras) - tamanho_janela + 1, passo):
        janela = palavras[i:i+tamanho_janela]
        janelas.append(" ".join(janela))
    return janelas
# Evento WebSocket para registrar a sessão
@socketio.on('connect')
def handle_connect():
    session_id = request.sid
    emit('conectado', {'session_id': session_id})

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)



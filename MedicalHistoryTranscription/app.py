from flask import Flask, render_template, request, jsonify
import os
from pydub import AudioSegment
import torch
import whisper
from sentence_transformers import SentenceTransformer, util

# Carrega o modelo 'base' (outros: tiny, small, medium, large)
whisper_model = whisper.load_model("small")
transformer_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

app = Flask(__name__)
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

    filename = 'gravacao.webm'
    path_webm = os.path.join(UPLOAD_FOLDER, filename)

    audio.save(path_webm)
    # Caminho para o arquivo de áudio
    audio_path = path_webm

    # Realiza a transcrição
    result = whisper_model.transcribe(audio_path, language = "pt")
    print("Transcrição:")
    print(result["text"])

    perguntas = [
        "Qual o seu nome completo?",
        "O que você está sentindo?",
        "Possui alguma doença crônica?",
        "Faz uso de medicamentos atualmente?",
        "Há quanto tempo sente esse sintoma?"
    ]

    segmentos = result.get("segments", [])
    resposta = [seg["text"].strip() for seg in segmentos]

    emb_perguntas = transformer_model.encode(perguntas, normalize_embeddings=True)
    emb_respostas = transformer_model.encode(resposta, normalize_embeddings=True)

    resultados = []
    for i, pergunta in enumerate(perguntas):
        scores = util.cos_sim(emb_perguntas[i], emb_respostas)[0]
        melhor_idx = scores.argmax()
        melhor_score = scores[melhor_idx].item()
        resultados.append({
            "pergunta": pergunta,
            "resposta": resposta[melhor_idx],
            "similaridade": melhor_score
        })
    print(resultados)
    return jsonify({
        "transcricao": result["text"],
        "analise": resultados
    })


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)



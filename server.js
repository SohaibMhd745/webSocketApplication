const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Charger les questions
const questions = JSON.parse(fs.readFileSync('./questions.json', 'utf8'));

// Structure pour stocker les données des salles
const rooms = new Map();

// Configuration du jeu
const GAME_CONFIG = {
    QUESTION_TIME: 15000, // 15 secondes par question
    QUESTIONS_PER_GAME: 5,
    POINTS_PER_CORRECT_ANSWER: 100
};

class GameRoom {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = new Map();
        this.currentQuestionIndex = 0;
        this.gameState = 'waiting'; // waiting, playing, finished
        this.currentQuestion = null;
        this.questionTimer = null;
        this.gameQuestions = [];
        this.questionStartTime = null;
    }

    addPlayer(socket, username) {
        this.players.set(socket.id, {
            id: socket.id,
            username: username,
            score: 0,
            answers: [],
            ready: false
        });
        socket.join(this.roomId);
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        if (this.players.size === 0) {
            this.cleanup();
        }
    }

    startGame() {
        if (this.gameState !== 'waiting') return;
        
        this.gameState = 'playing';
        this.currentQuestionIndex = 0;
        
        // Sélectionner des questions aléatoires
        this.gameQuestions = this.shuffleArray([...questions])
            .slice(0, GAME_CONFIG.QUESTIONS_PER_GAME);
        
        this.sendNextQuestion();
    }

    sendNextQuestion() {
        if (this.currentQuestionIndex >= this.gameQuestions.length) {
            this.endGame();
            return;
        }

        this.currentQuestion = this.gameQuestions[this.currentQuestionIndex];
        this.questionStartTime = Date.now();

        // Envoyer la question sans la réponse
        const questionData = {
            question: this.currentQuestion.question,
            options: this.currentQuestion.options,
            category: this.currentQuestion.category,
            questionNumber: this.currentQuestionIndex + 1,
            totalQuestions: this.gameQuestions.length,
            timeLimit: GAME_CONFIG.QUESTION_TIME
        };

        io.to(this.roomId).emit('new-question', questionData);

        // Timer pour la question
        this.questionTimer = setTimeout(() => {
            this.processQuestionResults();
        }, GAME_CONFIG.QUESTION_TIME);
    }

    submitAnswer(socketId, answer) {
        const player = this.players.get(socketId);
        if (!player || this.gameState !== 'playing') return;

        const isCorrect = answer === this.currentQuestion.answer;
        const timeElapsed = Date.now() - this.questionStartTime;
        const timeBonus = Math.max(0, GAME_CONFIG.QUESTION_TIME - timeElapsed) / 1000;
        
        let points = 0;
        if (isCorrect) {
            points = GAME_CONFIG.POINTS_PER_CORRECT_ANSWER + Math.floor(timeBonus * 10);
            player.score += points;
        }

        player.answers.push({
            questionIndex: this.currentQuestionIndex,
            answer: answer,
            isCorrect: isCorrect,
            points: points,
            timeElapsed: timeElapsed
        });

        // Confirmer la réponse au joueur
        io.to(socketId).emit('answer-submitted', {
            isCorrect: isCorrect,
            points: points,
            correctAnswer: this.currentQuestion.answer
        });
    }

    processQuestionResults() {
        if (this.questionTimer) {
            clearTimeout(this.questionTimer);
            this.questionTimer = null;
        }

        // Envoyer les résultats de la question
        const results = {
            correctAnswer: this.currentQuestion.answer,
            leaderboard: this.getLeaderboard()
        };

        io.to(this.roomId).emit('question-results', results);

        // Attendre 3 secondes avant la prochaine question
        setTimeout(() => {
            this.currentQuestionIndex++;
            this.sendNextQuestion();
        }, 3000);
    }

    endGame() {
        this.gameState = 'finished';
        const finalLeaderboard = this.getLeaderboard();
        
        io.to(this.roomId).emit('game-finished', {
            leaderboard: finalLeaderboard
        });
    }

    getLeaderboard() {
        return Array.from(this.players.values())
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                rank: index + 1,
                username: player.username,
                score: player.score
            }));
    }

    getPlayersInfo() {
        return Array.from(this.players.values()).map(player => ({
            username: player.username,
            score: player.score,
            ready: player.ready
        }));
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    cleanup() {
        if (this.questionTimer) {
            clearTimeout(this.questionTimer);
        }
        rooms.delete(this.roomId);
    }
}

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id);

    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        
        if (!roomId || !username) {
            socket.emit('error', 'Room ID et nom d\'utilisateur requis');
            return;
        }

        // Créer la salle si elle n'existe pas
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new GameRoom(roomId));
        }

        const room = rooms.get(roomId);
        
        // Vérifier si le nom d'utilisateur est déjà pris
        const existingPlayer = Array.from(room.players.values())
            .find(player => player.username === username);
        
        if (existingPlayer) {
            socket.emit('error', 'Ce nom d\'utilisateur est déjà pris dans cette salle');
            return;
        }

        room.addPlayer(socket, username);
        
        socket.emit('joined-room', {
            roomId: roomId,
            username: username,
            gameState: room.gameState
        });

        // Informer tous les joueurs de la salle
        io.to(roomId).emit('players-update', room.getPlayersInfo());
        io.to(roomId).emit('room-message', `${username} a rejoint la salle`);
    });

    socket.on('start-game', () => {
        // Trouver la salle du joueur
        for (const room of rooms.values()) {
            if (room.players.has(socket.id)) {
                if (room.players.size >= 2) {
                    room.startGame();
                } else {
                    socket.emit('error', 'Au moins 2 joueurs sont requis pour commencer');
                }
                break;
            }
        }
    });

    socket.on('submit-answer', (answer) => {
        // Trouver la salle du joueur
        for (const room of rooms.values()) {
            if (room.players.has(socket.id)) {
                room.submitAnswer(socket.id, answer);
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Déconnexion:', socket.id);
        
        // Retirer le joueur de toutes les salles
        for (const room of rooms.values()) {
            if (room.players.has(socket.id)) {
                const player = room.players.get(socket.id);
                room.removePlayer(socket.id);
                
                // Informer les autres joueurs
                io.to(room.roomId).emit('players-update', room.getPlayersInfo());
                io.to(room.roomId).emit('room-message', `${player.username} a quitté la salle`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 
// Variables globales
let socket;
let currentUser = '';
let currentRoom = '';
let gameState = 'waiting';
let currentQuestionData = null;
let timerInterval = null;
let selectedAnswer = null;

// Éléments DOM
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-room'),
    game: document.getElementById('game-screen'),
    results: document.getElementById('results-screen')
};

const elements = {
    joinForm: document.getElementById('join-form'),
    username: document.getElementById('username'),
    roomId: document.getElementById('room-id'),
    randomRoomBtn: document.getElementById('random-room'),
    currentRoomId: document.getElementById('current-room-id'),
    playersList: document.getElementById('players-list'),
    startGameBtn: document.getElementById('start-game-btn'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    roomMessages: document.getElementById('room-messages'),
    questionCounter: document.getElementById('question-counter'),
    questionCategory: document.getElementById('question-category'),
    timer: document.getElementById('timer'),
    timerProgress: document.getElementById('timer-progress'),
    currentQuestion: document.getElementById('current-question'),
    optionsContainer: document.getElementById('options-container'),
    answerFeedback: document.getElementById('answer-feedback'),
    feedbackText: document.getElementById('feedback-text'),
    pointsEarned: document.getElementById('points-earned'),
    liveLeaderboard: document.getElementById('live-leaderboard'),
    finalLeaderboard: document.getElementById('final-leaderboard'),
    playAgainBtn: document.getElementById('play-again-btn'),
    newRoomBtn: document.getElementById('new-room-btn'),
    toastContainer: document.getElementById('toast-container')
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Initialiser Socket.IO
    socket = io();
    setupSocketListeners();

    // Afficher l'écran de connexion
    showScreen('login');
}

function setupEventListeners() {
    // Formulaire de connexion
    elements.joinForm.addEventListener('submit', handleJoinRoom);
    elements.randomRoomBtn.addEventListener('click', createRandomRoom);

    // Boutons de la salle d'attente
    elements.startGameBtn.addEventListener('click', startGame);
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);

    // Boutons des résultats
    elements.playAgainBtn.addEventListener('click', playAgain);
    elements.newRoomBtn.addEventListener('click', createNewRoom);
}

function setupSocketListeners() {
    socket.on('joined-room', handleJoinedRoom);
    socket.on('players-update', updatePlayersList);
    socket.on('room-message', addRoomMessage);
    socket.on('new-question', handleNewQuestion);
    socket.on('answer-submitted', handleAnswerSubmitted);
    socket.on('question-results', handleQuestionResults);
    socket.on('game-finished', handleGameFinished);
    socket.on('error', handleError);
}

// Gestion des écrans
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Gestion de la connexion
function handleJoinRoom(e) {
    e.preventDefault();

    const username = elements.username.value.trim();
    const roomId = elements.roomId.value.trim();

    if (!username || !roomId) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }

    currentUser = username;
    currentRoom = roomId;

    socket.emit('join-room', { roomId, username });
}

function createRandomRoom() {
    const username = elements.username.value.trim();

    if (!username) {
        showToast('Veuillez entrer votre nom d\'utilisateur', 'error');
        return;
    }

    const randomRoomId = 'room-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    elements.roomId.value = randomRoomId;

    currentUser = username;
    currentRoom = randomRoomId;

    socket.emit('join-room', { roomId: randomRoomId, username });
}

function handleJoinedRoom(data) {
    elements.currentRoomId.textContent = data.roomId;
    showScreen('waiting');
    showToast(`Connecté à la salle ${data.roomId}`, 'success');

    gameState = data.gameState;
    updateGameControls();
}

// Gestion des joueurs
function updatePlayersList(players) {
    elements.playersList.innerHTML = '';

    players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.innerHTML = `
            <div class="player-info">
                <div class="player-name">${player.username}</div>
                <div class="player-score">Score: ${player.score}</div>
            </div>
        `;
        elements.playersList.appendChild(playerCard);
    });

    updateGameControls();
}

function updateGameControls() {
    const playersCount = elements.playersList.children.length;
    elements.startGameBtn.disabled = playersCount < 2 || gameState !== 'waiting';
    elements.startGameBtn.textContent = playersCount < 2
        ? `En attente (${playersCount}/2 joueurs minimum)`
        : 'Commencer le quiz';
}

// Messages de la salle
function addRoomMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
    elements.roomMessages.appendChild(messageDiv);
    elements.roomMessages.scrollTop = elements.roomMessages.scrollHeight;
}

// Gestion du jeu
function startGame() {
    socket.emit('start-game');
}

function handleNewQuestion(data) {
    currentQuestionData = data;
    selectedAnswer = null;

    // Changer d'écran si nécessaire
    if (gameState === 'waiting') {
        showScreen('game');
        gameState = 'playing';
    }

    // Mettre à jour les informations de la question
    elements.questionCounter.textContent = `Question ${data.questionNumber}/${data.totalQuestions}`;
    elements.questionCategory.textContent = data.category;
    elements.currentQuestion.textContent = data.question;

    // Cacher le feedback précédent
    elements.answerFeedback.classList.add('hidden');

    // Générer les options
    generateOptions(data.options);

    // Démarrer le timer
    startTimer(data.timeLimit);
}

function generateOptions(options) {
    elements.optionsContainer.innerHTML = '';

    options.forEach((option, index) => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'option-btn';
        optionBtn.textContent = option;
        optionBtn.addEventListener('click', () => selectAnswer(option, optionBtn));
        elements.optionsContainer.appendChild(optionBtn);
    });
}

function selectAnswer(answer, buttonElement) {
    if (selectedAnswer) return; // Déjà répondu

    selectedAnswer = answer;

    // Mettre en surbrillance la réponse sélectionnée
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('selected');
        btn.disabled = true;
    });

    buttonElement.classList.add('selected');

    // Envoyer la réponse
    socket.emit('submit-answer', answer);
}

function handleAnswerSubmitted(data) {
    elements.feedbackText.textContent = data.isCorrect ? '✅ Correct !' : '❌ Incorrect';
    elements.pointsEarned.textContent = data.isCorrect ? `+${data.points} points` : '+0 points';
    elements.answerFeedback.classList.remove('hidden');

    // Mettre en surbrillance la bonne réponse
    document.querySelectorAll('.option-btn').forEach(btn => {
        if (btn.textContent === data.correctAnswer) {
            btn.classList.add('correct');
        } else if (btn.textContent === selectedAnswer && !data.isCorrect) {
            btn.classList.add('incorrect');
        }
    });
}

function handleQuestionResults(data) {
    updateLiveLeaderboard(data.leaderboard);
}

function handleGameFinished(data) {
    gameState = 'finished';
    showScreen('results');
    updateFinalLeaderboard(data.leaderboard);
}

// Gestion du timer
function startTimer(timeLimit) {
    let timeLeft = timeLimit / 1000;
    elements.timer.textContent = timeLeft;
    elements.timerProgress.style.width = '100%';

    // Nettoyer le timer précédent
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        timeLeft--;
        elements.timer.textContent = timeLeft;

        const percentage = (timeLeft / (timeLimit / 1000)) * 100;
        elements.timerProgress.style.width = percentage + '%';

        // Changement de couleur selon le temps restant
        elements.timer.className = 'timer';
        if (timeLeft <= 5) {
            elements.timer.classList.add('danger');
        } else if (timeLeft <= 10) {
            elements.timer.classList.add('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// Gestion des classements
function updateLiveLeaderboard(leaderboard) {
    elements.liveLeaderboard.innerHTML = '';

    leaderboard.forEach(player => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <span class="leaderboard-rank">#${player.rank}</span>
            <span class="leaderboard-name">${player.username}</span>
            <span class="leaderboard-score">${player.score}</span>
        `;
        elements.liveLeaderboard.appendChild(item);
    });
}

function updateFinalLeaderboard(leaderboard) {
    elements.finalLeaderboard.innerHTML = '';

    leaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        if (index === 0) {
            item.classList.add('winner');
        }

        let emoji = '';
        if (index === 0) emoji = '🥇';
        else if (index === 1) emoji = '🥈';
        else if (index === 2) emoji = '🥉';

        item.innerHTML = `
            <span class="leaderboard-rank">${emoji} #${player.rank}</span>
            <span class="leaderboard-name">${player.username}</span>
            <span class="leaderboard-score">${player.score} points</span>
        `;
        elements.finalLeaderboard.appendChild(item);
    });
}

// Actions des boutons
function leaveRoom() {
    location.reload();
}

function playAgain() {
    gameState = 'waiting';
    showScreen('waiting');

    // Réinitialiser l'interface
    elements.answerFeedback.classList.add('hidden');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function createNewRoom() {
    location.reload();
}

// Gestion des erreurs et notifications
function handleError(message) {
    showToast(message, 'error');
}

function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    // Supprimer automatiquement le toast
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, duration);
}

// Gestion de la déconnexion
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
}); 
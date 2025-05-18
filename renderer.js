const { ipcRenderer } = require('electron');

const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');

async function handleTextMessage(text) {
    try {
        const result = await ipcRenderer.invoke('anonymize-text', text);
        if (result.success) {
            addMessageToChat('user', text);
            addMessageToChat('assistant', result.result);
        } else {
            addMessageToChat('assistant', 'Ошибка при обработке текста: ' + result.error);
        }
    } catch (error) {
        addMessageToChat('assistant', 'Произошла ошибка: ' + error.message);
    }
}

async function handleImageFile(file) {
    try {
        addMessageToChat('user', 'Обработка изображения...');
        
        const result = await ipcRenderer.invoke('anonymize-image', file.path);
        
        if (result.success) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant-message';
            
            const imgElement = document.createElement('img');
            imgElement.src = `data:image/jpeg;base64,${result.image}`;
            imgElement.className = 'processed-image';
            messageDiv.appendChild(imgElement);
            
            if (result.anonymized_text) {
                const textElement = document.createElement('p');
                textElement.textContent = result.anonymized_text;
                messageDiv.appendChild(textElement);
            }
            
            if (result.faces_detected > 0) {
                const facesInfo = document.createElement('p');
                facesInfo.className = 'faces-info';
                facesInfo.textContent = `Обнаружено лиц: ${result.faces_detected}`;
                messageDiv.appendChild(facesInfo);
            }
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            addMessageToChat('assistant', 'Ошибка при обработке изображения: ' + result.error);
        }
    } catch (error) {
        console.error('Error processing image:', error);
        addMessageToChat('assistant', 'Произошла ошибка при обработке изображения: ' + error.message);
    }
}

function addMessageToChat(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

sendButton.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text) {
        handleTextMessage(text);
        messageInput.value = '';
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            await handleImageFile(file);
        } else {
            addMessageToChat('assistant', 'Пожалуйста, загрузите изображение (JPG или PNG)');
        }
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            await handleImageFile(file);
        } else {
            addMessageToChat('assistant', 'Пожалуйста, загрузите изображение (JPG или PNG)');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    addMessageToChat('assistant', 'Добро пожаловать! Вы можете отправить текст или изображение для анонимизации.');
}); 

document.addEventListener('DOMContentLoaded', function () {
  const chatForm = document.getElementById('chat-form');
  const chatBox = document.getElementById('chat-box');
  const userInput = document.getElementById('user-input');
  const fileInput = document.getElementById('fileUpload');

  chatForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message === '') return;

    appendMessage('Du', message);
    userInput.value = '';

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      appendMessage('Lena', data.reply);
    } catch (err) {
      console.error(err);
      appendMessage('Lena', 'Ein Fehler ist aufgetreten.');
    }
  });

  fileInput.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        appendMessage('Lena', result.message);
      } else {
        appendMessage('Lena', 'Fehler beim Hochladen: ' + result.message);
      }
    } catch (error) {
      console.error(error);
      appendMessage('Lena', 'Fehler beim Hochladen.');
    }
  });

  function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

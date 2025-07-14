async function sendMessage() {
    const input = document.getElementById("user-input");
    const chatWindow = document.getElementById("chat-window");

    const message = input.value;
    if (!message) return;

    chatWindow.innerHTML += `<div><b>You:</b> ${message}</div>`;
    input.value = "";

    const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    });

    const data = await response.json();
    chatWindow.innerHTML += `<div><b>Lena:</b> ${data.reply}</div>`;
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("file-upload");
    const file = fileInput.files[0];
    const chatWindow = document.getElementById("chat-window");

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/upload", {
        method: "POST",
        body: formData,
    });

    const data = await response.json();
    chatWindow.innerHTML += `<div><b>Upload:</b> ${data.message}</div>`;
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

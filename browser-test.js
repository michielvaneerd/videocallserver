const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
    console.log("Connected");
    ws.send("Hello from the browser");
};

ws.onmessage = (event) => {
    console.log("Server says:", event.data);
};

ws.onclose = () => {
    console.log("Disconnected");
};
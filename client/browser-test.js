// Note: on localhost you can use ws:// but otherwise you must use wss://

//const ws = new WebSocket("ws://localhost:3000");
const ws = new WebSocket("wss://server.michielvaneerd.nl/api");

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
import React, { useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const Chat = ({ receiverId }) => {
    const socket = useMemo(() => io("http://localhost:8000", { withCredentials: true }), []);
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const [messagesList, setMessagesList] = useState([]);
    const [input, setInput] = useState('');
    const [socketId, setSocketId] = useState("");
    const [userSocketId, setUserSocketId] = useState("");


    const getSocketId = async () => {
        try {
            const resp = await axios.get(`http://localhost:8000/api/v1/users/getSocketId/${receiverId}`, {
                headers: { 'Authorization': token }
            });
            setUserSocketId(resp.data.data.socketId);
        } catch (err) {
            console.log("ERROR:", err);
        }
    };

    const fetchMessages = () => {
        axios.get(`http://localhost:8000/api/v1/users/messages/${userId}/${receiverId}`, {
            headers: { 'Authorization': token }
        }).then((resp) => {
            console.log("ALL THE MESSAGES", resp.data.data)

            setMessagesList(resp.data.data)
        }).catch((err) => {
            console.log("ERROR", err)
        })
    }


    useEffect(() => {
        getSocketId();
    }, [input])

    useEffect(() => {
        socket.on("connect", () => {
            setSocketId(socket.id);
            console.log("Connected", socket.id);
            const body = { userId, socketId: socket.id };

            axios.post("http://localhost:8000/api/v1/users/socketId", body, {
                headers: { 'Authorization': token }
            }).then((res) => {
                console.log("Socket ID saved:", res.data.data);
            }).catch((err) => {
                console.log("ERROR", err);
            });
        });

        fetchMessages();

        socket.on("receive-message", (data) => {
            console.log("Message received:", data);
            setMessagesList((prevMessagesList) => [...prevMessagesList, data]);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const sendMessage = (e) => {
        e.preventDefault();
        socket.emit("message", { input, receiverId, userId, userSocketId: userSocketId });
        setMessagesList([...messagesList, {sender : userId, content : input}])
        setInput("");
    };

    return (
        <div>
            <h2>Chat</h2>
            <div id="chat">
                {messagesList.map((message, index) => (
                    <div key={index}>
                        <strong>{message.sender === userId ? 'You' : 'Other'}:</strong> {message.content}
                    </div>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
        </div>
    );
};

export default Chat;

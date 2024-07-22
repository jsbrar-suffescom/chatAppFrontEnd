import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const UserList = () => {
    // FOR FETCHING USERS
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();
    const [receiverInfo, setReceiverInfo] = useState({ fullName: "", receiverId: "" });

    // FOR CHAT
    const socket = useMemo(() => io("http://localhost:8000", { withCredentials: true }), []);
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const [messagesList, setMessagesList] = useState([]);
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [eventTrigger, setEventTrigger] = useState(false);



    const [chatRoom, setChatRoom] = useState("")




    // FOR FETCHING USERS 
    const fetchUsers = async () => {
        try {
            const response = await axios.get(`http://localhost:8000/api/v1/users/getAllUsers`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log("RESP ", response.data.data)
            setUsers(response.data.data);
        } catch (error) {
            console.log("Error :: ", error)
        }
    };



    useEffect(() => {
        fetchUsers();
        setEventTrigger(false);
    }, [eventTrigger]);

    const [socketId, setSocketId] = useState("")


    useEffect(() => {

        socket.on("connect", () => {

            console.log("SOCKET ID ", socket.id)
            const body = { userId, socketId: socket.id };

            axios.post("http://localhost:8000/api/v1/users/setSocketId", body, {
                headers: { 'Authorization': token }
            }).then((res) => {
                console.log("Socket ID saved:", res.data.data);
            }).catch((err) => {
                console.log("ERROR", err);
            });

        })

        socket.emit('updateStatus', { userId, status: "online" });

        socket.on('statusUpdate', (updatedUser) => {
            setUsers(prevUsers => prevUsers.map(user => user._id === updatedUser._id ? updatedUser : user));
        });

        return () => {
            socket.disconnect()
        }
    }, []);

    // FOR RECEIVING MESSAGES IN REAL TIME
    useEffect(() => {
        // socket.on("receive-message", (data) => {

        //     // console.log("Message received:", data.sender);
        //     // console.log("RECEIVER INFO", receiverInfo.receiverId);


        //     fetchUsers();

        //     if (data.sender === receiverInfo.receiverId) {
        //         console.log("DATA FROM MSG REC" + data.sender+" "+receiverInfo.receiverId);
        //         setMessagesList((prevMessagesList) => [...prevMessagesList, data]);
        //     }




        // });
    }, [receiverInfo.receiverId]);

    const getSocketId = async () => {
        // try {
        //     const resp = await axios.get(`http://localhost:8000/api/v1/users/getSocketId/${receiverInfo.receiverId}`, {
        //         headers: { Authorization: token }
        //     });
        //     setUserSocketId(resp.data.data.socketId);
        // } catch (err) {
        //     console.log("ERROR:", err);
        // }
    };

    // FOR FETCHING MESSAGES 
    // useEffect(() => {
    //     const fetchMessages = () => {
    //         axios.get(`http://localhost:8000/api/v1/chatRoom/getChatRoomMessages/${chatRoom._id}`, {
    //             headers: { Authorization: token }
    //         }).then((resp) => {
    //             console.log("MESSSAGES :: ", resp.data.data)
    //             setMessagesList(resp.data.data);
    //         }).catch((err) => {
    //             console.log("ERROR", err);
    //         });
    //     };
    //     if(chatRoom){
    //         fetchMessages()
    //     }
    // }, [chatRoom])








    // useEffect(() => {
    //     if (currentRoom) {
    //         socket.emit('joinRoom', { roomId: currentRoom._id, userId: user._id });
    //         const fetchMessages = async () => {
    //             const { data } = await axios.get(`/api/messages/${currentRoom._id}`);
    //             setMessagesList(data);
    //         };


    //     }
    // }, [chatRoom]);

    useEffect(() => {
        socket.on('receiveMessage', (newMessage) => {
            console.log("CHAT ROOM", chatRoom)
            console.log("IDSSSS ::>> ", newMessage.chatRoomId, chatRoom._id)
            if (newMessage.chatRoomId === chatRoom._id) {
                setMessagesList((prevMessages) => [...prevMessages, newMessage]);
            }

        });

        return () => {
            socket.off('receiveMessage');
        };
    }, [chatRoom]);

    const sendMessage = async (e) => {
        e.preventDefault();
    
        if (!content && !files) {
            return;
        }
    
        if (files && files.length > 0) {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('file', files[i]); // 'file' should match the key used in multer
            }
    
            try {
                const response = await axios.post('http://localhost:8000/api/v1/chatRoom/uploadImages', formData, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'multipart/form-data'
                    }
                });
    
                const imageUrls = response.data.urls;
        
                socket.emit("sendMessage", { content: imageUrls, userId, roomId: chatRoom._id, isImage: true });
               
    
                setFiles(null); // Reset the files state
    
            } catch (error) {
                alert("Error uploading files");
                console.log("Error:", error);
            }
    
        } else {
            socket.emit('sendMessage', { roomId: chatRoom._id, userId, content });
            setContent('');
        }
    };

    

    useEffect(() => {
        if (chatRoom) {
            console.log("CHAT ROOOOOOOOM IDDDD ??? ", chatRoom._id)
            socket.emit('joinRoom', { roomId: chatRoom._id, userId: userId });
            const fetchMessages = () => {
                axios.get(`http://localhost:8000/api/v1/chatRoom/getChatRoomMessages/${chatRoom._id}`, {
                    headers: { Authorization: token }
                }).then((resp) => {
                    console.log("MESSSAGES :: ", resp.data.data)
                    setMessagesList(resp.data.data);
                }).catch((err) => {
                    console.log("ERROR", err);
                });
            };

            fetchMessages()

        }
    }, [chatRoom]);



    // FOR SELECTING USER TO WHOM WE ARE SENDING MESSAGE 
    const selectUser = (user) => {
        setReceiverInfo({ receiverId: user._id, fullName: user.fullName });
        getChatRoom(user._id);

    };

    const getChatRoom = (receiverId) => {
        const body = {
            userId: userId,
            receiverId: receiverId
        }
        // console.log("IDS ", body.userId, body.receiverId)
        axios.post("http://localhost:8000/api/v1/chatRoom/createChatRoom", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            console.log("rresp data ", resp.data.data)
            setChatRoom(resp.data.data)
        }).catch((err) => {
            console.log("ERROR :: ", err)
        })
    }

    const handleFileChange = (e) => {
        setFiles(e.target.files); // Note: `e.target.files` is a FileList, handle multiple files
    };

    const [chatRooms, setChatRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');

    // useEffect(() => {
    //     const fetchChatRooms = async () => {
    //         const { data } = await axios.get(`/api/chatrooms/user/${user._id}`);
    //         setChatRooms(data);
    //     };

    //     fetchChatRooms();
    // }, [userId]);

    return (
        <>
            <div id="wrapper">
                <div id="loadgrid">
                    <div className="tabs-left">
                        <div id="title_starts" className="chat-title">
                            <ul className="nav nav-tabs">
                                <span className="search">
                                    <input type="text" value="Search" className="input_search" /></span>
                                {
                                    users.map((user) => (
                                        <li key={user._id} className="active" onClick={() => { selectUser(user) }}><a><h3 className="name">{user.fullName}</h3><span className={user.status === "online" ? "online" : "offline"}></span><h4 className="sub-msg">{user.content}</h4><h4 className="min">1 min</h4></a></li>
                                    ))
                                }
                            </ul>
                        </div>
                        <div className="tab-content chat-des">
                            <div id="conversation_starts" className="tab-pane active"><span className="title">
                                <h3>{receiverInfo.fullName}</h3>

                                <span className="video icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_vdo.png" alt="" /></span>
                                <span className="call icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_call.png" alt="" /></span>
                                <span className="star icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_star.png" alt="" /></span>
                            </span>
                                <div className="message-info">
                                    {
                                        messagesList.map((message) => (
                                            <div key={message._id} className={message.sender._id === userId || message.sender === userId ? "full snd_row" : "full"}>
                                                <img src="https://akshaysyal.files.wordpress.com/2017/03/profile.jpg" className="dp" alt="profile" />

                                                {message.isImage ? (
                                                    message.imageUrl.map((url) => <img src={url} alt="Sent Image" style={{ width: "300px", borderRadius: "none" }} />)
                                                ) : (
                                                    <span className="text">
                                                        <span>{message.content}</span>
                                                    </span>
                                                )}

                                                <h5>{new Date(message.createdAt).toLocaleString()}</h5>
                                            </div>
                                        ))
                                    }
                                </div>
                                <form onSubmit={sendMessage}>
                                    <div className="reply">
                                        <div className="attach">
                                            <a href="#"><div className="custom-file-upload">
                                                <label htmlFor="file-upload"><img src="https://akshaysyal.files.wordpress.com/2017/03/attch_big.png" alt="" width="16" /></label>
                                                <input multiple id='file-upload' type="file" onChange={handleFileChange} />
                                            </div></a>
                                        </div>

                                        <div className="reply-area">
                                            <textarea className="form-control" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your message...."></textarea>
                                        </div>
                                        <div className="reply-submit">
                                            <button type="submit" className="btn btn-default simple-btn text-center"><img src="https://akshaysyal.files.wordpress.com/2017/03/send_icon.png" alt="send" /></button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserList;

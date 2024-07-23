import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Modal from 'react-modal';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [receiverInfo, setReceiverInfo] = useState({ fullName: "", receiverId: "" });
    const [messagesList, setMessagesList] = useState([]);
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [userDetails, setUserDetails] = useState("");
    const [chatRoom, setChatRoom] = useState("");
    const [allChatRooms, setAllChatRooms] = useState([]);
    const [selectedChatRoomIds, setSelectedChatRoomIds] = useState([]); // State for selected chat rooms
    const [groupName, setGroupName] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navigate = useNavigate();
    const socket = useMemo(() => io("http://localhost:8000", { withCredentials: true }), []);
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    // Fetch User Details
    const fetchUserDetails = () => {
        axios.get("http://localhost:8000/api/v1/users/getUserDetails", {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            setUserDetails(resp.data.data);
        }).catch((error) => {
            console.log("ERROR : ", error);
        });
    };

    // Fetch All Chat Rooms
    const fetchAllChatRooms = () => {
        axios.get(`http://localhost:8000/api/v1/chatRoom/getChatRooms/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            setAllChatRooms(resp.data.data);
        }).catch((error) => {
            console.log("ERROR :: ", error);
        });
    };

    // Fetch Users
    const fetchUsers = async () => {
        try {
            const response = await axios.get(`http://localhost:8000/api/v1/users/getAllUsers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data.data);
        } catch (error) {
            console.log("Error :: ", error);
        }
    };

    useEffect(() => {
        fetchUserDetails();
        fetchUsers();
        fetchAllChatRooms();

        socket.on("connect", () => {
            const body = { userId, socketId: socket.id };
            axios.post("http://localhost:8000/api/v1/users/setSocketId", body, {
                headers: { 'Authorization': token }
            }).then((res) => {
                console.log("Socket ID saved:", res.data.data);
            }).catch((err) => {
                console.log("ERROR", err);
            });
        });

        socket.emit('updateStatus', { userId, status: "online" });

        socket.on('statusUpdate', (updatedUser) => {
            setUsers(prevUsers => prevUsers.map(user => user._id === updatedUser._id ? updatedUser : user));
        });

        return () => {
            socket.disconnect();
        };
    }, [socket, userId, token]);

    useEffect(() => {
        if (chatRoom) {
            socket.emit('joinRoom', { roomId: chatRoom._id, userId });
            const fetchMessages = () => {
                axios.get(`http://localhost:8000/api/v1/chatRoom/getChatRoomMessages/${chatRoom._id}`, {
                    headers: { Authorization: token }
                }).then((resp) => {
                    setMessagesList(resp.data.data);
                }).catch((err) => {
                    console.log("ERROR", err);
                });
            };
            fetchMessages();

            socket.on('receiveMessage', (newMessage) => {
                if (newMessage.chatRoomId === chatRoom._id) {
                    setMessagesList((prevMessages) => [...prevMessages, newMessage]);
                }
            });

            return () => {
                socket.off('receiveMessage');
            };
        }
    }, [chatRoom, socket, token]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!content && !files) return;

        if (files && files.length > 0) {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('file', files[i]);
            }

            try {
                const response = await axios.post('http://localhost:8000/api/v1/chatRoom/uploadImages', formData, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                const imageUrls = response.data.urls;
                socket.emit("sendMessage", { fullName: userDetails.fullName, content: imageUrls, userId, roomId: chatRoom._id, isImage: true });
                setFiles(null);
            } catch (error) {
                alert("Error uploading files");
                console.log("Error:", error);
            }
        } else {
            socket.emit('sendMessage', { fullName: userDetails.fullName, roomId: chatRoom._id, userId, content });
            setContent('');
        }
    };

    const selectRoom = (room) => {
        if (room.isGroup) {
            setReceiverInfo({ receiverId: room._id, fullName: room.groupName });
            setChatRoom(room);
        } else {
            setReceiverInfo({ receiverId: room.otherMemberDetails[0]._id, fullName: room.otherMemberDetails[0].fullName });
            setChatRoom(room);
        }
    };

    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleCheckboxChange = (event, id) => {
        if (event.target.checked) {
            setSelectedChatRoomIds([...selectedChatRoomIds, id]);
        } else {
            setSelectedChatRoomIds(selectedChatRoomIds.filter((selectedId) => selectedId !== id));
        }
    };

    const handleCreateButtonClick = () => {
        console.log('Selected IDs:', selectedChatRoomIds, groupName);
        const body = {
            userId : userDetails._id,
            groupName,
            membersIds : selectedChatRoomIds
        }
        axios.post("http://localhost:8000/api/v1/chatRoom/createGroupChatRoom", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            alert("GROUP CREATED SUCCESSFULLY");
            console.log("Resp GROUP ::: ", resp.data.data);
        }).catch((error) => {
            console.log("ERROR >> ", error)
        })
        handleModalToggle();
    };

    const handleModalToggle = () => {
        setIsModalOpen(!isModalOpen);
    };

    return (
        <>
            <div id="wrapper">
                <div id="loadgrid">
                    <div className="tabs-left">
                        <div id="title_starts" className="chat-title">
                            <ul className="nav nav-tabs">
                                <span className="search" style={{ color: "white" }}>
                                    <input type="text" value="Search" className="input_search" />
                                    <img
                                        style={{ width: "10%", marginLeft: "10px" }}
                                        onClick={handleModalToggle}
                                        src='./plus.png'
                                        alt="Add"
                                    />
                                </span>
                                {allChatRooms.map((room) => (
                                    <li key={room._id} className="active" onClick={() => { selectRoom(room) }}>
                                        <a>
                                            <h3 className="name">{room.isGroup ? room.groupName : room.otherMemberDetails[0].fullName}</h3>
                                            <h4 className="sub-msg">{room.content}</h4>
                                            <h4 className="min">1 min</h4>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="tab-content chat-des">
                            <div id="conversation_starts" className="tab-pane active">
                                <span className="title">
                                    <h3>{receiverInfo.fullName}</h3>
                                    <span className="video icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_vdo.png" alt="video" /></span>
                                    <span className="call icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_call.png" alt="call" /></span>
                                    <span className="star icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_star.png" alt="star" /></span>
                                </span>
                                <div className="message-info">
                                    {messagesList.map((message) => (
                                        <div key={message._id} className={message.sender._id === userId || message.sender === userId ? "full snd_row" : "full"}>
                                            <img src="https://akshaysyal.files.wordpress.com/2017/03/profile.jpg" className="dp" alt="profile" />
                                            <span className="text">
                                                <p><strong style={{ color: "black" }}>{userId === message.sender ? "You" : message.fullName ? message.fullName : message.senderDetails.fullName}</strong></p>
                                                {message.isImage ? (
                                                    message.imageUrl.map((url) => <img src={url} alt="Sent" style={{ width: "300px", borderRadius: "none" }} />)
                                                ) : (
                                                    <span>{message.content}</span>
                                                )}
                                            </span>
                                            <h5>{new Date(message.createdAt).toLocaleString()}</h5>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={sendMessage}>
                                    <div className="reply">
                                        <div className="attach">
                                            <a href="#">
                                                <div className="custom-file-upload">
                                                    <label htmlFor="file-upload">
                                                        <img src="https://akshaysyal.files.wordpress.com/2017/03/attch_big.png" alt="attach" width="16" />
                                                    </label>
                                                    <input multiple id='file-upload' type="file" onChange={handleFileChange} />
                                                </div>
                                            </a>
                                        </div>
                                        <div className="reply-area">
                                            <textarea
                                                className="form-control"
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                placeholder="Type your message...."
                                            ></textarea>
                                        </div>
                                        <div className="reply-submit">
                                            <button type="submit" className="btn btn-default simple-btn text-center">
                                                <img src="https://akshaysyal.files.wordpress.com/2017/03/send_icon.png" alt="send" />
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                <Modal
                    isOpen={isModalOpen}
                    onRequestClose={handleModalToggle}
                    contentLabel="Create Group Modal"
                >
                    <h2>Create Group</h2>
                    <input type='text' placeholder='Enter Group Name' onChange={(e) => setGroupName(e.target.value)} />

                    <ul>
                        {allChatRooms.map((room) => (
                            !room.isGroup && (
                                <li key={room._id}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            onChange={(e) => handleCheckboxChange(e, room.otherMemberDetails[0]._id)}
                                        />
                                        {room.otherMemberDetails[0].fullName}
                                    </label>
                                </li>
                            )
                        ))}

                    </ul>
                    <button onClick={handleCreateButtonClick}>Create</button>
                    <button onClick={handleModalToggle}>Close</button>
                </Modal>
            </div>
        </>
    );
};

export default UserList;

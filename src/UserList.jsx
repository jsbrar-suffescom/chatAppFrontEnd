import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Modal from 'react-modal';
import EmojiPicker from 'emoji-picker-react';
import mongoose from 'mongoose'
import { saveAs } from 'file-saver';
import { nanoid } from "nanoid"

const UserList = () => {

    const [receiverInfo, setReceiverInfo] = useState({ fullName: "", receiverId: "" });
    const [messagesList, setMessagesList] = useState([]);
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [userDetails, setUserDetails] = useState("");
    const [chatRoom, setChatRoom] = useState("");
    const [allChatRooms, setAllChatRooms] = useState([]);
    const [selectedChatRoomIds, setSelectedChatRoomIds] = useState([]);
    const [groupName, setGroupName] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
    const [isViewImageModalOpen, setIsViewImageModalOpen] = useState(false)
    const [usersAfterSearch, setUsersAfterSearch] = useState([])
    const [resendContent, setResendContent] = useState("")
    const [failedMessages, setFailedMessages] = useState([])

    // const socket = useMemo(() => io("http://localhost:8000", { withCredentials: true }), []);
    const socket = useMemo(() => io('http://localhost:8000', {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        randomizationFactor: 0.5
    }), []);
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    useEffect(() => {
        console.log("SOCKET DATA", socket)
    }, [socket])

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
            console.log("ALL CHAT ROOM DATA :: ", resp.data.data)
            setAllChatRooms(resp.data.data);
        }).catch((error) => {
            console.log("ERROR :: ", error);
        });
    };

    useEffect(() => {
        fetchUserDetails();
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
            setAllChatRooms((prevRooms) => {
                // Check if prevRooms is an array
                if (Array.isArray(prevRooms)) {
                    return prevRooms.map(room => {
                        // Check if otherMemberDetails is defined and has at least one element
                        const updatedMemberDetails = room.otherMemberDetails && room.otherMemberDetails.length > 0
                            ? [
                                {
                                    ...room.otherMemberDetails[0],
                                    status: room.otherMemberDetails[0]._id === updatedUser._id ? updatedUser.status : room.otherMemberDetails[0].status
                                }
                            ]
                            : [];

                        return {
                            ...room,
                            otherMemberDetails: updatedMemberDetails
                        };
                    });
                }

                // If prevRooms is not an array, return it as-is
                return prevRooms;
            });


            setReceiverInfo((prevUser) =>
                prevUser.receiverId === updatedUser._id
                    ? { ...prevUser, status: updatedUser.status }
                    : prevUser
            );
        });



        getFriendRequests();

        console.log("ROOM DATA", allChatRooms)
        return () => {
            socket.emit('updateStatus', { userId, status: "offline" });
            socket.disconnect();
        };
    }, [socket, userId, token, resendContent]);

    const sortChat = (roomId, latestMessage) => {
        setAllChatRooms((prevRooms) => {
            const index = prevRooms.findIndex((room) => room._id === roomId);
            if (index === -1) return prevRooms;

            const updatedRooms = [...prevRooms];
            const [room] = updatedRooms.splice(index, 1);

            room.latestMessageDetail = {
                content: latestMessage,
            };

            return [room, ...updatedRooms];
        });
    };

    useEffect(() => {
        if (chatRoom) {
            socket.emit('joinRoom', { roomId: chatRoom._id, userId });
            const fetchMessages = () => {
                axios.get(`http://localhost:8000/api/v1/chatRoom/getChatRoomMessages/${chatRoom._id}`, {
                    headers: { Authorization: token }
                }).then((resp) => {
                    // Retrieve and parse failed messages from localStorage
                    const storedFailedMessages = localStorage.getItem('failedMessages');
                    const failedMessagesList = storedFailedMessages ? JSON.parse(storedFailedMessages) : [];
            
                    // Filter failed messages to only include those that belong to the current chat room
                    const relevantFailedMessages = failedMessagesList.filter(failedMessage => chatRoom._id === failedMessage.chatRoomId);
            
                    // Combine fetched messages with relevant failed messages
                    const combinedMessages = [...resp.data.data, ...relevantFailedMessages];
            
                    // Sort combined messages based on createdAt property
                    const sortedMessages = combinedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            
                    // Set the messages list state with the sorted messages
                    setMessagesList(sortedMessages);
            
                    // Optionally, set the failed messages state
                    setFailedMessages(relevantFailedMessages);
            
                    // Optionally, clear failed messages from localStorage
                    // localStorage.setItem('failedMessages', JSON.stringify([]));
                }).catch((err) => {
                    console.log("ERROR", err);
                });
            };
            
            fetchMessages();

            socket.on('receiveMessage', (newMessage) => {
                console.log("RECEIVE MESSAGE REACHED")
                if (newMessage.chatRoomId === chatRoom._id) {
                    setMessagesList((prevMessages) => [...prevMessages, newMessage]);
                }
                sortChat(newMessage.chatRoomId, newMessage.content)
            });

            return () => {
                socket.off('receiveMessage');
            };
        }
    }, [chatRoom, socket, token, resendContent]);



    const resendMessage = (message) => {
        if (socket.connected) {
            socket.emit('joinRoom', { roomId: chatRoom._id, userId });
            console.log("RESPONSE AFTER FAILURE");
            if (message.error) {
                const { content, chatRoomId } = message;
                socket.emit('sendMessage', { fullName: userDetails.fullName, roomId: chatRoomId, userId, content }, (response) => {
                    if (response.success) {
                        // Update messagesList and failedMessages
                        setMessagesList((prevMessages) => prevMessages.filter((msg) => msg._id !== message._id));
                        setFailedMessages((prevFailedMessages) => {
                            const updatedFailedMessages = prevFailedMessages.filter((msg) => msg._id !== message._id);
                            localStorage.setItem('failedMessages', JSON.stringify(updatedFailedMessages));
                            return updatedFailedMessages;
                        });
                        console.log("MESSAGE LIST", messagesList)
                    } else {
                        console.log("Resend failed");
                    }
                });
            }
        }
    };
    
    const [socketConnection, setSocketConnection] = useState(false)


    const sendMessage = async (e) => {
        e.preventDefault()

        if(socketConnection){
            socket.emit('joinRoom', { roomId: chatRoom._id, userId });
        }


        if (!content && (!files || files.length === 0)) return;

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
                socket.emit("sendMessage", { fullName: userDetails.fullName, content: imageUrls, userId, roomId: chatRoom._id, isImage: true }, (response) => {
                    console.log("RESPONSE >> ", response)
                });
                setFiles(null);
            } catch (error) {
                alert("FAILED TO SEND FILE");
                setFiles(null)
                console.log("Error:", error);
            }
        } else if (content) {
            if(socket.connected){
                const data = socket.emit('sendMessage', { fullName: userDetails.fullName, roomId: chatRoom._id, userId, content }, (response) => {

                    if (!response.success) {
    
                        const messageFailed = {
                            _id: nanoid(),
                            content: content,
                            isImage: false,
                            sender: userDetails._id,
                            chatRoomId: chatRoom._id,
                            createdAt: Date.now(),
                            error: true
                        }
    
                        setMessagesList([...messagesList, messageFailed]);
    
                        setFailedMessages([...failedMessages, messageFailed])
    
                    }
                    else{
                        setSocketConnection(false)
                    }
                });
            }
            else{
                setSocketConnection(true)
                alert("SOCKET DISCCONECT")
                const messageFailed = {
                    _id: nanoid(),
                    content: content,
                    isImage: false,
                    sender: userDetails._id,
                    chatRoomId: chatRoom._id,
                    createdAt: Date.now(),
                    error: true
                }
                setMessagesList([...messagesList, messageFailed]);

                setFailedMessages([...failedMessages, messageFailed])
            }

            setContent('');
            console.log("FAILED MESSAGES", failedMessages)


        }


    };

    useEffect(() => {
            localStorage.setItem('failedMessages', JSON.stringify(failedMessages));
    }, [failedMessages]);


    const selectRoom = (room) => {
        if (room.isGroup) {
            setReceiverInfo({ receiverId: room._id, fullName: room.groupName });
            setChatRoom(room);
        } else {

            setReceiverInfo({ receiverId: room.otherMemberDetails[0]?._id, fullName: room.otherMemberDetails[0]?.fullName, status: room.otherMemberDetails[0].status });
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
        const body = {
            userId: userDetails._id,
            groupName,
            membersIds: selectedChatRoomIds
        }
        axios.post("http://localhost:8000/api/v1/chatRoom/createGroupChatRoom", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            alert("GROUP CREATED SUCCESSFULLY");
            fetchAllChatRooms();
            console.log("Resp GROUP ::: ", resp.data.data);
        }).catch((error) => {
            console.log("ERROR >> ", error)
        })
        handleModalToggle();
    };

    const handleModalToggle = () => {
        setIsModalOpen(!isModalOpen);
    };

    const handleAddFriendModalToggle = () => {
        setIsAddFriendModalOpen(!isAddFriendModalOpen);
    };

    const [imageUrl, setImageUrl] = useState("")

    const handleViewImageModalToggle = (url) => {
        setImageUrl(url)
        setIsViewImageModalOpen(!isViewImageModalOpen)
    }

    // SEARCHING USERS 


    const getUserBySearch = (e) => {
        axios.get("http://localhost:8000/api/v1/users/getUsersBySearch", {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                searchValue: e.target.value
            }
        })
            .then((resp) => {
                setUsersAfterSearch(resp.data.data)
                console.log(resp.data.data)
            })
            .catch((error) => {
                console.log("ERROR >> ", error)
            });
    }


    const sendFriendRequest = (receiverId, index) => {
        const body = {
            receiverId
        }
        axios.post("http://localhost:8000/api/v1/friendRequest/sendRequest", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            alert(resp.data.message)
            setUsersAfterSearch((prevUsers) =>
                prevUsers.map((user, i) =>
                    i === index
                        ? { ...user, isFriendRequestSent: true }
                        : user
                )
            );
        }).catch((error) => {
            console.log("ERROR : ", error)
        })
    }

    const [friendRequests, setFriendRequests] = useState([])

    const getFriendRequests = () => {
        axios.get("http://localhost:8000/api/v1/friendRequest/getRequests", {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            console.log("RESP >> >> > > ", resp.data.data)
            setFriendRequests(resp.data.data)
        }).catch((error) => {
            console.log("ERROR : ", error)
        })
    }

    const acceptRequest = (senderId, i) => {
        const body = {
            senderId
        }
        axios.post("http://localhost:8000/api/v1/friendRequest/acceptRequest", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            alert(resp.data.message)
            setFriendRequests(friendRequests.slice(i, 1))
            createChatRoom(senderId)


        }).catch((error) => {
            console.log("ERROR : ", error)
        })
    }

    const declineRequest = (senderId, i) => {
        const body = {
            senderId
        }
        axios.post("http://localhost:8000/api/v1/friendRequest/rejectRequest", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            alert(resp.data.message)
            setFriendRequests(friendRequests.slice(i, 1))
        }).catch((error) => {
            console.log("ERROR : ", error)
        })
    }

    const createChatRoom = (senderId) => {
        const body = {
            userId: senderId,
            receiverId: userId
        }
        axios.post("http://localhost:8000/api/v1/chatRoom/createChatRoom", body, {
            headers: { Authorization: `Bearer ${token}` }
        }).then((resp) => {
            console.log(resp.data.data)
            fetchAllChatRooms();
        }).catch((error) => {
            console.log("ERROR >> ", error)
        })
    }

    const [pickerVisible, setPickerVisible] = useState(false);

    // Handle emoji picker visibility
    const handleEmojiPickerClick = () => {
        setPickerVisible(!pickerVisible);
    };

    // Handle emoji selection
    const handleEmojiClick = (emojiData) => {
        setContent((prevContent) => prevContent + emojiData.emoji);
        setPickerVisible(false); // Hide the picker after selecting an emoji
    };

    const handleFileDownload = async (url, filename) => {
        try {
            const response = await axios({
                url: url,
                method: 'GET',
                responseType: 'blob', // Important for downloading files
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
            });

            // Using FileSaver to save the file
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            saveAs(blob, filename);
        } catch (error) {
            console.error("Error downloading the file", error);
        }
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
                                    <img
                                        style={{ width: "10%", marginLeft: "10px" }}
                                        onClick={handleAddFriendModalToggle}
                                        src='./add-friend.png'
                                        alt="Add Friend"
                                    />
                                </span>
                                {allChatRooms.map((room) => (
                                    <li key={room._id} className="active" onClick={() => { selectRoom(room) }}>
                                        <a>
                                            <h3 className="name">{room.isGroup ? room.groupName : room.otherMemberDetails[0]?.fullName}</h3>
                                            <h4 className="sub-msg">{room?.latestMessageDetail?.content}</h4>
                                            <h4 className="min">{room.createdAt}</h4>
                                        </a>
                                    </li>
                                ))}
                            </ul>

                        </div>
                        <div className="tab-content chat-des">
                            <div id="conversation_starts" className="tab-pane active">
                                <span className="title">
                                    <h3>{receiverInfo.fullName} <br /> <span style={{ color: 'forestgreen' }}>{receiverInfo.status === "online" ? receiverInfo.status : null}</span></h3>
                                    <span className="video icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_vdo.png" alt="video" /></span>
                                    <span className="call icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_call.png" alt="call" /></span>
                                    <span className="star icons"><img src="https://akshaysyal.files.wordpress.com/2017/03/icon_star.png" alt="star" /></span>
                                </span>
                                <div className="message-info">
                                    {messagesList.map((message) => (
                                        <div key={message._id} className={message.sender._id === userId || message.sender === userId ? "full snd_row" : "full"}>
                                            <img src="https://akshaysyal.files.wordpress.com/2017/03/profile.jpg" className="dp" alt="profile" />
                                            <span className="text">
                                                <p><strong style={{ color: "black" }}>{userId === message.sender ? "You" : message.fullName || message.senderDetails.fullName}</strong></p>
                                                {message.isImage ? (
                                                    message.imageUrl.map((url) => (
                                                        <div key={url} style={{ position: 'relative', display: 'inline-block' }}>
                                                            <img onClick={() => handleViewImageModalToggle(url)} src={url} alt="Sent" style={{ width: "300px", borderRadius: "none" }} />
                                                            <div style={{ position: 'absolute', bottom: '0', right: '0', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px 5px', borderRadius: '3px', textDecoration: 'none' }} onClick={() => handleFileDownload(url)}>Download</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span>{message.content}</span>
                                                )}
                                                {message.error && message.sender === userDetails._id && (
                                                    <p onClick={() => resendMessage(message)} style={{ color: "red" }}>Failed to send message. Click Here to Retry</p>
                                                )}
                                            </span>
                                            <h5>{new Date(message.createdAt).toLocaleString()}</h5>
                                        </div>
                                    ))}

                                </div>
                                {pickerVisible && (
                                    <div className="emoji-picker-container">
                                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                                    </div>
                                )}

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
                                            <div className="emoji-picker-container">
                                                <button className='emojiButton' type="button" onClick={handleEmojiPickerClick}>
                                                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsW9jY3LK2tu209eJIrWFGplzDtJVNzJeUHg&s" alt="emoji" width="20" />
                                                </button>
                                            </div>
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
                                            onChange={(e) => handleCheckboxChange(e, room.otherMemberDetails[0]?._id)}
                                        />
                                        {room.otherMemberDetails[0]?.fullName}
                                    </label>
                                </li>
                            )
                        ))}
                    </ul>
                    <button onClick={handleCreateButtonClick}>Create</button>
                    <button onClick={handleModalToggle}>Close</button>
                </Modal>
                <Modal
                    isOpen={isAddFriendModalOpen}
                    onRequestClose={handleAddFriendModalToggle}
                    contentLabel="Add Friend Modal"
                >
                    <div className='addFriendsBody'>
                        <div className='container'>
                            <div className='search'>
                                <div className='row justify-content-center'>
                                    <div className='col-lg-6'>
                                        <div className='addFriendUserSearch'>
                                            <input type='text' onChange={(e) => getUserBySearch(e)} placeholder='search users' />
                                        </div>
                                    </div>
                                </div>

                                <div className='row justify-content-center'>
                                    <div className='col-lg-6'>
                                        <div className='addFriendUsersList'>

                                            <table class="table table-dark">

                                                <tbody>
                                                    {usersAfterSearch.map((user, i) => (
                                                        <tr key={user.username}>
                                                            <th scope="row">{user.username}</th>
                                                            {user.isFriends ? <td style={{ textAlign: 'left' }}>Friends</td> : user.isFriendRequestSent ? <td style={{ textAlign: 'left' }}>Request Sent</td> : <td onClick={() => sendFriendRequest(user._id, i)} style={{ textAlign: 'left' }}>Add Friend</td>}
                                                        </tr>
                                                    ))}
                                                </tbody>

                                            </table>

                                        </div>
                                    </div>
                                </div>
                                <br /><br />
                                <h2 style={{ textAlign: 'center' }}>Friend Requests</h2>

                                <div className='row justify-content-center'>
                                    <div className='col-lg-6'>
                                        <div className='getFriendRequests'>

                                            <table class="table table-dark">

                                                <tbody>
                                                    {
                                                        friendRequests.map((user) => <tr>
                                                            <th scope="row">{user.fullName}</th>
                                                            <td onClick={() => acceptRequest(user._id)}>Accept</td>
                                                            <td onClick={() => declineRequest(user._id)}>Decline</td>
                                                        </tr>)
                                                    }
                                                </tbody>

                                            </table>

                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleAddFriendModalToggle}>Close</button>
                        </div>
                    </div>
                </Modal>



                <Modal
                    isOpen={isViewImageModalOpen}
                    onRequestClose={handleViewImageModalToggle}
                    contentLabel="Add Friend Modal"
                >
                    <div className='addFriendsBody'>
                        <div className='container'>
                            <div className='row align-items-center justify-content-center'>
                                <div className='col-lg-12'>
                                    <div style={{ textAlign: "center", maxWidth: "100%" }}>
                                        <img style={{ width: "100%", maxHeight: "100vh", objectFit: "contain" }} src={imageUrl} alt="Friend" />
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleViewImageModalToggle}>Close</button>
                        </div>
                    </div>

                </Modal>
            </div>
        </>
    );
};

export default UserList;

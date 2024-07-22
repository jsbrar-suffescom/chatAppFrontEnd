import React, { useState } from 'react';
import './App.css';
import Login from './Login';
import UserList from './UserList';
import Chat from './Chat';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';


function App() {

    const [receiverId, setReceiverId] = useState(null); // State to store the receiver ID


    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login/>} />
                {/* Pass setReceiverId to UserList */}
                <Route path="/userLists" element={<UserList setReceiverId={setReceiverId} />} />
                {/* Pass userId and receiverId to Chat */}
                <Route path="/chat" element={<Chat receiverId={receiverId} />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

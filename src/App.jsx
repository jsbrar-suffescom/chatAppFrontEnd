import React, { useState } from 'react';
import './App.css';
import Login from './Login';
import UserList from './UserList';
import { BrowserRouter, Route, Routes } from 'react-router-dom';



function App() {

  


    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login/>} />
                {/* Pass setReceiverId to UserList */}
                <Route path="/userLists" element={<UserList/>} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

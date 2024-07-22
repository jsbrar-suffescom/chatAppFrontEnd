// src/Login.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';


const Login = ({ setUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const navigate = useNavigate();


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/api/v1/users/login', { email, password });

            const accessToken = response.data.data.accessToken;
            localStorage.setItem('token', accessToken);
            localStorage.setItem('userId', response.data.data.user._id)
            navigate('/userLists')

        } catch (err) {
            setError('Invalid email or password');
            console.log("ERROR MESSAGE :: ", err)
        }
    };

    return (

        <>
            <div className='login-page-main'>
                <form onSubmit={handleSubmit}>
                    <div class="login-form">
                        <h1>Hello!</h1>
                        <p class="login-motd">Please Login Here</p>
                        <div class="form-group">
                            <input id="email" class="login-username" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                            <label for="Email">
                                <svg>
                                    <use xlink:href="#user" />
                                </svg>
                            </label>
                        </div>
                        <div class="form-group">
                            <input id="password" class="login-password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                            <label for="password">
                                <svg>
                                    <use xlink:href="#padlock" />
                                </svg>
                            </label>
                            {error && <p style={{ color: 'red' }}>{error}</p>}
                        </div>
                        <div class="form-group">
                            <input class="login-submit" type="submit" value="Log in" />
                        </div>
                        <a href="#" class="login-forgotpassword">Forgot Password?</a>
                    </div>
                </form>
                <svg>
                    <symbol id="user" viewBox="0 0 1792 1792">
                        <path d="M1329 784q47 14 89.5 38t89 73 79.5 115.5 55 172 22 236.5q0 154-100 263.5t-241 109.5h-854q-141 0-241-109.5t-100-263.5q0-131 22-236.5t55-172 79.5-115.5 89-73 89.5-38q-79-125-79-272 0-104 40.5-198.5t109.5-163.5 163.5-109.5 198.5-40.5 198.5 40.5 163.5 109.5 109.5 163.5 40.5 198.5q0 147-79 272zm-433-656q-159 0-271.5 112.5t-112.5 271.5 112.5 271.5 271.5 112.5 271.5-112.5 112.5-271.5-112.5-271.5-271.5-112.5zm427 1536q88 0 150.5-71.5t62.5-173.5q0-239-78.5-377t-225.5-145q-145 127-336 127t-336-127q-147 7-225.5 145t-78.5 377q0 102 62.5 173.5t150.5 71.5h854z" />
                    </symbol>
                    <symbol id="padlock" viewBox="0 0 1792 1792">
                        <path d="M640 768h512V576q0-106-75-181t-181-75-181 75-75 181v192zm832 96v576q0 40-28 68t-68 28H416q-40 0-68-28t-28-68V864q0-40 28-68t68-28h32V576q0-184 132-316t316-132 316 132 132 316v192h32q40 0 68 28t28 68z" />
                    </symbol>
                </svg>

            </div>
        </>
    );
};

export default Login;

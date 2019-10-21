import React, { useContext, useEffect, useState } from "react";
import { AirlockContext } from "./AirlockContext";

import "./App.css";

function App() {
  const base = useContext(AirlockContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [valid, setValid] = useState(false);
  useEffect(() => {
    if (!username.trim()) {
      setValid(false);
    } else if (password !== confirmation) {
      setValid(false);
    } else {
      setValid(true);
    }
  }, [username, password, confirmation]);

  async function submitRegistration(ev) {
    ev.preventDefault();
    const response = await base.register({
      username,
      password
    });
    console.log(response);
  }

  return (
    <div className="App">
      <h1>Airlock Example</h1>
      <form onSubmit={submitRegistration}>
        <h2>Sign up</h2>
        <div>
          <label htmlFor="username">Username</label>
          <input
            name="username"
            type="text"
            onChange={({ target: { value } }) => setUsername(value)}
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            name="password"
            type="password"
            onChange={({ target: { value } }) => setPassword(value)}
          />
        </div>
        <div>
          <label htmlFor="confirmpass">Confirm password</label>
          <input
            name="confirmpass"
            type="password"
            onChange={({ target: { value } }) => setConfirmation(value)}
          />
        </div>
        <input type="submit" value="Register" disabled={!valid} />
      </form>
    </div>
  );
}

export default App;

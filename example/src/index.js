import React from "react";
import ReactDOM from "react-dom";

import "./index.css";
import { AirlockContext, base } from "./AirlockContext";
import App from "./App";

ReactDOM.render(
  <AirlockContext.Provider value={base}>
    <App />
  </AirlockContext.Provider>,
  document.getElementById("root")
);

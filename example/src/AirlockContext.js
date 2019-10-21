import Airlock from "airtable";
import React from "react";

Airlock.configure({
  apiKey: "airlock",
  endpointUrl: "http://localhost:4000",
  userTable: "Users"
});

export const base = Airlock.base(process.env.REACT_APP_AIRTABLE_BASE);
export const AirlockContext = React.createContext(base);

import React from "react";
import TransactionScore from "./TransactionScore";
import Dashboard from "./Dashboard";

function App() {
  return (
    <div>
      <h1>Fraud Detection System</h1>
      <TransactionScore />
      <hr />
      <Dashboard />
    </div>
  );
}

export default App;
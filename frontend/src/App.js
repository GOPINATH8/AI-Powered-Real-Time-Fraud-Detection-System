import React from "react";
import TransactionScore from "./TransactionScore";
import Dashboard from "./Dashboard";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header className="hero">
        <div className="hero-content">
          <span className="eyebrow">Real-Time Fraud Monitoring</span>
          <h1>AI-Powered Fraud Detection</h1>
          <p>
            Score incoming transactions instantly and monitor suspicious activity
            with a modern dashboard experience.
          </p>
        </div>
      </header>

      <main className="main-grid">
        <section className="panel">
          <TransactionScore />
        </section>

        <section className="panel">
          <Dashboard />
        </section>
      </main>
    </div>
  );
}

export default App;